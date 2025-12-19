import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';

// Store online users in memory (for scalability, use Redis in production)
const onlineUsers = new Map();

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.user = user;
    
    // Add user to online users
    onlineUsers.set(user._id.toString(), {
      socketId: socket.id,
      userId: user._id,
      username: user.username,
      status: 'online',
      lastSeen: new Date(),
    });

    // Update user status in database
    await User.findByIdAndUpdate(user._id, {
      status: 'online',
      lastSeen: new Date(),
    });

    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication error: Invalid token'));
  }
};

const socketHandler = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.username} (${socket.userId})`);
    
    // Join user to their personal room
    socket.join(`user:${socket.userId}`);
    
    // Notify friends/contacts that user is online
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      username: socket.user.username,
      status: 'online',
      lastSeen: new Date(),
    });

    // Handle user joining a specific chat room
    socket.on('join_chat', async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (chat && chat.participants.includes(socket.userId)) {
          socket.join(`chat:${chatId}`);
          logger.info(`User ${socket.userId} joined chat ${chatId}`);
        }
      } catch (error) {
        logger.error('Error joining chat:', error);
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { to, content, chatId } = data;
        
        if (!to || !content) {
          return socket.emit('error', {
            message: 'Recipient and content are required',
            code: 'INVALID_DATA',
          });
        }

        // Create new message
        const message = new Message({
          sender: socket.userId,
          receiver: to,
          content,
          timestamp: new Date(),
        });

        await message.save();

        // Create or update chat
        let chat;
        if (chatId) {
          chat = await Chat.findById(chatId);
          if (chat) {
            chat.lastMessage = message._id;
            chat.updatedAt = new Date();
            await chat.save();
          }
        } else {
          // Find existing chat or create new one
          chat = await Chat.findOne({
            participants: { $all: [socket.userId, to] },
          });
          
          if (!chat) {
            chat = new Chat({
              participants: [socket.userId, to],
              lastMessage: message._id,
            });
            await chat.save();
          } else {
            chat.lastMessage = message._id;
            chat.updatedAt = new Date();
            await chat.save();
          }
        }

        // Emit to sender (confirmation)
        socket.emit('message_sent', {
          messageId: message._id,
          chatId: chat._id,
          timestamp: message.timestamp,
        });

        // Emit to recipient if online
        const recipientSocketId = onlineUsers.get(to)?.socketId;
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('new_message', {
            messageId: message._id,
            sender: socket.userId,
            senderName: socket.user.username,
            content: message.content,
            timestamp: message.timestamp,
            chatId: chat._id,
          });
        }

        // Also emit to chat room
        io.to(`chat:${chat._id}`).emit('new_message', {
          messageId: message._id,
          sender: socket.userId,
          senderName: socket.user.username,
          content: message.content,
          timestamp: message.timestamp,
          chatId: chat._id,
        });

        logger.info(`Message sent from ${socket.userId} to ${to}`);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', {
          message: 'Failed to send message',
          code: 'SEND_MESSAGE_FAILED',
        });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ to, isTyping }) => {
      if (onlineUsers.has(to)) {
        io.to(onlineUsers.get(to).socketId).emit('typing_status', {
          from: socket.userId,
          fromName: socket.user.username,
          isTyping,
          timestamp: new Date(),
        });
      }
    });

    // Handle read receipt
    socket.on('read_receipt', async ({ messageId, chatId }) => {
      try {
        const message = await Message.findById(messageId);
        
        if (message && message.receiver.toString() === socket.userId) {
          message.isRead = true;
          message.readAt = new Date();
          await message.save();

          // Notify sender
          if (onlineUsers.has(message.sender.toString())) {
            io.to(onlineUsers.get(message.sender.toString()).socketId).emit('message_read', {
              messageId,
              readAt: message.readAt,
              chatId,
            });
          }

          // Notify chat room
          io.to(`chat:${chatId}`).emit('message_read', {
            messageId,
            readAt: message.readAt,
            readerId: socket.userId,
          });
        }
      } catch (error) {
        logger.error('Error updating read receipt:', error);
      }
    });

    // Handle user status update
    socket.on('update_status', async ({ status }) => {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          status,
          lastSeen: new Date(),
        });

        // Update in memory store
        if (onlineUsers.has(socket.userId)) {
          onlineUsers.get(socket.userId).status = status;
          onlineUsers.get(socket.userId).lastSeen = new Date();
        }

        // Broadcast status update
        socket.broadcast.emit('user_status_changed', {
          userId: socket.userId,
          username: socket.user.username,
          status,
          lastSeen: new Date(),
        });

        logger.info(`User ${socket.userId} status updated to ${status}`);
      } catch (error) {
        logger.error('Error updating status:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        logger.info(`User disconnected: ${socket.user.username} (${socket.userId})`);
        
        // Update user status to offline
        await User.findByIdAndUpdate(socket.userId, {
          status: 'offline',
          lastSeen: new Date(),
        });

        // Remove from online users
        onlineUsers.delete(socket.userId);

        // Notify other users
        socket.broadcast.emit('user_offline', {
          userId: socket.userId,
          username: socket.user.username,
          status: 'offline',
          lastSeen: new Date(),
        });
      } catch (error) {
        logger.error('Error handling disconnect:', error);
      }
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Get online users (for REST API)
  const getOnlineUsers = () => {
    return Array.from(onlineUsers.values());
  };

  return { getOnlineUsers };
};

export default socketHandler;