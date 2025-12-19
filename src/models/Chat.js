import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  isGroup: {
    type: Boolean,
    default: false,
  },
  groupName: {
    type: String,
    trim: true,
  },
  groupDescription: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  groupPhoto: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  mutedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  archivedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  customSettings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
chatSchema.index({ participants: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ isGroup: 1 });
chatSchema.index({ 'participants': 1, 'lastActivity': -1 });

// Pre-save middleware to sort participants for consistency
chatSchema.pre('save', function(next) {
  if (this.participants && this.participants.length > 0) {
    this.participants.sort();
  }
  this.updatedAt = Date.now();
  next();
});

// Method to check if user is participant
chatSchema.methods.isParticipant = function(userId) {
  return this.participants.includes(userId);
};

// Method to add participant
chatSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    this.participants.sort();
  }
  return this.save();
};

// Method to remove participant
chatSchema.methods.removeParticipant = function(userId) {
  const index = this.participants.indexOf(userId);
  if (index > -1) {
    this.participants.splice(index, 1);
  }
  return this.save();
};

// Method to update last message
chatSchema.methods.updateLastMessage = function(messageId) {
  this.lastMessage = messageId;
  this.lastActivity = new Date();
  return this.save();
};

// Method to mute chat for user
chatSchema.methods.muteForUser = function(userId) {
  if (!this.mutedBy.includes(userId)) {
    this.mutedBy.push(userId);
  }
  return this.save();
};

// Method to unmute chat for user
chatSchema.methods.unmuteForUser = function(userId) {
  const index = this.mutedBy.indexOf(userId);
  if (index > -1) {
    this.mutedBy.splice(index, 1);
  }
  return this.save();
};

// Static method to find or create chat between users
chatSchema.statics.findOrCreate = async function(user1Id, user2Id) {
  const participants = [user1Id, user2Id].sort();
  
  let chat = await this.findOne({
    participants: { $all: participants },
    isGroup: false,
  }).populate('participants', 'username profilePicture status');

  if (!chat) {
    chat = await this.create({
      participants,
      isGroup: false,
    });
    
    // Populate after creation
    chat = await this.findById(chat._id)
      .populate('participants', 'username profilePicture status');
  }

  return chat;
};

// Static method to get user chats
chatSchema.statics.getUserChats = function(userId, limit = 50, offset = 0) {
  return this.find({
    participants: userId,
    archivedBy: { $ne: userId },
  })
    .sort({ lastActivity: -1 })
    .skip(offset)
    .limit(limit)
    .populate('participants', 'username profilePicture status')
    .populate('lastMessage')
    .populate('createdBy', 'username profilePicture')
    .lean();
};

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;