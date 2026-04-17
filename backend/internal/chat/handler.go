package chat

import (
	"context"
	"encoding/json"
	"log"
	"sync"

	"github.com/blackworkinc/backend/internal/database"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(router fiber.Router) {
	router.Get("/conversations", ListConversations)
	router.Get("/conversations/:id/messages", GetMessages)
	// WebSocket — query param ?token=<jwt> is validated upstream by middleware
	router.Get("/ws", websocket.New(WSHandler))
}

// ---- REST ----

func ListConversations(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	rows, err := database.DB.Query(context.Background(), `
		SELECT cv.id, cv.job_id, j.title, j.icon, j.salary, cv.employer_id, cv.worker_id,
		       ue.name AS employer_name, uw.name AS worker_name
		FROM conversations cv
		JOIN jobs j ON j.id = cv.job_id
		JOIN users ue ON ue.id = cv.employer_id
		JOIN users uw ON uw.id = cv.worker_id
		WHERE cv.employer_id = $1 OR cv.worker_id = $1
		ORDER BY cv.created_at DESC
	`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var result []fiber.Map
	for rows.Next() {
		var id, jobID, title, icon, salary, empID, workerID, empName, workerName string
		rows.Scan(&id, &jobID, &title, &icon, &salary, &empID, &workerID, &empName, &workerName)
		result = append(result, fiber.Map{
			"id": id, "job_id": jobID, "title": title, "icon": icon, "salary": salary,
			"employer_id": empID, "worker_id": workerID,
			"employer_name": empName, "worker_name": workerName,
		})
	}
	if result == nil {
		result = []fiber.Map{}
	}
	return c.JSON(result)
}

func GetMessages(c *fiber.Ctx) error {
	convID := c.Params("id")
	rows, err := database.DB.Query(context.Background(), `
		SELECT id, sender_id, text_content, created_at
		FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC
	`, convID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	var result []fiber.Map
	for rows.Next() {
		var id, senderID, text, createdAt string
		rows.Scan(&id, &senderID, &text, &createdAt)
		result = append(result, fiber.Map{
			"id": id, "sender_id": senderID, "text": text, "created_at": createdAt,
		})
	}
	if result == nil {
		result = []fiber.Map{}
	}
	return c.JSON(result)
}

// ---- WebSocket Hub ----

type client struct {
	conn           *websocket.Conn
	conversationID string
	userID         string
}

var (
	mu      sync.Mutex
	clients = map[string][]*client{} // conversationID → clients
)

type wsMessage struct {
	ConversationID string `json:"conversation_id"`
	Text           string `json:"text"`
	SenderID       string `json:"sender_id,omitempty"`
	ID             string `json:"id,omitempty"`
	CreatedAt      string `json:"created_at,omitempty"`
}

func WSHandler(c *websocket.Conn) {
	userID := c.Locals("user_id")
	if userID == nil {
		c.Close()
		return
	}
	uid := userID.(string)

	// Automatically join all existing conversations for this user
	joinRoomsOnConnect(c, uid)

	for {
		_, raw, err := c.ReadMessage()
		if err != nil {
			removeClient(c)
			break
		}

		var msg wsMessage
		if err := json.Unmarshal(raw, &msg); err != nil || msg.ConversationID == "" {
			continue
		}

		// Register client to room if not already there (safety)
		ensureRegistered(c, uid, msg.ConversationID)

		// Persist message to DB
		var id, createdAt string
		err = database.DB.QueryRow(context.Background(), `
			INSERT INTO messages (conversation_id, sender_id, text_content)
			VALUES ($1,$2,$3) RETURNING id, created_at
		`, msg.ConversationID, uid, msg.Text).Scan(&id, &createdAt)
		if err != nil {
			log.Printf("WS insert error: %v", err)
			continue
		}

		broadcast(msg.ConversationID, wsMessage{
			ConversationID: msg.ConversationID,
			ID:             id,
			SenderID:       uid,
			Text:           msg.Text,
			CreatedAt:      createdAt,
		})
	}
}

func joinRoomsOnConnect(conn *websocket.Conn, userID string) {
	rows, err := database.DB.Query(context.Background(), `
		SELECT id FROM conversations WHERE employer_id = $1 OR worker_id = $1
	`, userID)
	if err != nil {
		return
	}
	defer rows.Close()

	mu.Lock()
	defer mu.Unlock()
	for rows.Next() {
		var convID string
		if err := rows.Scan(&convID); err == nil {
			clients[convID] = append(clients[convID], &client{conn: conn, conversationID: convID, userID: userID})
		}
	}
}

func ensureRegistered(conn *websocket.Conn, userID, convID string) {
	mu.Lock()
	defer mu.Unlock()
	for _, cl := range clients[convID] {
		if cl.conn == conn {
			return
		}
	}
	clients[convID] = append(clients[convID], &client{conn: conn, conversationID: convID, userID: userID})
}

func removeClient(conn *websocket.Conn) {
	mu.Lock()
	defer mu.Unlock()
	for convID, cls := range clients {
		var updated []*client
		for _, cl := range cls {
			if cl.conn != conn {
				updated = append(updated, cl)
			}
		}
		clients[convID] = updated
	}
}

func broadcast(convID string, msg wsMessage) {
	data, _ := json.Marshal(msg)
	mu.Lock()
	defer mu.Unlock()
	for _, cl := range clients[convID] {
		cl.conn.WriteMessage(1, data)
	}
}
