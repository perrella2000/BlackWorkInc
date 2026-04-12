package models

import "time"

type JobStatus string

const (
	JobStatusActive   JobStatus = "active"
	JobStatusInactive JobStatus = "inactive"
)

type Job struct {
	ID          string    `json:"id" db:"id"`
	EmployerID  string    `json:"employer_id" db:"employer_id"`
	CategoryIdx int       `json:"category_idx" db:"category_idx"`
	Salary      string    `json:"salary" db:"salary"`
	Lat         float64   `json:"lat" db:"lat"` // Using lat/lng to construct PostGIS Point
	Lng         float64   `json:"lng" db:"lng"`
	Description string    `json:"description" db:"description"`
	Status      JobStatus `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}
