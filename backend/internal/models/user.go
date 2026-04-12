package models

import "time"

type Role string

const (
	RoleWorker   Role = "worker"
	RoleEmployer Role = "employer"
)

type User struct {
	ID        string    `json:"id" db:"id"`
	Phone     string    `json:"phone" db:"phone"`
	Role      Role      `json:"role" db:"role"`
	Name      string    `json:"name" db:"name"`
	AvatarURL string    `json:"avatar_url" db:"avatar_url"`
	Language  string    `json:"language" db:"language"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}
