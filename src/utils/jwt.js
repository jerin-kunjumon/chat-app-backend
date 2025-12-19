import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from './logger.js';

// Generate JWT token
const generateToken = (userId, expiresIn = '7d') => {
  try {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn }
    );
  } catch (error) {
    logger.error('Error generating token:', error);
    throw new Error('Failed to generate authentication token');
  }
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  try {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
};

// Verify JWT token
const verifyToken = (token, isRefresh = false) => {
  try {
    const secret = isRefresh ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
    return jwt.verify(token, secret);
  } catch (error) {
    logger.error('Error verifying token:', error);
    
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    
    throw new Error('Token verification failed');
  }
};

// Generate password reset token
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash password reset token (for storage)
const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate email verification token
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Decode token without verification (for inspection)
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error('Error decoding token:', error);
    return null;
  }
};

// Check if token is about to expire (within threshold)
const isTokenExpiringSoon = (token, thresholdMinutes = 15) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return false;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - currentTime;
    const thresholdSeconds = thresholdMinutes * 60;
    
    return timeUntilExpiry <= thresholdSeconds;
  } catch (error) {
    logger.error('Error checking token expiry:', error);
    return false;
  }
};

// Generate API key (for machine-to-machine authentication)
const generateApiKey = () => {
  const prefix = 'sk_chat_';
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return prefix + randomBytes;
};

// Generate short-lived token for specific operations
const generateShortLivedToken = (userId, purpose, expiresIn = '5m') => {
  try {
    return jwt.sign(
      { userId, purpose },
      process.env.JWT_SECRET,
      { expiresIn }
    );
  } catch (error) {
    logger.error('Error generating short-lived token:', error);
    throw new Error('Failed to generate operation token');
  }
};

export {
  generateToken,
  generateRefreshToken,
  verifyToken,
  generatePasswordResetToken,
  hashResetToken,
  generateEmailVerificationToken,
  decodeToken,
  isTokenExpiringSoon,
  generateApiKey,
  generateShortLivedToken,
};