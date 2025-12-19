import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required'],
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver is required'],
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters'],
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'audio'],
    default: 'text',
  },
  mediaUrl: {
    type: String,
    default: '',
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
    default: Date.now,
  },
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ sender: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, timestamp: -1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ timestamp: -1 });

// Virtual for conversation ID (sorted combination of sender and receiver)
messageSchema.virtual('conversationId').get(function() {
  const participants = [this.sender.toString(), this.receiver.toString()].sort();
  return participants.join('_');
});

// Method to mark as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Method to get message without sensitive data
messageSchema.methods.toJSON = function() {
  const message = this.toObject();
  delete message.__v;
  return message;
};

// Static method to get conversation between two users
messageSchema.statics.getConversation = function(user1Id, user2Id, limit = 50, offset = 0) {
  return this.find({
    $or: [
      { sender: user1Id, receiver: user2Id },
      { sender: user2Id, receiver: user1Id },
    ],
    deleted: false,
  })
    .sort({ timestamp: -1 })
    .skip(offset)
    .limit(limit)
    .populate('sender', 'username profilePicture')
    .populate('receiver', 'username profilePicture')
    .lean();
};

// Static method to get unread messages count
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    deleted: false,
  });
};

const Message = mongoose.model('Message', messageSchema);

export default Message;