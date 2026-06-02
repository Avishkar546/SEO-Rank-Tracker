import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Authenticate JWT token and validate user
 * Attaches userId to req.user.userId
 * Implements token refresh logic
 * Logs authentication events
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Authentication failed: No token provided', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.split(" ")[1]; // Remove "Bearer " prefix
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      // Check if token is expired
      if (error.name === 'TokenExpiredError') {
        console.warn('Authentication failed: Token expired', {
          email: error.expiredAt ? 'token-expired' : 'unknown',
          ip: req.ip,
          method: req.method,
          path: req.path,
          timestamp: new Date().toISOString(),
        });
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please login again',
        });
      }

      // Invalid or malformed token
      console.warn('Authentication failed: Invalid token', {
        ip: req.ip,
        method: req.method,
        path: req.path,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }

    // Verify user exists in database
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.warn('Authentication failed: User not found', {
        userId: decoded.userId,
        email: decoded.email,
        ip: req.ip,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString(),
      });
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user account is active/verified (optional)
    // if (user.isBlocked || !user.isActive) {
    //   console.warn('Authentication failed: User account inactive', {
    //     userId: decoded.userId,
    //     email: decoded.email,
    //     isBlocked: user.isBlocked,
    //     isActive: user.isActive,
    //     ip: req.ip,
    //     method: req.method,
    //     path: req.path,
    //     timestamp: new Date().toISOString(),
    //   });
    //   return res.status(403).json({
    //     success: false,
    //     message: 'User account is not active',
    //   });
    // }

    // Attach userId to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    // Token Refresh Logic: Check if token is nearing expiration
    const currentTime = Math.floor(Date.now() / 1000);
    const tokenExpiresIn = decoded.exp - currentTime;
    const refreshThresholdSeconds = JWT_REFRESH_THRESHOLD / 1000;

    if (tokenExpiresIn < refreshThresholdSeconds) {
      // Generate new token before old one expires
      const newPayload = {
        userId: decoded.userId,
        email: decoded.email,
      };
      const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '7d' });

      // Attach new token to response headers
      res.set('X-New-Token', newToken);

      console.info('Token refreshed for user', {
        userId: decoded.userId,
        email: decoded.email,
        timestamp: new Date().toISOString(),
      });
    }

    // Log successful authentication
    console.info('Authentication successful', {
      userId: decoded.userId,
      email: decoded.email,
      method: req.method,
      path: req.path,
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);

    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * Optional: Check if user has specific role
 * (For future use when implementing role-based access control)
 */
export const authorize = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check role if required roles are specified
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        console.warn('Authorization failed: Insufficient permissions', {
          userId: req.user.userId,
          userRole: user.role,
          requiredRoles,
          method: req.method,
          path: req.path,
          timestamp: new Date().toISOString(),
        });
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);

      res.status(500).json({
        success: false,
        message: 'Authorization error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  };
};
