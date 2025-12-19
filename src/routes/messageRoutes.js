import express from 'express';
import messageController from '../controllers/messageController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../utils/validators.js';
import { messageValidation } from '../utils/validators.js';

const router = express.Router();

// All message routes require authentication
router.use(auth);

// Send message
router.post(
  '/send',
  validate(messageValidation.sendMessage),
  messageController.sendMessage
);

// Get conversation with specific user
router.get(
  '/conversation/:userId',
  validate(messageValidation.getMessages, 'params'),
  messageController.getConversation
);

// Get all chats for current user
router.get(
  '/chats',
  validate(messageValidation.getChats, 'query'),
  messageController.getChats
);

// Get specific message
router.get('/:id', messageController.getMessage);

// Update (edit) message
router.put(
  '/:id',
  validate(messageValidation.updateMessage),
  messageController.updateMessage
);

// Delete message
router.delete('/:id', messageController.deleteMessage);

// Mark messages as read
router.post('/mark-read', messageController.markAsRead);

// Search messages
router.get('/search', messageController.searchMessages);

// Get unread messages count
router.get('/unread/count', messageController.getUnreadCount);

export default router;