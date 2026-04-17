package auth

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"github.com/blackworkinc/backend/internal/database"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type sendOTPRequest struct {
	Phone string `json:"phone"`
}

type verifyOTPRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
	Role  string `json:"role"`     // "worker" or "employer" (first time only)
	Name  string `json:"name"`     // optional, for registration
	Lang  string `json:"language"` // optional
}

// SendOTP — generates a 6-digit code, stores it in Redis and logs it (in prod: send via SMS).
func SendOTP(c *fiber.Ctx) error {
	var req sendOTPRequest
	if err := c.BodyParser(&req); err != nil || req.Phone == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "phone required"})
	}

	code := fmt.Sprintf("%06d", rand.Intn(1000000))
	key := "otp:" + req.Phone

	rdb := database.RDB
	if rdb != nil {
		if err := rdb.Set(context.Background(), key, code, 5*time.Minute).Err(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to store otp"})
		}
	}

	// In dev: log to stdout. In prod: pass to SMS gateway.
	fmt.Printf("📱 OTP for %s: %s\n", req.Phone, code)

	return c.JSON(fiber.Map{"ok": true, "dev_code": code}) // remove dev_code in prod
}

// VerifyOTP — checks the code, upserts user, returns JWT.
func VerifyOTP(c *fiber.Ctx) error {
	var req verifyOTPRequest
	if err := c.BodyParser(&req); err != nil {
		fmt.Printf("❌ Auth BodyParser error: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
	}
	fmt.Printf("🔍 DEBUG AUTH: Phone=%s, Code=%s, Role=%s\n", req.Phone, req.Code, req.Role)

	// In dev mode: accept "000000" or check Redis.
	if req.Code != "000000" {
		rdb := database.RDB
		if rdb != nil {
			stored, err := rdb.Get(context.Background(), "otp:"+req.Phone).Result()
			if err != nil || stored != req.Code {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid code"})
			}
			rdb.Del(context.Background(), "otp:"+req.Phone) // one-time use
		}
	}

	if req.Role == "" {
		req.Role = "worker"
	}
	if req.Lang == "" {
		req.Lang = "ru"
	}
	if req.Name == "" {
		req.Name = "Новый пользователь"
	}

	log.Printf("🔑 Verifying OTP for %s. Requested Role: %s", req.Phone, req.Role)

	var isNew bool
	var userID, role string

	err := database.DB.QueryRow(context.Background(), "SELECT id, role FROM users WHERE phone = $1", req.Phone).Scan(&userID, &role)
	if err != nil {
		// Assume user doesn't exist (pgx.ErrNoRows or otherwise)
		isNew = true
		role = req.Role
		err = database.DB.QueryRow(context.Background(),
			`INSERT INTO users (phone, role, name, language)
			 VALUES ($1, $2, $3, $4) RETURNING id`,
			req.Phone, role, req.Name, req.Lang,
		).Scan(&userID)
		if err != nil {
			log.Printf("❌ Auth DB error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "db error: " + err.Error()})
		}
	} else {
		isNew = false
	}

	log.Printf("✅ User %s logged in as %s (New: %v)", userID, role, isNew)

	token, err := issueJWT(userID, role, req.Phone)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "jwt error"})
	}

	return c.JSON(fiber.Map{
		"token":   token,
		"user_id": userID,
		"role":    role,
		"is_new":  isNew,
	})
}

func issueJWT(userID, role, phone string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		Phone:  phone,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(90 * 24 * time.Hour)),
			Issuer:    os.Getenv("APP_NAME"),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
}
