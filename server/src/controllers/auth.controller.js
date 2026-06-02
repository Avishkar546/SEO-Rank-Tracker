import bcrypt from 'bcrypt';
import User from '../models/user.model.js';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

const generateJWT = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}
/**
 * Register a new user
 * @route POST /api/auth/register
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - User data and JWT token
 */
export const register = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { email, password, name } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      name,
      email,
      password: hashedPassword,
    });

    // Save user to database
    await user.save();

    // Generate JWT token
    const payload = {
      userId: user._id,
      email: user.email,
    };

    const token = generateJWT(payload);

    // Send response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        token,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate field error',
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Login a user
 * @route POST /api/auth/login
 * @param {Object} req - Express request object
 * @param {string} req.body.email - User email
 * @param {string} req.body.password - User password
 * @param {Object} res - Express response object
 * @returns {Object} - User data and JWT token
 */
export const login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Use generic message for security (don't reveal if email exists)
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Compare passwords
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      // Use generic message for security (don't reveal which field is incorrect)
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const payload = {
      userId: user._id,
      email: user.email,
    };

    const token = generateJWT(payload);

    // Send response
    res.status(200).json({
      success: true,
      message: 'User logged in successfully',
      data: {
        userId: user._id,
        email: user.email,
        name: user.name,
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Get user profile
 * @route GET /api/auth/user
 * @param {Object} req - Express request object (with authenticated user)
 * @param {Object} res - Express response object
 * @returns {Object} - User profile data
 * @middleware authenticateJWT - Required to verify JWT token
 */
export const getUser = async (req, res) => {
  try {
    // userId is attached by authenticateJWT middleware
    const { userId } = req.user;

    // Fetch user from database
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Send user profile
    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);

    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};


