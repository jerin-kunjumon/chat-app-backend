import express from 'express';
import authController from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../utils/validators.js';
import { userValidation } from '../utils/validators.js';

const router = express.Router();

// Public routes
router.post(
  '/register',
  validate(userValidation.register),
  authController.register
);

router.post(
  '/login',
  validate(userValidation.login),
  authController.login
);

router.post(
  '/refresh-token',
  validate(userValidation.refreshToken),
  authController.refreshToken
);

router.post(
  '/forgot-password',
  validate(userValidation.forgotPassword),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate(userValidation.resetPassword),
  authController.resetPassword
);

// Protected routes (require authentication)
router.use(auth);

router.post('/logout', authController.logout);
router.get('/profile', authController.getProfile);

router.put(
  '/profile',
  validate(userValidation.updateProfile),
  authController.updateProfile
);

router.put(
  '/change-password',
  validate(userValidation.changePassword),
  authController.changePassword
);

router.post(
  '/deactivate',
  validate(userValidation.deactivateAccount),
  authController.deactivateAccount
);

export default router;