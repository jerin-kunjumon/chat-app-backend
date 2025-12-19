import Joi from 'joi';

// User validation schemas
const userValidation = {
  // Registration validation
  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .required()
      .pattern(/^[a-zA-Z0-9_]+$/)
      .messages({
        'string.pattern.base': 'Username can only contain letters, numbers, and underscores',
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username cannot exceed 30 characters',
        'any.required': 'Username is required',
      }),
    
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    
    password: Joi.string()
      .min(6)
      .max(100)
      .required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'Password is required',
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Please confirm your password',
      }),
    
    profilePicture: Joi.string()
      .uri()
      .optional(),
    
    bio: Joi.string()
      .max(200)
      .optional(),
  }),

  // Login validation
  login: Joi.object({
    identifier: Joi.string()
      .required()
      .messages({
        'any.required': 'Email or username is required',
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required',
      }),
  }),

  // Update profile validation
  updateProfile: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .optional(),
    
    email: Joi.string()
      .email()
      .optional(),
    
    profilePicture: Joi.string()
      .uri()
      .optional(),
    
    bio: Joi.string()
      .max(200)
      .optional(),
    
    status: Joi.string()
      .valid('online', 'offline', 'away', 'busy')
      .optional(),
  }),

  // Change password validation
  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required',
      }),
    
    newPassword: Joi.string()
      .min(6)
      .max(100)
      .required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        'string.min': 'New password must be at least 6 characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'New password is required',
      }),
    
    confirmNewPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.only': 'New passwords do not match',
        'any.required': 'Please confirm your new password',
      }),
  }),

  // Forgot password validation
  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
  }),

  // Reset password validation
  resetPassword: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'any.required': 'Reset token is required',
      }),
    
    password: Joi.string()
      .min(6)
      .max(100)
      .required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'Password is required',
      }),
    
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'any.required': 'Please confirm your password',
      }),
  }),
};

// Message validation schemas
const messageValidation = {
  // Send message validation
  sendMessage: Joi.object({
    to: Joi.string()
      .required()
      .messages({
        'any.required': 'Recipient ID is required',
      }),
    
    content: Joi.string()
      .required()
      .max(5000)
      .messages({
        'any.required': 'Message content is required',
        'string.max': 'Message cannot exceed 5000 characters',
      }),
    
    messageType: Joi.string()
      .valid('text', 'image', 'file', 'audio')
      .default('text'),
    
    mediaUrl: Joi.string()
      .uri()
      .optional(),
    
    chatId: Joi.string()
      .optional(),
  }),

  // Get messages validation
  getMessages: Joi.object({
    userId: Joi.string()
      .required()
      .messages({
        'any.required': 'User ID is required',
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(50),
    
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0),
    
    before: Joi.date()
      .optional(),
    
    after: Joi.date()
      .optional(),
  }),

  // Update message validation
  updateMessage: Joi.object({
    content: Joi.string()
      .required()
      .max(5000)
      .messages({
        'any.required': 'Message content is required',
        'string.max': 'Message cannot exceed 5000 characters',
      }),
  }),

  // Typing indicator validation
  typing: Joi.object({
    to: Joi.string()
      .required()
      .messages({
        'any.required': 'Recipient ID is required',
      }),
    
    isTyping: Joi.boolean()
      .required()
      .messages({
        'any.required': 'Typing status is required',
      }),
  }),
};

// Chat validation schemas
const chatValidation = {
  // Create chat validation
  createChat: Joi.object({
    participants: Joi.array()
      .items(Joi.string())
      .min(2)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least 2 participants are required',
        'array.max': 'Cannot exceed 100 participants',
        'any.required': 'Participants are required',
      }),
    
    isGroup: Joi.boolean()
      .default(false),
    
    groupName: Joi.string()
      .min(1)
      .max(100)
      .when('isGroup', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .messages({
        'any.required': 'Group name is required for group chats',
      }),
    
    groupDescription: Joi.string()
      .max(500)
      .optional(),
    
    groupPhoto: Joi.string()
      .uri()
      .optional(),
  }),

  // Update chat validation
  updateChat: Joi.object({
    groupName: Joi.string()
      .min(1)
      .max(100)
      .optional(),
    
    groupDescription: Joi.string()
      .max(500)
      .optional(),
    
    groupPhoto: Joi.string()
      .uri()
      .optional(),
    
    customSettings: Joi.object()
      .optional(),
  }),

  // Add participant validation
  addParticipant: Joi.object({
    userId: Joi.string()
      .required()
      .messages({
        'any.required': 'User ID is required',
      }),
  }),

  // Get chats validation
  getChats: Joi.object({
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(50),
    
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0),
    
    archived: Joi.boolean()
      .default(false),
  }),
};

// Validation middleware
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    next();
  };
};

// Custom validators
const isValidObjectId = (value, helpers) => {
  if (!/^[0-9a-fA-F]{24}$/.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const isValidUsername = (value, helpers) => {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

const isValidEmail = (value, helpers) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Export all validators
export {
  userValidation,
  messageValidation,
  chatValidation,
  validate,
  isValidObjectId,
  isValidUsername,
  isValidEmail,
};