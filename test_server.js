const { initDatabase, dbGet, dbAll, dbRun } = require('./database');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('--- STARTING AUTOMATED SANITY TESTS FOR DATABASE & SCHEMA ---');

  try {
    // 1. Initialize DB and tables
    await initDatabase();
    console.log('✅ Database initialization successful.');

    // 2. Validate Seeded Accounts
    const admin = await dbGet('SELECT * FROM users WHERE role = ?', ['admin']);
    if (admin && admin.username === 'admin') {
      console.log('✅ Pre-seeded admin account found.');
    } else {
      throw new Error('Pre-seeded admin account missing or invalid.');
    }

    const vendor = await dbGet('SELECT * FROM users WHERE role = ?', ['vendor']);
    if (vendor && vendor.username === 'vendor1') {
      console.log('✅ Pre-seeded vendor account found.');
    } else {
      throw new Error('Pre-seeded vendor account missing or invalid.');
    }

    const user = await dbGet('SELECT * FROM users WHERE role = ?', ['user']);
    if (user && user.username === 'user1') {
      console.log('✅ Pre-seeded user account found.');
    } else {
      throw new Error('Pre-seeded user account missing or invalid.');
    }

    // Validate Password Comparison
    const adminPassMatch = bcrypt.compareSync('admin123', admin.password);
    if (adminPassMatch) {
      console.log('✅ Password hash verified for seeded accounts.');
    } else {
      throw new Error('Failed to match password hash for seeded accounts.');
    }

    // 3. Validate Seeded Places
    const places = await dbAll('SELECT * FROM vendor_places');
    if (places.length > 0) {
      console.log(`✅ Pre-seeded places verified (${places.length} places loaded).`);
      console.log(`   Sample venue: "${places[0].place_name}" at "${places[0].location}" ($${places[0].amount})`);
    } else {
      throw new Error('No pre-seeded places found.');
    }

    // 4. Test User Registration Logic (mock insert)
    const testUsername = 'test_user_' + Date.now();
    const testEmail = `test_${Date.now()}@test.com`;
    const hashedPass = bcrypt.hashSync('testpass123', 10);

    const regResult = await dbRun(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [testUsername, testEmail, hashedPass, 'user']
    );
    const registeredUser = await dbGet('SELECT * FROM users WHERE id = ?', [regResult.lastID]);

    if (registeredUser && registeredUser.username === testUsername) {
      console.log(`✅ User registration simulation succeeded (User ID: ${regResult.lastID}).`);
    } else {
      throw new Error('Failed to retrieve registered user.');
    }

    // Test duplicate username/email constraint
    try {
      await dbRun(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [testUsername, 'other@test.com', hashedPass, 'user']
      );
      throw new Error('Failed: Duplicate username constraint was bypassed.');
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        console.log('✅ UNIQUE constraint validation verified (Duplicate username blocked).');
      } else {
        throw err;
      }
    }

    // Clean up test user
    await dbRun('DELETE FROM users WHERE id = ?', [regResult.lastID]);
    console.log('✅ Test user cleaned up.');

    console.log('\n======================================');
    console.log('🎉 ALL SANITY TESTS COMPLETED SUCCESSFULLY!');
    console.log('======================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILURE:');
    console.error(err.message || err);
    console.log('======================================\n');
    process.exit(1);
  }
}

runTests();
