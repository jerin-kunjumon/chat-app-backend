import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyToken,
  generatePasswordResetToken,
  hashResetToken
} from '../utils/jwt.js';
import logger from '../utils/logger.js';
import { userValidation } from '../utils/validators.js';

// Register new user
export const register = async (req, res) => {
  try {
    const { username, email, password, profilePicture, bio } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        error: existingUser.email === email 
          ? 'Email already registered' 
          : 'Username already taken',
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      profilePicture,
      bio,
    });

    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Log registration
    logger.info(`User registered: ${user.username} (${user._id})`, {
      userId: user._id,
      email: user.email,
    });

    // Return user data and tokens
    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        status: user.status,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed. Please try again.',
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by email or username
    const user = await User.findByEmailOrUsername(identifier).select('+password');

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account is deactivated. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
      });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Log login
    logger.info(`User logged in: ${user.username} (${user._id})`, {
      userId: user._id,
      email: user.email,
    });

    // Return user data and tokens
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed. Please try again.',
    });
  }
};

// Refresh access token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, true);
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        error: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account is deactivated',
      });
    }

    // Generate new access token
    const newAccessToken = generateToken(user._id);

    res.json({
      accessToken: newAccessToken,
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    
    if (error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Refresh token has expired',
      });
    }
    
    res.status(401).json({
      error: 'Invalid refresh token',
    });
  }
};

// Logout user
export const logout = async (req, res) => {
  try {

    
    const user = req.user;
    
    if (user) {
      // Update user status to offline
      await User.findByIdAndUpdate(user._id, {
        status: 'offline',
        lastSeen: new Date(),
      });

      logger.info(`User logged out: ${user.username} (${user._id})`);
    }

    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.json({
      user,
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user._id;

    // Check if username/email is being changed and if it's available
    if (updates.username || updates.email) {
      const existingUser = await User.findOne({
        $or: [
          ...(updates.username ? [{ username: updates.username }] : []),
          ...(updates.email ? [{ email: updates.email }] : []),
        ],
        _id: { $ne: userId },
      });

      if (existingUser) {
        const conflictField = existingUser.email === updates.email ? 'email' : 'username';
        return res.status(400).json({
          error: `${conflictField} already taken`,
        });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    logger.info(`User profile updated: ${user.username} (${user._id})`);

    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
    });
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        error: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.username} (${user._id})`);

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      error: 'Failed to change password',
    });
  }
};

// Forgot password - initiate password reset
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, you will receive a password reset link',
      });
    }

    
    const resetToken = generatePasswordResetToken();
    const hashedToken = hashResetToken(resetToken);

    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    
    logger.info(`Password reset requested for: ${user.email}`, {
      userId: user._id,
      resetUrl,
    });

    
    console.log(`Password reset URL for ${user.email}: ${resetUrl}`);

    res.json({
      message: 'If an account exists with this email, you will receive a password reset link',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Failed to process password reset request',
    });
  }
};

// Reset password with token
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    
    const hashedToken = hashResetToken(token);

    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
      });
    }

    // Update password and clear reset token
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    

    logger.info(`Password reset successful for user: ${user.username} (${user._id})`);

    res.json({
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password',
    });
  }
};

// Deactivate account
export const deactivateAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    // Get user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(400).json({
        error: 'Password is incorrect',
      });
    }

    // Deactivate account
    user.isActive = false;
    user.status = 'offline';
    await user.save();

    logger.info(`Account deactivated: ${user.username} (${user._id})`);

    res.json({
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    logger.error('Deactivate account error:', error);
    res.status(500).json({
      error: 'Failed to deactivate account',
    });
  }
};


export default {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deactivateAccount,
};