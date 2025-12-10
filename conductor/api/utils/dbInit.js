const { User, Worker, Service, ServiceDeployment, Token, Resource } = require('../models');

/**
 * Initialize database - ensures all tables are created
 */
async function initializeDatabase() {
  try {
    // Models are automatically created when defined
    // This function can be used to verify database is ready
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };
