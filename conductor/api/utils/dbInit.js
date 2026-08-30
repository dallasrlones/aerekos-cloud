const { User, Worker, Service, Project, ProjectWorker, ProjectService, ServiceDeployment, Token, Resource } = require('../models');

/**
 * Initialize database - ensures all tables are created
 */
async function initializeDatabase() {
  try {
    require('../store/ConductorStore').createConductorStore();
    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

module.exports = { initializeDatabase };
