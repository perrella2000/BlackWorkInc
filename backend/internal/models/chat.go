package models

import "time"

type MatchStatus string

const (
	MatchStatusLiked    MatchStatus = "liked"
	MatchStatusRejected MatchStatus = "rejected"
	MatchStatusMatched  MatchStatus = "matched"
)

type JobMatch struct {
	JobID    string      `json:"job_id" db:"job_id"`
	WorkerID string      `json:"worker_id" db:"worker_id"`
	Status   MatchStatus `json:"status" db:"status"`
}

type Conversation struct {
	ID         string    `json:"id" db:"id"`
	JobID      string    `json:"job_id" db:"job_id"`
	EmployerID string    `json:"employer_id" db:"employer_id"`
	WorkerID   string    `json:"worker_id" db:"worker_id"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type Message struct {
	ID             string    `json:"id" db:"id"`
	ConversationID string    `json:"conversation_id" db:"conversation_id"`
	SenderID       string    `json:"sender_id" db:"sender_id"`
	TextContent    string    `json:"text_content" db:"text_content"`
	AudioURL       string    `json:"audio_url" db:"audio_url"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}
