require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const UserService = require('../api/services/UserService');
const { hashPassword } = require('../api/utils/password');
const { initializeDatabase } = require('../api/utils/dbInit');

/**
 * Seed initial users into the database
 * Run this script to create initial admin users
 */
async function seedUsers() {
  try {
    // Initialize database first
    await initializeDatabase();

    const usersToSeed = [
      {
        username: 'admin',
        email: 'admin@aerekos.cloud',
        password_hash: await hashPassword('admin'), // Default password: admin
        role: 'admin'
      }
      // Add more users here as needed
    ];

    console.log('Seeding users...');

    for (const userData of usersToSeed) {
      try {
        const user = await UserService.createUser(userData);
        console.log(`✓ Created user: ${user.username} (${user.email})`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`- User ${userData.username} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('User seeding completed!');
    
    // Only exit if called directly (not when imported)
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error seeding users:', error);
    // Only exit if called directly (not when imported)
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error; // Re-throw if called from another module
    }
  }
}

// Run if called directly
if (require.main === module) {
  seedUsers();
}

module.exports = { seedUsers };
