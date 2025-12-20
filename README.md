# chat-app-backend

Real-Time Chat Backend
A production-ready, scalable real-time chat backend built with Node.js, Socket.IO, and MongoDB. This backend supports one-to-one messaging, online status tracking, message persistence, and comprehensive user management.

Features

JWT Authentication - Secure authentication for both REST API and WebSocket connections

Real-time Messaging - Instant message delivery using Socket.IO

Online/Offline Status - Real-time user presence tracking

Message Persistence - All messages stored in MongoDB with pagination

Typing Indicators - Real-time typing status updates

Read Receipts - Message read confirmation

Message Search - Search through conversation history

User Management - Complete user registration, profile management

Security - Rate limiting, input validation, security headers

Logging - Comprehensive logging with Winston


Project Structure

chat-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/         # Mongoose models
│   ├── routes/         # Express routes
│   ├── utils/          # Utility functions
│   └── server.js       # Application entry point
├── logs/               # Application logs
└── package.json        # Dependencies

Environment Variables

Create a .env file in the root directory:

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/chat_app
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key_change_in_production
JWT_REFRESH_EXPIRES_IN=30d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info

REST API Endpoints

Authentication

Method	Endpoint	Description
POST	/api/auth/register	Register new user
POST	/api/auth/login	Login user
POST	/api/auth/refresh-token	Refresh access token
POST	/api/auth/logout	Logout user
GET	/api/auth/profile	Get user profile
PUT	/api/auth/profile	Update profile
PUT	/api/auth/change-password	Change password

Messages

Method	Endpoint	Description
POST	/api/messages/send	Send message
GET	/api/messages/conversation/:userId	Get conversation
GET	/api/messages/chats	Get all chats
GET	/api/messages/search	Search messages
PUT	/api/messages/:id	Edit message
DELETE	/api/messages/:id	Delete message
POST	/api/messages/mark-read	Mark as read

Users

Method	Endpoint	Description
GET	/api/users/online	Get online users
GET	/api/users/search	Search users
GET	/api/users/:id	Get user by ID
GET	/api/users/:id/status	Get user status

Socket.IO Events

Client → Server Events

Event	  Data Format	  Description
authenticate	{ token: string }	Authenticate socket connection
join_chat	{ chatId: string }	Join specific chat room
send_message	{ to: string, content: string, chatId?: string }	Send message to user
typing	{ to: string, isTyping: boolean }	Send typing status
read_receipt	{ messageId: string, chatId: string }	Mark message as read
update_status	{ status: string }	Update user status
disconnect	-	User disconnected

Server → Client Events

Event	  Data Format	  Description
authenticated	{ user: object }	Authentication successful
new_message	{ messageId, sender, content, timestamp }	New message received
message_sent	{ messageId, chatId, timestamp }	Message sent confirmation
user_online	{ userId, username, status }	User came online
user_offline	{ userId, username, status }	User went offline
user_status_changed	{ userId, status, lastSeen }	User status changed
typing_status	{ from, isTyping, timestamp }	User typing status
message_read	{ messageId, readAt, readerId }	Message read confirmation
error	{ message: string, code: string }	Error notification

Database Schema

User Model

{
  username: String,      // Unique username
  email: String,         // Unique email
  password: String,      // Hashed password
  status: String,        // online, offline, away, busy
  lastSeen: Date,
  profilePicture: String,
  bio: String,
  isActive: Boolean
}

Message Model

{
  sender: ObjectId,      // Reference to User
  receiver: ObjectId,    // Reference to User
  content: String,
  messageType: String,   // text, image, file, audio
  isRead: Boolean,
  readAt: Date,
  timestamp: Date
}

Chat Model

{
  participants: [ObjectId],  // Array of User references
  lastMessage: ObjectId,     // Reference to Message
  lastActivity: Date,
  isGroup: Boolean,
  groupName: String
}

Usage Examples
Client-Side Implementation

// Connect to Socket.IO server
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token_here'
  }
});

// Listen for incoming messages
socket.on('new_message', (message) => {
  console.log('New message:', message);
  // Display message in UI
});

// Send message
socket.emit('send_message', {
  to: 'recipient_user_id',
  content: 'Hello there!',
  messageType: 'text'
});

// Typing indicator
let typingTimeout;
function handleTyping() {
  socket.emit('typing', {
    to: 'recipient_user_id',
    isTyping: true
  });
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', {
      to: 'recipient_user_id',
      isTyping: false
    });
  }, 1000);
}

REST API Examples

Register User

curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "Password123",
    "confirmPassword": "Password123"
  }'

Login User

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "john@example.com",
    "password": "Password123"
  }'

Send Message

curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "to": "RECIPIENT_USER_ID",
    "content": "Hello there!"
  }'