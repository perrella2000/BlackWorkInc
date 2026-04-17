package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/blackworkinc/backend/internal/database"
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(router fiber.Router) {
	g := router.Group("/jobs")
	g.Get("/", ListJobs)
	g.Post("/", CreateJob)
	g.Put("/:id", UpdateJob)
	g.Delete("/:id", DeleteJob)
	g.Post("/:id/like", LikeJob)
	g.Post("/:id/skip", SkipJob)
	router.Get("/employer/jobs", ListEmployerJobs)
}

// ListJobs — returns active jobs excluding already-swiped ones.
func ListJobs(c *fiber.Ctx) error {
	workerID, _ := c.Locals("user_id").(string)

	rows, err := database.DB.Query(context.Background(), `
		SELECT j.id, j.employer_id, j.title, j.icon, j.salary, j.description, j.skills,
		       j.rating, u.name AS employer_name
		FROM jobs j
		JOIN users u ON u.id = j.employer_id
		WHERE j.status = 'active'
		  AND j.id NOT IN (
		        SELECT job_id FROM job_matches WHERE worker_id = $1
		      )
		ORDER BY j.created_at DESC
		LIMIT 50
	`, workerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var result []fiber.Map
	for rows.Next() {
		var id, empID, title, icon, salary, description, employerName string
		var skillsJSON []byte
		var rating interface{} // can be null
		
		err := rows.Scan(&id, &empID, &title, &icon, &salary, &description, &skillsJSON, &rating, &employerName)
		if err != nil {
			log.Printf("⚠️ Scan error row in feed: %v", err)
			continue
		}

		var skills []string
		if skillsJSON != nil {
			_ = json.Unmarshal(skillsJSON, &skills)
		}
		
		valRating := 0.0
		if rating != nil {
			switch v := rating.(type) {
			case float64: valRating = v
			case float32: valRating = float64(v)
			case int64: valRating = float64(v)
			}
		}

		result = append(result, fiber.Map{
			"id": id, "employer_id": empID, "title": title, "icon": icon,
			"salary": salary, "description": description, "skills": skills,
			"rating": valRating, "employer": employerName, "dist": "1.2 км",
		})
	}
	if result == nil {
		result = []fiber.Map{}
	}
	return c.JSON(result)
}

func ListEmployerJobs(c *fiber.Ctx) error {
	employerID := c.Locals("user_id").(string)
	log.Printf("📥 Fetching ALL jobs for employer: %s", employerID)
	
	rows, err := database.DB.Query(context.Background(), `
		SELECT id, title, icon, salary, description, skills, status, rating, created_at
		FROM jobs 
		WHERE employer_id = $1 
		ORDER BY created_at DESC
	`, employerID)
	if err != nil {
		log.Printf("❌ DB Query error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var result []fiber.Map
	fmt.Println(">>> JOBS LOOP START")
	for rows.Next() {
		var (
			id, title, icon, salary, desc, status interface{}
			skillsJSON interface{}
			rating interface{}
			createdAt interface{}
		)
		
		fmt.Println(">>> SCANNING NEXT ROW...")
		err := rows.Scan(&id, &title, &icon, &salary, &desc, &skillsJSON, &status, &rating, &createdAt)
		if err != nil {
			fmt.Printf(">>> SCAN ERROR: %v\n", err)
			continue
		}

		// Convert to strings safely
		var sID string
		switch v := id.(type) {
		case string:
			sID = v
		case []byte:
			if len(v) == 16 {
				sID = fmt.Sprintf("%x-%x-%x-%x-%x", v[0:4], v[4:6], v[6:8], v[8:10], v[10:16])
			} else {
				sID = string(v)
			}
		case [16]byte:
			sID = fmt.Sprintf("%x-%x-%x-%x-%x", v[0:4], v[4:6], v[6:8], v[8:10], v[10:16])
		default:
			sID = fmt.Sprintf("%v", v)
		}

		sTitle, _ := title.(string)
		fmt.Printf(">>> SUCCESS SCAN: %s (ID: %s)\n", sTitle, sID)

		sIcon, _ := icon.(string)
		sSalary, _ := salary.(string)
		sDesc, _ := desc.(string)
		sStatus, _ := status.(string)

		var skills []string
		switch v := skillsJSON.(type) {
		case []byte:
			if len(v) > 0 { _ = json.Unmarshal(v, &skills) }
		case string:
			if len(v) > 0 { _ = json.Unmarshal([]byte(v), &skills) }
		default:
			// Fallback: try to serialize and re-parse if it's a map or slice
			if v != nil {
				tmp, _ := json.Marshal(v)
				_ = json.Unmarshal(tmp, &skills)
			}
		}
		if skills == nil {
			skills = []string{}
		}
		
		fRating := 0.0
		if rating != nil {
			switch v := rating.(type) {
			case float64: fRating = v
			case float32: fRating = float64(v)
			case int64: fRating = float64(v)
			case int32: fRating = float64(v)
			case int: fRating = float64(v)
			}
		}

		result = append(result, fiber.Map{
			"id": sID, "title": sTitle, "icon": sIcon, "salary": sSalary,
			"description": sDesc, "skills": skills, "status": sStatus,
			"rating": fRating, "created_at": createdAt,
		})
	}
	
	if err := rows.Err(); err != nil {
		fmt.Printf(">>> ROWS ERR: %v\n", err)
	}
	
	fmt.Printf(">>> JOBS LOOP END. Count: %d\n", len(result))
	return c.JSON(result)
}

// CreateJob — employer creates a new job.
func CreateJob(c *fiber.Ctx) error {
	employerID := c.Locals("user_id").(string)
	var body struct {
		Title       string   `json:"title"`
		Icon        string   `json:"icon"`
		Salary      string   `json:"salary"`
		Description string   `json:"description"`
		Skills      []string `json:"skills"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	skillsJSON, _ := json.Marshal(body.Skills)

	log.Printf("🔨 Creating new job for employer %s: %s", employerID, body.Title)

	var id string
	err := database.DB.QueryRow(context.Background(), `
		INSERT INTO jobs (employer_id, title, icon, salary, description, skills, status)
		VALUES ($1,$2,$3,$4,$5,$6, 'active') 
		RETURNING id
	`, employerID, body.Title, body.Icon, body.Salary, body.Description, skillsJSON).Scan(&id)
	
	if err != nil {
		log.Printf("❌ CreateJob DB error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	
	log.Printf("✨ Created job ID: %s", id)
	return c.Status(201).JSON(fiber.Map{"id": id, "ok": true})
}

// UpdateJob — employer updates their job.
func UpdateJob(c *fiber.Ctx) error {
	employerID := c.Locals("user_id").(string)
	jobID := c.Params("id")
	var body struct {
		Title       string   `json:"title"`
		Icon        string   `json:"icon"`
		Salary      string   `json:"salary"`
		Description string   `json:"description"`
		Skills      []string `json:"skills"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid body"})
	}
	
	log.Printf("📝 Updating job %s for employer %s", jobID, employerID)
	
	skillsJSON, _ := json.Marshal(body.Skills)
	_, err := database.DB.Exec(context.Background(), `
		UPDATE jobs SET title=$1, icon=$2, salary=$3, description=$4, skills=$5
		WHERE id=$6 AND employer_id=$7
	`, body.Title, body.Icon, body.Salary, body.Description, skillsJSON, jobID, employerID)
	if err != nil {
		log.Printf("❌ UpdateJob DB error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// DeleteJob — soft delete (set status=inactive).
func DeleteJob(c *fiber.Ctx) error {
	employerID := c.Locals("user_id").(string)
	jobID := c.Params("id")
	_, err := database.DB.Exec(context.Background(),
		`UPDATE jobs SET status='inactive' WHERE id=$1 AND employer_id=$2`, jobID, employerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// LikeJob — worker likes a job; if employer already liked worker → create conversation.
func LikeJob(c *fiber.Ctx) error {
	workerID := c.Locals("user_id").(string)
	jobID := c.Params("id")

	_, err := database.DB.Exec(context.Background(), `
		INSERT INTO job_matches (job_id, worker_id, status)
		VALUES ($1, $2, 'liked')
		ON CONFLICT (job_id, worker_id) DO UPDATE SET status='liked'
	`, jobID, workerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Check if employer also liked this worker (i.e., job belongs to employer and they want workers)
	// In our model, a job being published = employer is interested, so any like = instant match.
	var employerID string
	err = database.DB.QueryRow(context.Background(),
		`SELECT employer_id FROM jobs WHERE id=$1`, jobID).Scan(&employerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Update match status
	database.DB.Exec(context.Background(),
		`UPDATE job_matches SET status='matched' WHERE job_id=$1 AND worker_id=$2`, jobID, workerID)

	// Create conversation if not exists
	var convID string
	err = database.DB.QueryRow(context.Background(), `
		INSERT INTO conversations (job_id, employer_id, worker_id)
		VALUES ($1,$2,$3)
		ON CONFLICT DO NOTHING
		RETURNING id
	`, jobID, employerID, workerID).Scan(&convID)
	if err != nil || convID == "" {
		// Already exists — fetch it
		database.DB.QueryRow(context.Background(),
			`SELECT id FROM conversations WHERE job_id=$1 AND worker_id=$2`,
			jobID, workerID).Scan(&convID)
	}

	return c.JSON(fiber.Map{"ok": true, "conversation_id": convID, "employer_id": employerID})
}

// SkipJob — worker skips a job.
func SkipJob(c *fiber.Ctx) error {
	workerID := c.Locals("user_id").(string)
	jobID := c.Params("id")
	_, err := database.DB.Exec(context.Background(), `
		INSERT INTO job_matches (job_id, worker_id, status)
		VALUES ($1,$2,'rejected')
		ON CONFLICT (job_id, worker_id) DO UPDATE SET status='rejected'
	`, jobID, workerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}
