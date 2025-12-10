require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const UserRepository = require('../api/repos/UserRepository');
const { hashPassword } = require('../api/utils/password');
const { initializeDatabase } = require('../api/utils/dbInit');

/**
 * Reset admin user password to 'admin'
 */
async function resetAdminPassword() {
  try {
    // Initialize database first
    await initializeDatabase();

    console.log('Resetting admin password...');

    // Find admin user
    const adminUser = await UserRepository.findByUsername('admin');
    
    if (!adminUser) {
      console.log('Admin user not found. Creating admin user...');
      const UserService = require('../api/services/UserService');
      await UserService.createUser({
        username: 'admin',
        email: 'admin@aerekos.cloud',
        password_hash: await hashPassword('admin'),
        role: 'admin'
      });
      console.log('✓ Admin user created with password: admin');
    } else {
      // Update password
      const newPasswordHash = await hashPassword('admin');
      await UserRepository.update(adminUser.id, {
        password_hash: newPasswordHash
      });
      console.log('✓ Admin password reset to: admin');
    }

    console.log('Password reset completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  resetAdminPassword();
}

module.exports = { resetAdminPassword };
