package profile

import (
	"context"
	"encoding/json"

	"github.com/blackworkinc/backend/internal/database"
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(router fiber.Router) {
	router.Get("/profile", GetProfile)
	router.Put("/profile", UpdateProfile)
	router.Get("/profile/:id/reviews", GetReviews)
	router.Post("/profile/:id/reviews", PostReview)
}

// GetProfile — returns the authenticated user's profile.
func GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var id, phone, role, name, companyName, city, avatarEmoji, language string
	var skillsBytes []byte
	var rating float64
	err := database.DB.QueryRow(context.Background(), `
		SELECT id, phone, role, name, company_name, city, skills, avatar_emoji, language, rating
		FROM users WHERE id = $1
	`, userID).Scan(&id, &phone, &role, &name, &companyName, &city, &skillsBytes, &avatarEmoji, &language, &rating)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	skills := []string{}
	if skillsBytes != nil {
		json.Unmarshal(skillsBytes, &skills)
	}

	return c.JSON(fiber.Map{
		"id": id, "phone": phone, "role": role, "name": name,
		"company_name": companyName, "city": city, "skills": skills,
		"avatar_emoji": avatarEmoji, "language": language, "rating": rating,
	})
}

// UpdateProfile — updates name/company_name/avatar_emoji/language.
func UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var body struct {
		Name        string   `json:"name"`
		CompanyName string   `json:"company_name"`
		City        string   `json:"city"`
		Skills      []string `json:"skills"`
		AvatarEmoji string   `json:"avatar_emoji"`
		Language    string   `json:"language"`
		Role        string   `json:"role"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}

	skillsJSON, _ := json.Marshal(body.Skills)
	if body.Skills == nil {
		skillsJSON = []byte("[]")
	}

	_, err := database.DB.Exec(context.Background(), `
		UPDATE users
		SET name = COALESCE(NULLIF($1,''), name),
		    company_name = COALESCE(NULLIF($2,''), company_name),
		    city = COALESCE(NULLIF($3,''), city),
		    skills = COALESCE($4, skills),
		    avatar_emoji = COALESCE(NULLIF($5,''), avatar_emoji),
		    language = COALESCE(NULLIF($6,''), language),
		    role = COALESCE(NULLIF($7,''), role)
		WHERE id = $8
	`, body.Name, body.CompanyName, body.City, skillsJSON, body.AvatarEmoji, body.Language, body.Role, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// GetReviews — returns reviews for any user by ID.
func GetReviews(c *fiber.Ctx) error {
	revieweeID := c.Params("id")
	rows, err := database.DB.Query(context.Background(), `
		SELECT r.id, r.rating, r.comment, u.name AS reviewer_name, r.created_at
		FROM reviews r
		JOIN users u ON u.id = r.reviewer_id
		WHERE r.reviewee_id = $1
		ORDER BY r.created_at DESC
	`, revieweeID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var result []fiber.Map
	for rows.Next() {
		var id, comment, reviewerName, createdAt string
		var rating int
		rows.Scan(&id, &rating, &comment, &reviewerName, &createdAt)
		result = append(result, fiber.Map{
			"id": id, "rating": rating, "comment": comment,
			"reviewer_name": reviewerName, "created_at": createdAt,
		})
	}
	if result == nil {
		result = []fiber.Map{}
	}
	return c.JSON(result)
}

// PostReview — post a review for a user (after a conversation).
func PostReview(c *fiber.Ctx) error {
	reviewerID := c.Locals("user_id").(string)
	revieweeID := c.Params("id")
	var body struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
	}
	if err := c.BodyParser(&body); err != nil || body.Rating < 1 || body.Rating > 5 {
		return c.Status(400).JSON(fiber.Map{"error": "rating 1-5 required"})
	}

	var id string
	err := database.DB.QueryRow(context.Background(), `
		INSERT INTO reviews (reviewee_id, reviewer_id, rating, comment)
		VALUES ($1,$2,$3,$4) RETURNING id
	`, revieweeID, reviewerID, body.Rating, body.Comment).Scan(&id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Recalculate average rating for the reviewee
	database.DB.Exec(context.Background(), `
		UPDATE users SET rating = (
			SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews WHERE reviewee_id = $1
		) WHERE id = $1
	`, revieweeID)

	return c.Status(201).JSON(fiber.Map{"ok": true, "id": id})
}
