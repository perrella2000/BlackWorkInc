package auth

import (
	"fmt"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// ValidateTokenForWS is used before WebSocket upgrade (token comes from query param).
func ValidateTokenForWS(c *fiber.Ctx, tokenStr string) error {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret(), nil
	})
	if err != nil || !token.Valid {
		return fmt.Errorf("invalid token")
	}
	c.Locals("user_id", claims.UserID)
	c.Locals("role", claims.Role)
	return nil
}

// jwtSecret and JWTMiddleware already defined in middleware.go
// This file adds ValidateTokenForWS for WebSocket handshake.
var _ = strings.TrimPrefix // keep import
var _ = os.Getenv          // keep import
