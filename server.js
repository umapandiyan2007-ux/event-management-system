const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const {
  initDatabase,
  dbRun,
  dbGet,
  dbAll
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'evently_antigravity_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Helper Middleware
function requireAuth(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized. Please log in.' });
    }
    if (role && req.session.user.role !== role) {
      return res.status(403).json({ error: `Forbidden. Requires ${role} role.` });
    }
    next();
  };
}

// Initialize Database before starting server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// --- AUTHENTICATION API ---

// 1. Register User / Vendor
app.post('/api/register', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (role !== 'user' && role !== 'vendor') {
    return res.status(400).json({ error: 'Invalid role selection. Only User or Vendor can register.' });
  }

  try {
    // Check if user or email already exists
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    await dbRun(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'Registration successful! Please log in.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. Login User / Vendor / Admin
app.post('/api/login', async (req, res) => {
  const { loginId, password, role } = req.body; // loginId can be username or email

  if (!loginId || !password || !role) {
    return res.status(400).json({ error: 'Login ID, password, and role selection are required.' });
  }

  try {
    // Find user by username or email and verify role
    const user = await dbGet(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND role = ?',
      [loginId, loginId, role]
    );

    if (!user) {
      return res.status(400).json({ error: 'Invalid username, email, or role selection.' });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Incorrect password.' });
    }

    // Save to session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out. Try again.' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful!' });
  });
});

// 4. Get Current User Info
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

// --- USER DASHBOARD API ---

// Search & Filter Vendor Places
app.get('/api/places', requireAuth('user'), async (req, res) => {
  const { search, type, location, minPrice, maxPrice } = req.query;

  let query = 'SELECT p.*, u.username as vendor_name FROM vendor_places p JOIN users u ON p.vendor_id = u.id WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (p.place_name LIKE ? OR p.location LIKE ? OR p.event_types LIKE ?)';
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (type) {
    query += ' AND p.event_types LIKE ?';
    params.push(`%${type}%`);
  }

  if (location) {
    query += ' AND p.location LIKE ?';
    params.push(`%${location}%`);
  }

  if (minPrice) {
    query += ' AND p.amount >= ?';
    params.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    query += ' AND p.amount <= ?';
    params.push(parseFloat(maxPrice));
  }

  try {
    const places = await dbAll(query, params);
    res.json(places);
  } catch (err) {
    console.error('Fetch places error:', err);
    res.status(500).json({ error: 'Failed to search places.' });
  }
});

// Create Direct Booking
app.post('/api/bookings', requireAuth('user'), async (req, res) => {
  const { place_id, event_type, booking_date } = req.body;
  const user_id = req.session.user.id;

  if (!place_id || !event_type || !booking_date) {
    return res.status(400).json({ error: 'Place ID, event type, and booking date are required.' });
  }

  try {
    // Fetch place details
    const place = await dbGet('SELECT amount FROM vendor_places WHERE id = ?', [place_id]);
    if (!place) {
      return res.status(404).json({ error: 'Venue place not found.' });
    }

    const result = await dbRun(
      'INSERT INTO bookings (user_id, place_id, event_type, booking_date, amount, payment_status) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, place_id, event_type, booking_date, place.amount, 'pending']
    );

    res.status(201).json({
      message: 'Booking created successfully! Please proceed to payment.',
      bookingId: result.lastID
    });
  } catch (err) {
    console.error('Booking creation error:', err);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
});

// Pay Booking (Mock Payment)
app.post('/api/pay-booking', requireAuth('user'), async (req, res) => {
  const { booking_id, card_number, expiry, cvv } = req.body;

  if (!booking_id || !card_number || !expiry || !cvv) {
    return res.status(400).json({ error: 'Payment details are incomplete.' });
  }

  try {
    // Verify booking belongs to user
    const booking = await dbGet(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?',
      [booking_id, req.session.user.id]
    );

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found or access denied.' });
    }

    // Update payment status
    await dbRun('UPDATE bookings SET payment_status = ? WHERE id = ?', ['paid', booking_id]);

    // If this booking is connected to a custom user request, update the user request status to 'paid'
    if (booking.request_id) {
      await dbRun('UPDATE user_requests SET status = ? WHERE id = ?', ['paid', booking.request_id]);
    }

    res.json({ message: 'Payment completed successfully! Booking confirmed.' });
  } catch (err) {
    console.error('Payment processing error:', err);
    res.status(500).json({ error: 'Failed to process payment.' });
  }
});

// Get User Bookings
app.get('/api/user/bookings', requireAuth('user'), async (req, res) => {
  try {
    const bookings = await dbAll(`
      SELECT b.*, p.place_name, p.location, p.amount as place_amount, u.username as vendor_name
      FROM bookings b
      JOIN vendor_places p ON b.place_id = p.id
      JOIN users u ON p.vendor_id = u.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `, [req.session.user.id]);
    res.json(bookings);
  } catch (err) {
    console.error('Fetch user bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

// Submit User Custom Needs Request
app.post('/api/user/requests', requireAuth('user'), async (req, res) => {
  const { event_type, location, budget, date, notes } = req.body;
  const user_id = req.session.user.id;

  if (!event_type || !location || !budget || !date) {
    return res.status(400).json({ error: 'Event type, location, budget, and date are required.' });
  }

  try {
    await dbRun(
      'INSERT INTO user_requests (user_id, event_type, location, budget, date, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, event_type, location, parseFloat(budget), date, notes || '']
    );
    res.status(201).json({ message: 'Custom event request submitted successfully! Admin will connect a venue soon.' });
  } catch (err) {
    console.error('Request submission error:', err);
    res.status(500).json({ error: 'Failed to submit request.' });
  }
});

// Get User Custom Requests
app.get('/api/user/requests', requireAuth('user'), async (req, res) => {
  try {
    const requests = await dbAll(`
      SELECT r.*, p.place_name, p.location as venue_location, p.amount as venue_amount,
             u.username as vendor_name, b.id as booking_id, b.payment_status
      FROM user_requests r
      LEFT JOIN vendor_places p ON r.assigned_place_id = p.id
      LEFT JOIN users u ON p.vendor_id = u.id
      LEFT JOIN bookings b ON r.id = b.request_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `, [req.session.user.id]);
    res.json(requests);
  } catch (err) {
    console.error('Fetch user requests error:', err);
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// --- VENDOR DASHBOARD API ---

// List Vendor Venues/Places
app.post('/api/vendor/places', requireAuth('vendor'), async (req, res) => {
  const { place_name, event_types, location, amount } = req.body;
  const vendor_id = req.session.user.id;

  if (!place_name || !event_types || !location || !amount) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    await dbRun(
      'INSERT INTO vendor_places (vendor_id, place_name, event_types, location, amount) VALUES (?, ?, ?, ?, ?)',
      [vendor_id, place_name, event_types, location, parseFloat(amount)]
    );
    res.status(201).json({ message: 'New venue place added successfully!' });
  } catch (err) {
    console.error('Add place error:', err);
    res.status(500).json({ error: 'Failed to add place.' });
  }
});

// Get Current Vendor's Places
app.get('/api/vendor/places', requireAuth('vendor'), async (req, res) => {
  try {
    const places = await dbAll(
      'SELECT * FROM vendor_places WHERE vendor_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.json(places);
  } catch (err) {
    console.error('Fetch vendor places error:', err);
    res.status(500).json({ error: 'Failed to fetch places.' });
  }
});

// Get Bookings for Current Vendor's Venues
app.get('/api/vendor/bookings', requireAuth('vendor'), async (req, res) => {
  try {
    const bookings = await dbAll(`
      SELECT b.*, p.place_name, p.location, u.username as user_name, u.email as user_email
      FROM bookings b
      JOIN vendor_places p ON b.place_id = p.id
      JOIN users u ON b.user_id = u.id
      WHERE p.vendor_id = ?
      ORDER BY b.booking_date ASC
    `, [req.session.user.id]);
    res.json(bookings);
  } catch (err) {
    console.error('Fetch vendor bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

// --- ADMIN DASHBOARD API ---

// 1. Get All Users (excluding passwords)
app.get('/api/admin/users', requireAuth('admin'), async (req, res) => {
  try {
    const users = await dbAll('SELECT id, username, email, role, created_at FROM users ORDER BY role, username');
    res.json(users);
  } catch (err) {
    console.error('Admin fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// 2. Get All Custom User Requests (Pending & Active)
app.get('/api/admin/requests', requireAuth('admin'), async (req, res) => {
  try {
    const requests = await dbAll(`
      SELECT r.*, u.username as requester_name, u.email as requester_email, p.place_name as assigned_place_name
      FROM user_requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN vendor_places p ON r.assigned_place_id = p.id
      ORDER BY r.status DESC, r.created_at DESC
    `);
    res.json(requests);
  } catch (err) {
    console.error('Admin fetch requests error:', err);
    res.status(500).json({ error: 'Failed to fetch requests.' });
  }
});

// 3. Get All Vendor Places
app.get('/api/admin/places', requireAuth('admin'), async (req, res) => {
  try {
    const places = await dbAll(`
      SELECT p.*, u.username as vendor_name, u.email as vendor_email
      FROM vendor_places p
      JOIN users u ON p.vendor_id = u.id
      ORDER BY p.place_name
    `);
    res.json(places);
  } catch (err) {
    console.error('Admin fetch places error:', err);
    res.status(500).json({ error: 'Failed to fetch places.' });
  }
});

// 4. Admin Connects a User Request to a Vendor Place
app.post('/api/admin/connect', requireAuth('admin'), async (req, res) => {
  const { request_id, place_id } = req.body;

  if (!request_id || !place_id) {
    return res.status(400).json({ error: 'Request ID and Place ID are required.' });
  }

  try {
    // Get request details
    const request = await dbGet('SELECT * FROM user_requests WHERE id = ?', [request_id]);
    if (!request) {
      return res.status(404).json({ error: 'User request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request is already connected, paid, or completed.' });
    }

    // Get place details
    const place = await dbGet('SELECT * FROM vendor_places WHERE id = ?', [place_id]);
    if (!place) {
      return res.status(404).json({ error: 'Vendor place not found.' });
    }

    // 1. Update request status to 'connected' and link assigned venue
    await dbRun(
      'UPDATE user_requests SET status = ?, assigned_place_id = ? WHERE id = ?',
      ['connected', place_id, request_id]
    );

    // 2. Automatically create a pending booking for the user
    await dbRun(
      'INSERT INTO bookings (user_id, place_id, request_id, event_type, booking_date, amount, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [request.user_id, place_id, request_id, request.event_type, request.date, place.amount, 'pending']
    );

    res.json({ message: 'User request successfully connected to the venue! User can now verify and pay.' });
  } catch (err) {
    console.error('Admin connect error:', err);
    res.status(500).json({ error: 'Failed to connect user request with vendor venue.' });
  }
});
