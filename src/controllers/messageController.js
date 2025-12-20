import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Send a message
export const sendMessage = async (req, res) => {
  try {
    const { to, content, messageType = 'text', mediaUrl, chatId } = req.body;
    const from = req.user._id;

    // Validate recipient
    if (to === from.toString()) {
      return res.status(400).json({
        error: 'Cannot send message to yourself',
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(to);
    if (!recipient) {
      return res.status(404).json({
        error: 'Recipient not found',
      });
    }

    // Create message
    const message = new Message({
      sender: from,
      receiver: to,
      content,
      messageType,
      mediaUrl,
      deliveredAt: new Date(),
    });

    await message.save();

    // Find or create chat
    let chat;
    if (chatId) {
      chat = await Chat.findById(chatId);
      if (!chat || !chat.participants.includes(from) || !chat.participants.includes(to)) {
        return res.status(404).json({
          error: 'Chat not found or access denied',
        });
      }
    } else {
      // Create or find existing chat
      chat = await Chat.findOrCreate(from, to);
    }

    // Update chat with last message
    chat.lastMessage = message._id;
    chat.lastActivity = new Date();
    await chat.save();

    // Populate sender and receiver details
    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');

    // Log message sent
    logger.info(`Message sent from ${from} to ${to}`, {
      messageId: message._id,
      chatId: chat._id,
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: {
        message: message.toJSON(),
        chat: {
          id: chat._id,
          participants: chat.participants,
          lastActivity: chat.lastActivity,
        },
      },
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({
      error: 'Failed to send message',
    });
  }
};

// Get conversation between two users
export const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const { limit = 50, offset = 0, before, after } = req.query;

    // Validate user ID
    if (!userId || userId === currentUserId.toString()) {
      return res.status(400).json({
        error: 'Invalid user ID',
      });
    }

    // Check if other user exists
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Build query
    const query = {
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
      deleted: false,
    };

    // Add date filters if provided
    if (before) {
      query.timestamp = { ...query.timestamp, $lt: new Date(before) };
    }
    if (after) {
      query.timestamp = { ...query.timestamp, $gt: new Date(after) };
    }

    // Get messages
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .lean();

    // Get total count for pagination
    const total = await Message.countDocuments(query);

    // Get or create chat
    const chat = await Chat.findOrCreate(currentUserId, userId);

    
    // await Message.updateMany(
    //   {
    //     sender: userId,
    //     receiver: currentUserId,
    //     isRead: false,
    //   },
    //   {
    //     isRead: true,
    //     readAt: new Date(),
    //   }
    // );

    logger.info(`Conversation fetched between ${currentUserId} and ${userId}`);

    res.json({
      data: {
        messages: messages.reverse(),
        chat: {
          id: chat._id,
          participants: chat.participants,
          lastActivity: chat.lastActivity,
        },
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + messages.length,
        },
      },
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation',
    });
  }
};

// Get all chats for current user
export const getChats = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { limit = 50, offset = 0, archived = false } = req.query;

    // Build query
    const query = {
      participants: currentUserId,
      ...(archived ? {} : { archivedBy: { $ne: currentUserId } }),
    };

    // Get chats with last message populated
    const chats = await Chat.find(query)
      .sort({ lastActivity: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('participants', 'username profilePicture status')
      .populate({
        path: 'lastMessage',
        populate: [
          { path: 'sender', select: 'username profilePicture' },
          { path: 'receiver', select: 'username profilePicture' },
        ],
      })
      .populate('createdBy', 'username profilePicture')
      .lean();

    // Get total count
    const total = await Chat.countDocuments(query);

    // Count unread messages for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          receiver: currentUserId,
          isRead: false,
          deleted: false,
        });
        
        return {
          ...chat,
          unreadCount,
        };
      })
    );

    logger.info(`Chats fetched for user ${currentUserId}`);

    res.json({
      data: {
        chats: chatsWithUnreadCount,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + chats.length,
        },
      },
    });
  } catch (error) {
    logger.error('Get chats error:', error);
    res.status(500).json({
      error: 'Failed to fetch chats',
    });
  }
};

