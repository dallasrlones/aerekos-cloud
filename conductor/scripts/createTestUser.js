require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const UserService = require('../api/services/UserService');
const { hashPassword } = require('../api/utils/password');
const { initializeDatabase } = require('../api/utils/dbInit');

/**
 * Create test user
 */
async function createTestUser() {
  try {
    // Initialize database first
    await initializeDatabase();

    const userData = {
      username: 'test',
      email: 'test@aerekos.cloud',
      password_hash: await hashPassword('test123'),
      role: 'user'
    };

    console.log('Creating test user...');

    try {
      const user = await UserService.createUser(userData);
      console.log(`✓ Created user: ${user.username} (${user.email})`);
      console.log(`  Username: test`);
      console.log(`  Password: test123`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`- User 'test' already exists`);
        console.log(`  If you want to reset the password, delete the user first or update it manually`);
      } else {
        throw error;
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();
