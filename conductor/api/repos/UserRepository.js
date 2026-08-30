const { User } = require('../models');

/**
 * User Repository - Database operations for users
 */
class UserRepository {
  /**
   * Find user by username
   * @param {string} username
   * @returns {Promise<object|null>} User object or null
   */
  async findByUsername(username) {
    const users = await User.findAll({ where: { username } });
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find user by ID
   * @param {string} id
   * @returns {Promise<object|null>} User object or null
   */
  async findById(id) {
    const users = await User.findAll({ where: { id } });
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Find user by email
   * @param {string} email
   * @returns {Promise<object|null>} User object or null
   */
  async findByEmail(email) {
    const users = await User.findAll({ where: { email } });
    return users.length > 0 ? users[0] : null;
  }

  /**
   * Create a new user
   * @param {object} userData - User data (username, password_hash, email, role)
   * @returns {Promise<object>} Created user
   */
  async create(userData) {
    return await User.create(userData);
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {object} userData - Updated user data
   * @returns {Promise<object>} Updated user
   */
  async update(id, userData) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return await User.update(id, userData);
  }

  /**
   * Get all users
   * @returns {Promise<Array>} Array of users
   */
  async findAll() {
    return await User.findAll();
  }
}

module.exports = new UserRepository();