// Get message by ID
export const getMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    const message = await Message.findOne({
      _id: id,
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId },
      ],
      deleted: false,
    })
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture');

    if (!message) {
      return res.status(404).json({
        error: 'Message not found',
      });
    }

    res.json({
      data: { message },
    });
  } catch (error) {
    logger.error('Get message error:', error);
    res.status(500).json({
      error: 'Failed to fetch message',
    });
  }
};

// Update message (edit)
export const updateMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const currentUserId = req.user._id;

    // Find message
    const message = await Message.findOne({
      _id: id,
      sender: currentUserId,
      deleted: false,
    });

    if (!message) {
      return res.status(404).json({
        error: 'Message not found or unauthorized',
      });
    }

    // Check if message can be edited (e.g., within 15 minutes)
    const editWindow = 15 * 60 * 1000; // 15 minutes in milliseconds
    const messageAge = Date.now() - message.timestamp.getTime();
    
    if (messageAge > editWindow) {
      return res.status(400).json({
        error: 'Message can only be edited within 15 minutes of sending',
      });
    }

    // Update message
    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    // Populate sender and receiver
    await message.populate('sender', 'username profilePicture');
    await message.populate('receiver', 'username profilePicture');

    logger.info(`Message ${id} edited by user ${currentUserId}`);

    res.json({
      message: 'Message updated successfully',
      data: { message },
    });
  } catch (error) {
    logger.error('Update message error:', error);
    res.status(500).json({
      error: 'Failed to update message',
    });
  }
};

// Delete message (soft delete)
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    // Find message
    const message = await Message.findOne({
      _id: id,
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId },
      ],
      deleted: false,
    });

    if (!message) {
      return res.status(404).json({
        error: 'Message not found or unauthorized',
      });
    }

    // Soft delete
    message.deleted = true;
    message.deletedAt = new Date();
    await message.save();

    logger.info(`Message ${id} deleted by user ${currentUserId}`);

    res.json({
      message: 'Message deleted successfully',
    });
  } catch (error) {
    logger.error('Delete message error:', error);
    res.status(500).json({
      error: 'Failed to delete message',
    });
  }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
  try {
    const { messageIds, chatId } = req.body;
    const currentUserId = req.user._id;

    if (!messageIds && !chatId) {
      return res.status(400).json({
        error: 'Either messageIds or chatId is required',
      });
    }

    let query;
    if (messageIds && Array.isArray(messageIds)) {
      query = {
        _id: { $in: messageIds },
        receiver: currentUserId,
        isRead: false,
      };
    } else if (chatId) {
      query = {
        chat: chatId,
        receiver: currentUserId,
        isRead: false,
      };
    } else {
      return res.status(400).json({
        error: 'Invalid parameters',
      });
    }

    // Update messages
    const result = await Message.updateMany(query, {
      isRead: true,
      readAt: new Date(),
    });

    logger.info(`Messages marked as read by user ${currentUserId}`, {
      updatedCount: result.modifiedCount,
    });

    res.json({
      message: 'Messages marked as read',
      data: {
        updatedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error('Mark as read error:', error);
    res.status(500).json({
      error: 'Failed to mark messages as read',
    });
  }
};

// Search messages
export const searchMessages = async (req, res) => {
  try {
    const { query, limit = 50, offset = 0 } = req.query;
    const currentUserId = req.user._id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters',
      });
    }

    const searchQuery = {
      $or: [
        { sender: currentUserId },
        { receiver: currentUserId },
      ],
      deleted: false,
      content: { $regex: query, $options: 'i' },
    };

    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture')
      .populate('receiver', 'username profilePicture')
      .lean();

    const total = await Message.countDocuments(searchQuery);

    logger.info(`Messages searched by user ${currentUserId}`, {
      query,
      resultCount: messages.length,
    });

    res.json({
      data: {
        messages,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + messages.length,
        },
      },
    });
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({
      error: 'Failed to search messages',
    });
  }
};

// Get unread messages count
export const getUnreadCount = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const unreadCount = await Message.countDocuments({
      receiver: currentUserId,
      isRead: false,
      deleted: false,
    });

    res.json({
      data: { unreadCount },
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
    });
  }
};

export default {
  sendMessage,
  getConversation,
  getChats,
  getMessage,
  updateMessage,
  deleteMessage,
  markAsRead,
  searchMessages,
  getUnreadCount,
};