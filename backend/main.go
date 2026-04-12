package main

import (
	"log"
	"os"

	"github.com/blackworkinc/backend/internal/auth"
	"github.com/blackworkinc/backend/internal/chat"
	"github.com/blackworkinc/backend/internal/database"
	"github.com/blackworkinc/backend/internal/jobs"
	"github.com/blackworkinc/backend/internal/profile"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// Connect DB
	if err := database.ConnectDB(); err != nil {
		log.Fatalf("DB connection failed: %v", err)
	}
	database.RunMigrations()

	// Connect Redis (optional — OTP still works via logs if Redis is absent)
	if err := database.ConnectRedis(); err != nil {
		log.Printf("⚠️  Redis unavailable: %v (OTP stored in-memory fallback)", err)
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		},
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Health check (public)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "BlackWorkInc API"})
	})

	api := app.Group("/api/v1")

	// ── Public routes ──────────────────────────────────────────
	api.Post("/auth/send-otp", auth.SendOTP)
	api.Post("/auth/verify-otp", auth.VerifyOTP)

	// ── WebSocket (token via query param) ──────────────────────
	app.Use("/api/v1/ws", func(c *fiber.Ctx) error {
		token := c.Query("token")
		if token == "" {
			return c.Status(401).JSON(fiber.Map{"error": "missing token"})
		}
		// Validate token and inject locals before upgrade
		if err := auth.ValidateTokenForWS(c, token); err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid token"})
		}
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/api/v1/ws", websocket.New(chat.WSHandler))

	// ── Protected routes (JWT required) ────────────────────────
	protected := api.Group("", auth.JWTMiddleware)

	jobs.RegisterRoutes(protected)
	profile.RegisterRoutes(protected)
	chat.RegisterRoutes(protected)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 BlackWorkInc API starting on :%s", port)
	log.Fatal(app.Listen(":" + port))
}
