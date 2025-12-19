import express from 'express';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { auth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get online users
router.get('/online', auth, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    // Get online users from database
    const onlineUsers = await User.find({
      _id: { $ne: currentUserId },
      status: 'online',
      isActive: true,
    }).select('username email profilePicture status lastSeen bio');
    
    // You might want to also check your in-memory store if using one
    
    res.json({
      data: {
        onlineUsers,
        count: onlineUsers.length,
      },
    });
  } catch (error) {
    logger.error('Get online users error:', error);
    res.status(500).json({
      error: 'Failed to get online users',
    });
  }
});

// Search users
router.get('/search', auth, async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters',
      });
    }
    
    const searchQuery = {
      _id: { $ne: req.user._id },
      isActive: true,
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    };
    
    const users = await User.find(searchQuery)
      .select('username email profilePicture status lastSeen bio')
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .lean();
    
    const total = await User.countDocuments(searchQuery);
    
    // Check if users have existing chats with current user
    const usersWithChatInfo = await Promise.all(
      users.map(async (user) => {
        const existingChat = await Chat.findOne({
          participants: { $all: [req.user._id, user._id] },
          isGroup: false,
        });
        
        return {
          ...user,
          hasExistingChat: !!existingChat,
          chatId: existingChat?._id,
        };
      })
    );
    
    res.json({
      data: {
        users: usersWithChatInfo,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + users.length,
        },
      },
    });
  } catch (error) {
    logger.error('Search users error:', error);
    res.status(500).json({
      error: 'Failed to search users',
    });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email profilePicture status lastSeen bio createdAt');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }
    
    // Check if there's an existing chat between users
    const existingChat = await Chat.findOne({
      participants: { $all: [req.user._id, user._id] },
      isGroup: false,
    });
    
    const response = {
      user: user.toObject(),
      hasExistingChat: !!existingChat,
      chatId: existingChat?._id,
    };
    
    res.json({
      data: response,
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
    });
  }
});

// Get user status
router.get('/:id/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('status lastSeen');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }
    
    res.json({
      data: {
        status: user.status,
        lastSeen: user.lastSeen,
        isOnline: user.status === 'online',
      },
    });
  } catch (error) {
    logger.error('Get user status error:', error);
    res.status(500).json({
      error: 'Failed to get user status',
    });
  }
});

export default router;