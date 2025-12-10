const UserRepository = require('../repos/UserRepository');
const JWTService = require('./JWTService');
const { comparePassword, hashPassword } = require('../utils/password');

/**
 * User Service - Business logic for user operations
 */
class UserService {
  constructor(userRepository, jwtService) {
    this.userRepository = userRepository;
    this.jwtService = jwtService;
  }

  /**
   * Authenticate user with username and password
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} Object with token and user info
   * @throws {Error} If credentials are invalid
   */
  async authenticate(username, password) {
    const user = await this.userRepository.findByUsername(username);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      throw new Error('Invalid credentials');
    }

    const token = this.jwtService.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  }

  /**
   * Get current user by ID
   * @param {string} userId
   * @returns {Promise<object>} User object
   * @throws {Error} If user not found
   */
  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }

  /**
   * Create a new user (for seeding)
   * @param {object} userData - User data
   * @returns {Promise<object>} Created user
   */
  async createUser(userData) {
    // Check if user already exists
    const existingUser = await this.userRepository.findByUsername(userData.username);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const existingEmail = await this.userRepository.findByEmail(userData.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    return await this.userRepository.create(userData);
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password for verification
   * @param {string} newPassword - New password
   * @returns {Promise<object>} Updated user info
   * @throws {Error} If current password is invalid or user not found
   */
  async updatePassword(userId, currentPassword, newPassword) {
    // Get user
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const passwordMatch = await comparePassword(currentPassword, user.password_hash);
    
    if (!passwordMatch) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await this.userRepository.update(userId, {
      password_hash: newPasswordHash
    });

    // Return updated user info (without password hash)
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
  }

  /**
   * Update user profile (username and/or email)
   * @param {string} userId - User ID
   * @param {object} profileData - Profile data (username, email)
   * @returns {Promise<object>} Updated user info
   * @throws {Error} If username/email already exists or user not found
   */
  async updateProfile(userId, profileData) {
    // Get user
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const updateData = {};

    // Validate and check username if provided
    if (profileData.username !== undefined) {
      const trimmedUsername = profileData.username.trim();
      
      if (!trimmedUsername) {
        throw new Error('Username cannot be empty');
      }

      if (trimmedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }

      // Check if username is different and not already taken
      if (trimmedUsername !== user.username) {
        const existingUser = await this.userRepository.findByUsername(trimmedUsername);
        if (existingUser) {
          throw new Error('Username already exists');
        }
        updateData.username = trimmedUsername;
      }
    }

    // Validate and check email if provided
    if (profileData.email !== undefined) {
      const trimmedEmail = profileData.email.trim();
      
      if (!trimmedEmail) {
        throw new Error('Email cannot be empty');
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        throw new Error('Invalid email format');
      }

      // Check if email is different and not already taken
      if (trimmedEmail !== user.email) {
        const existingEmail = await this.userRepository.findByEmail(trimmedEmail);
        if (existingEmail) {
          throw new Error('Email already exists');
        }
        updateData.email = trimmedEmail;
      }
    }

    // If no changes, return current user
    if (Object.keys(updateData).length === 0) {
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
    }

    // Update user
    await this.userRepository.update(userId, updateData);

    // Get updated user
    const updatedUser = await this.userRepository.findById(userId);

    // Return updated user info
    return {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role
    };
  }
}

module.exports = new UserService(UserRepository, JWTService);
