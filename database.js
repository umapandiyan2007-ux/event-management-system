const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'event_management.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Helper functions to wrap sqlite3 in Promises
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // returns 'this' which contains lastID and changes
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  console.log('Initializing database tables...');

  // 1. Users Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'vendor', 'admin')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Vendor Places Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS vendor_places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id INTEGER NOT NULL,
      place_name TEXT NOT NULL,
      event_types TEXT NOT NULL, -- Comma-separated list of event types supported
      location TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(vendor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. User Requests Table (Custom needs submitted by users)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS user_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      location TEXT NOT NULL,
      budget REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'connected', 'paid', 'completed')),
      assigned_place_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(assigned_place_id) REFERENCES vendor_places(id) ON DELETE SET NULL
    )
  `);

  // 4. Bookings Table (Direct bookings & connections)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      place_id INTEGER NOT NULL,
      request_id INTEGER, -- If booked via a user request match
      event_type TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(place_id) REFERENCES vendor_places(id) ON DELETE CASCADE,
      FOREIGN KEY(request_id) REFERENCES user_requests(id) ON DELETE SET NULL
    )
  `);

  // Seed default accounts if they do not exist
  await seedDefaultData();
}

async function seedDefaultData() {
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const vendorPassword = bcrypt.hashSync('vendor123', 10);
  const userPassword = bcrypt.hashSync('user123', 10);

  // Seed Admin
  try {
    await dbRun(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@evently.com', adminPassword, 'admin']
    );
    console.log('Seeded default administrator.');
  } catch (err) {
    // Expected error if already exists
  }

  // Seed Vendor
  let vendorId;
  try {
    const result = await dbRun(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['vendor1', 'vendor1@evently.com', vendorPassword, 'vendor']
    );
    vendorId = result.lastID;
    console.log('Seeded default vendor (vendor1).');
  } catch (err) {
    // If user exists, get the ID
    const row = await dbGet('SELECT id FROM users WHERE username = ?', ['vendor1']);
    if (row) vendorId = row.id;
  }

  // Seed User
  let userId;
  try {
    const result = await dbRun(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['user1', 'user1@evently.com', userPassword, 'user']
    );
    userId = result.lastID;
    console.log('Seeded default user (user1).');
  } catch (err) {
    const row = await dbGet('SELECT id FROM users WHERE username = ?', ['user1']);
    if (row) userId = row.id;
  }

  // Seed Dummy Vendor Places if empty
  if (vendorId) {
    const placeCount = await dbGet('SELECT COUNT(*) as count FROM vendor_places');
    if (placeCount.count === 0) {
      await dbRun(
        'INSERT INTO vendor_places (vendor_id, place_name, event_types, location, amount) VALUES (?, ?, ?, ?, ?)',
        [vendorId, 'Sunset Garden Villa', 'Wedding, Birthday, Reunion', 'California, USA', 1500.00]
      );
      await dbRun(
        'INSERT INTO vendor_places (vendor_id, place_name, event_types, location, amount) VALUES (?, ?, ?, ?, ?)',
        [vendorId, 'Grand Ballroom', 'Conference, Corporate, Gala', 'New York, USA', 3000.00]
      );
      await dbRun(
        'INSERT INTO vendor_places (vendor_id, place_name, event_types, location, amount) VALUES (?, ?, ?, ?, ?)',
        [vendorId, 'Metro Rooftop Lounge', 'Birthday, Anniversary, Cocktail Party', 'Boston, USA', 800.00]
      );
      console.log('Seeded default vendor places.');
    }
  }

  // Seed a dummy user request and booking for demonstration if database is empty
  if (userId) {
    const reqCount = await dbGet('SELECT COUNT(*) as count FROM user_requests');
    if (reqCount.count === 0) {
      await dbRun(
        'INSERT INTO user_requests (user_id, event_type, location, budget, date, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, 'Birthday', 'Boston, USA', 1000.00, '2026-07-15', 'Need a rooftop venue for 50 people.', 'pending']
      );
      console.log('Seeded default user custom request.');
    }
  }
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDatabase
};
