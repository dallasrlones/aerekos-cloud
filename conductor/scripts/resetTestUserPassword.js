require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const UserRepository = require('../api/repos/UserRepository');
const { hashPassword } = require('../api/utils/password');
const { initializeDatabase } = require('../api/utils/dbInit');

/**
 * Reset test user password
 */
async function resetTestUserPassword() {
  try {
    // Initialize database first
    await initializeDatabase();

    console.log('Resetting test user password...');

    const user = await UserRepository.findByUsername('test');
    if (!user) {
      console.log('User "test" not found. Creating it...');
      const newUser = await UserRepository.create({
        username: 'test',
        email: 'test@aerekos.cloud',
        password_hash: await hashPassword('test123'),
        role: 'user'
      });
      console.log(`✓ Created user: ${newUser.username}`);
    } else {
      console.log(`Found user: ${user.username}`);
      const newPasswordHash = await hashPassword('test123');
      await UserRepository.update(user.id, {
        password_hash: newPasswordHash
      });
      console.log(`✓ Password reset for user: ${user.username}`);
    }

    console.log('Password reset completed!');
    console.log('Username: test');
    console.log('Password: test123');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

resetTestUserPassword();
