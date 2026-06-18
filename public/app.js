// ==========================================================================
// APPLICATION STATE
// ==========================================================================
let currentUser = null;
let activeRequest = null; // Admin connection
let activePlace = null;   // Admin connection

// Cache data
let userRequestsCache = [];
let vendorPlacesCache = [];

// ==========================================================================
// INITIALIZATION ON DOM LOAD
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initAuthTabToggle();
  initPasswordVisibilityToggles();
  initFormOptionSelectors();
  initFormSubmissions();
  initModalCloseButtons();
  initCardNumberFormatting();
  checkSession(); // Check if user already logged in
});

// ==========================================================================
// AUTHENTICATION UI & INTERACTIVITY
// ==========================================================================

// Switch between Login and Register tabs
function initAuthTabToggle() {
  const tabLogin = document.getElementById('tab-login-btn');
  const tabRegister = document.getElementById('tab-register-btn');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginPanel.classList.remove('hidden');
    registerPanel.classList.add('hidden');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerPanel.classList.remove('hidden');
    loginPanel.classList.add('hidden');
  });
}

// Password visibility toggler
function initPasswordVisibilityToggles() {
  const loginPass = document.getElementById('login-password');
  const loginToggle = document.getElementById('login-password-toggle');
  const registerPass = document.getElementById('register-password');
  const registerToggle = document.getElementById('register-password-toggle');

  loginToggle.addEventListener('click', () => {
    const isPass = loginPass.type === 'password';
    loginPass.type = isPass ? 'text' : 'password';
    loginToggle.style.opacity = isPass ? '1' : '0.6';
  });

  registerToggle.addEventListener('click', () => {
    const isPass = registerPass.type === 'password';
    registerPass.type = isPass ? 'text' : 'password';
    registerToggle.style.opacity = isPass ? '1' : '0.6';
  });
}

// Custom Radio Button Styling for Role Selectors
function initFormOptionSelectors() {
  // Login Role Options
  const loginOptions = document.querySelectorAll('.role-option');
  loginOptions.forEach(opt => {
    const radio = opt.querySelector('input');
    opt.addEventListener('click', () => {
      loginOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      radio.checked = true;
    });
  });

  // Register Role Options
  const registerOptions = document.querySelectorAll('.role-option-register');
  registerOptions.forEach(opt => {
    const radio = opt.querySelector('input');
    opt.addEventListener('click', () => {
      registerOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      radio.checked = true;
    });
  });
}

// Form Submissions
function initFormSubmissions() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const customReqForm = document.getElementById('custom-request-form');
  const addPlaceForm = document.getElementById('add-place-form');
  const modalBookingForm = document.getElementById('modal-booking-form');
  const paymentForm = document.getElementById('payment-gateway-form');

  // Submit Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginId = document.getElementById('login-id').value;
    const password = document.getElementById('login-password').value;
    const role = document.querySelector('input[name="login-role"]:checked').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password, role })
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Login failed', 'error');
        return;
      }

      showToast(data.message, 'success');
      currentUser = data.user;
      loginForm.reset();
      setupDashboard(currentUser);
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  });

  // Submit Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.querySelector('input[name="register-role"]:checked').value;

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role })
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Registration failed', 'error');
        return;
      }

      showToast(data.message, 'success');
      registerForm.reset();
      // Auto toggle back to Login Tab
      document.getElementById('tab-login-btn').click();
      document.getElementById('login-id').value = username;
    } catch (err) {
      console.error(err);
      showToast('Connection to server failed', 'error');
    }
  });

  // Submit User Custom Request
  customReqForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const event_type = document.getElementById('req-event-type').value;
    const location = document.getElementById('req-location').value;
    const budget = document.getElementById('req-budget').value;
    const date = document.getElementById('req-date').value;
    const notes = document.getElementById('req-notes').value;

    try {
      const response = await fetch('/api/user/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type, location, budget, date, notes })
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to submit request', 'error');
        return;
      }

      showToast(data.message, 'success');
      customReqForm.reset();
      fetchUserRequests(); // Reload list
    } catch (err) {
      console.error(err);
      showToast('Connection error', 'error');
    }
  });

  // Submit Vendor New Place
  addPlaceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const place_name = document.getElementById('place-name').value;
    const event_types = document.getElementById('place-event-types').value;
    const location = document.getElementById('place-location').value;
    const amount = document.getElementById('place-amount').value;

    try {
      const response = await fetch('/api/vendor/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_name, event_types, location, amount })
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to list venue', 'error');
        return;
      }

      showToast(data.message, 'success');
      addPlaceForm.reset();
      // Switch back to "My Listed Places" tab
      document.getElementById('vendor-tab-places').click();
    } catch (err) {
      console.error(err);
      showToast('Connection error', 'error');
    }
  });

  // Submit Booking Modal Form
  modalBookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const place_id = document.getElementById('modal-booking-place-id').value;
    const event_type = document.getElementById('modal-booking-event-type').value;
    const booking_date = document.getElementById('modal-booking-date').value;

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id, event_type, booking_date })
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Failed to create booking', 'error');
        return;
      }

      // Hide booking modal
      closeBookingModal();
      showToast(data.message, 'success');

      // Open checkout modal instantly for that booking ID
      openPaymentModal(data.bookingId, document.getElementById('modal-booking-amount').value);
    } catch (err) {
      console.error(err);
      showToast('Booking error', 'error');
    }
  });

  // Submit Payment Gateway Form (Simulated Checkout)
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const booking_id = document.getElementById('payment-booking-id').value;
    const card_number = document.getElementById('pay-cardnumber').value;
    const expiry = document.getElementById('pay-expiry').value;
    const cvv = document.getElementById('pay-cvv').value;

    // Show dynamic loader state
    const submitBtn = document.getElementById('payment-submit-btn');
    const spinner = document.getElementById('payment-spinner');
    const btnText = submitBtn.querySelector('.btn-text');

    submitBtn.disabled = true;
    spinner.classList.remove('hidden');
    btnText.textContent = 'Verifying Transaction...';

    // Simulate bank latency (1.5 seconds)
    setTimeout(async () => {
      try {
        const response = await fetch('/api/pay-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id, card_number, expiry, cvv })
        });
        const data = await response.json();

        // Restore button state
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.textContent = 'Pay & Confirm Booking';

        if (!response.ok) {
          showToast(data.error || 'Payment declined', 'error');
          return;
        }

        showToast(data.message, 'success');
        closePaymentModal();
        paymentForm.reset();
        
        // Reset card visual representation
        document.getElementById('cc-card-number').textContent = '•••• •••• •••• ••••';
        document.getElementById('cc-card-holder').textContent = 'YOUR NAME';
        document.getElementById('cc-card-expiry').textContent = 'MM/YY';

        // Refresh views
        if (currentUser.role === 'user') {
          fetchUserBookings();
          fetchUserRequests();
        }
      } catch (err) {
        console.error(err);
        showToast('Payment processing connection failed', 'error');
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
        btnText.textContent = 'Pay & Confirm Booking';
      }
    }, 1500);
  });
}

// Close Modals
function initModalCloseButtons() {
  document.getElementById('close-booking-modal-btn').addEventListener('click', closeBookingModal);
  document.getElementById('close-payment-modal-btn').addEventListener('click', closePaymentModal);
}

// Interactive Credit Card Formatting
function initCardNumberFormatting() {
  const cardInput = document.getElementById('pay-cardnumber');
  const holderInput = document.getElementById('pay-cardholder');
  const expiryInput = document.getElementById('pay-expiry');

  const ccNumber = document.getElementById('cc-card-number');
  const ccHolder = document.getElementById('cc-card-holder');
  const ccExpiry = document.getElementById('cc-card-expiry');

  cardInput.addEventListener('input', (e) => {
    // Format card input to have spaces every 4 digits
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += value[i];
    }
    e.target.value = formatted;
    ccNumber.textContent = formatted || '•••• •••• •••• ••••';
  });

  holderInput.addEventListener('input', (e) => {
    ccHolder.textContent = e.target.value.toUpperCase() || 'YOUR NAME';
  });

  expiryInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (value.length > 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value;
    ccExpiry.textContent = value || 'MM/YY';
  });
}

// ==========================================================================
// SESSION MANAGEMENT & DASHBOARD ROUTING
// ==========================================================================
async function checkSession() {
  try {
    const response = await fetch('/api/me');
    const data = await response.json();
    if (data.user) {
      currentUser = data.user;
      setupDashboard(currentUser);
    } else {
      setupLoggedOutState();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    setupLoggedOutState();
  }
}

function setupLoggedOutState() {
  currentUser = null;
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('user-dashboard').classList.add('hidden');
  document.getElementById('vendor-dashboard').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
  
  // Render empty/standard navigation
  const mainNav = document.getElementById('main-nav');
  mainNav.innerHTML = `<span class="nav-note">Modern Event Platform</span>`;
}

function setupDashboard(user) {
  // Hide Auth section
  document.getElementById('auth-view').classList.add('hidden');

  // Load correct layout view
  const userDash = document.getElementById('user-dashboard');
  const vendorDash = document.getElementById('vendor-dashboard');
  const adminDash = document.getElementById('admin-dashboard');

  userDash.classList.add('hidden');
  vendorDash.classList.add('hidden');
  adminDash.classList.add('hidden');

  if (user.role === 'user') {
    userDash.classList.remove('hidden');
    document.getElementById('user-sidebar-name').textContent = user.username;
    initUserDashboardTabs();
    // Default load search
    fetchPlaces();
  } else if (user.role === 'vendor') {
    vendorDash.classList.remove('hidden');
    document.getElementById('vendor-sidebar-name').textContent = user.username;
    initVendorDashboardTabs();
    // Default load vendor places
    fetchVendorPlaces();
  } else if (user.role === 'admin') {
    adminDash.classList.remove('hidden');
    document.getElementById('admin-sidebar-name').textContent = user.username;
    initAdminDashboardTabs();
    // Default load admin matching interface
    fetchAdminConnections();
  }

  // Inject Header profile and Logout Button
  const mainNav = document.getElementById('main-nav');
  mainNav.innerHTML = `
    <div class="user-nav-badge">
      <span class="user-role-tag ${user.role}">${user.role}</span>
      <span>${user.username}</span>
    </div>
    <button class="btn btn-outline" id="btn-logout">Logout</button>
  `;

  // Bind logout action
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
}

async function handleLogout() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (response.ok) {
      showToast('Logged out successfully', 'success');
      setupLoggedOutState();
    }
  } catch (err) {
    showToast('Failed to connect for logout', 'error');
  }
}

// ==========================================================================
// USER DASHBOARD MODULES
// ==========================================================================
function initUserDashboardTabs() {
  const tabs = {
    'user-tab-search': 'user-search-panel',
    'user-tab-bookings': 'user-bookings-panel',
    'user-tab-requests': 'user-requests-panel'
  };

  const buttons = document.querySelectorAll('#user-dashboard .sidebar-link');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active link class
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Toggle active content panel
      const targetPanelId = tabs[btn.id];
      const panels = document.querySelectorAll('#user-dashboard .tab-panel');
      panels.forEach(p => p.classList.add('hidden'));
      document.getElementById(targetPanelId).classList.remove('hidden');

      // Refresh data
      if (btn.id === 'user-tab-search') fetchPlaces();
      if (btn.id === 'user-tab-bookings') fetchUserBookings();
      if (btn.id === 'user-tab-requests') fetchUserRequests();
    });
  });

  // Re-bind user search filter controls once
  const searchInput = document.getElementById('venue-search-input');
  const searchBtn = document.getElementById('venue-search-btn');
  const filterType = document.getElementById('venue-filter-type');
  const filterLocation = document.getElementById('venue-filter-location');
  const filterMaxPrice = document.getElementById('venue-filter-max-price');

  const runSearch = () => {
    const params = {
      search: searchInput.value,
      type: filterType.value,
      location: filterLocation.value,
      maxPrice: filterMaxPrice.value
    };
    fetchPlaces(params);
  };

  searchBtn.onclick = runSearch;
  searchInput.onkeydown = (e) => { if (e.key === 'Enter') runSearch(); };
  filterType.onchange = runSearch;
  filterLocation.oninput = runSearch;
  filterMaxPrice.oninput = runSearch;
}

// Fetch all available places for searching
async function fetchPlaces(filters = {}) {
  const container = document.getElementById('venues-list-container');
  container.innerHTML = '<div class="loader-placeholder">Loading premium venue locations...</div>';

  try {
    // Construct query parameters
    let query = '';
    const keys = Object.keys(filters);
    if (keys.length > 0) {
      const qParams = keys
        .filter(k => filters[k] !== undefined && filters[k] !== '')
        .map(k => `${k}=${encodeURIComponent(filters[k])}`)
        .join('&');
      if (qParams) query = '?' + qParams;
    }

    const response = await fetch(`/api/places${query}`);
    const places = await response.json();

    if (!response.ok) {
      container.innerHTML = `<p class="error-msg">Error: ${places.error || 'Could not load venues'}</p>`;
      return;
    }

    if (places.length === 0) {
      container.innerHTML = `<p class="no-data-msg">No venues found matching your filters.</p>`;
      return;
    }

    // Render cards
    container.innerHTML = '';
    places.forEach(p => {
      const card = document.createElement('div');
      card.className = 'glass-card place-card';

      // Split event types
      const tagHtml = p.event_types.split(',')
        .map(t => `<span class="place-tag">${t.trim()}</span>`)
        .join('');

      card.innerHTML = `
        <div>
          <div class="place-header">
            <div>
              <h3 class="place-title">${p.place_name}</h3>
              <span class="place-vendor">by ${p.vendor_name}</span>
            </div>
            <div class="place-price">$${p.amount.toFixed(2)}<span>/day</span></div>
          </div>
          
          <div class="place-details-row">
            <div class="detail-item">
              <span class="detail-icon">📍</span>
              <span>${p.location}</span>
            </div>
            <div class="place-tags">
              ${tagHtml}
            </div>
          </div>
        </div>

        <button class="btn btn-primary btn-full btn-book-trigger" data-id="${p.id}" data-name="${p.place_name}" data-price="${p.amount}" data-events="${p.event_types}">Book Location</button>
      `;

      container.appendChild(card);
    });

    // Attach click events to "Book Location" buttons
    container.querySelectorAll('.btn-book-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        openBookingModal(
          btn.getAttribute('data-id'),
          btn.getAttribute('data-name'),
          btn.getAttribute('data-price'),
          btn.getAttribute('data-events')
        );
      });
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="error-msg">Server error connection.</p>`;
  }
}

// Fetch user bookings list
async function fetchUserBookings() {
  const tbody = document.getElementById('user-bookings-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading reservations...</td></tr>';

  try {
    const response = await fetch('/api/user/bookings');
    const bookings = await response.json();

    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center error-msg">Failed: ${bookings.error}</td></tr>`;
      return;
    }

    if (bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">You have no active or historical bookings.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    bookings.forEach(b => {
      const row = document.createElement('tr');
      const isPending = b.payment_status === 'pending';
      const actionHtml = isPending 
        ? `<button class="btn btn-secondary btn-pay-now-trigger" data-id="${b.id}" data-amount="${b.amount}">Pay Now</button>`
        : '<span class="text-muted">—</span>';

      row.innerHTML = `
        <td><strong>${b.place_name}</strong></td>
        <td>${b.location}</td>
        <td>${b.booking_date}</td>
        <td><span class="place-tag">${b.event_type}</span></td>
        <td><strong>$${b.amount.toFixed(2)}</strong></td>
        <td><span class="status-badge ${b.payment_status}">${b.payment_status}</span></td>
        <td>${actionHtml}</td>
      `;
      tbody.appendChild(row);
    });

    // Bind payment triggers
    tbody.querySelectorAll('.btn-pay-now-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        openPaymentModal(btn.getAttribute('data-id'), btn.getAttribute('data-amount'));
      });
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center error-msg">Server error.</td></tr>';
  }
}

// Fetch user custom requests list
async function fetchUserRequests() {
  const container = document.getElementById('user-requests-list');
  container.innerHTML = '<div class="text-center">Loading custom event requests...</div>';

  try {
    const response = await fetch('/api/user/requests');
    userRequestsCache = await response.json();

    if (!response.ok) {
      container.innerHTML = `<div class="error-msg">Error: ${userRequestsCache.error}</div>`;
      return;
    }

    if (userRequestsCache.length === 0) {
      container.innerHTML = '<div class="text-center text-muted">No custom event needs submitted yet.</div>';
      return;
    }

    container.innerHTML = '';
    userRequestsCache.forEach(r => {
      const card = document.createElement('div');
      card.className = 'request-item-card';

      let connectionHtml = '';
      if (r.status === 'connected') {
        connectionHtml = `
          <div class="request-connected-venue">
            <h4>💡 Recommended Venue Connected!</h4>
            <div class="request-connected-details">
              <p><strong>Venue:</strong> ${r.place_name} (${r.venue_location})</p>
              <p><strong>Offer Price:</strong> $${r.venue_amount.toFixed(2)} /day</p>
              <p><strong>Provided by:</strong> ${r.vendor_name}</p>
            </div>
            <button class="btn btn-secondary btn-full btn-pay-connection" data-booking-id="${r.booking_id}" data-amount="${r.venue_amount}">
              Pay & Confirm Connection
            </button>
          </div>
        `;
      } else if (r.status === 'paid') {
        connectionHtml = `
          <div class="request-connected-venue" style="border-color: var(--success); background: rgba(16, 185, 129, 0.05)">
            <h4 style="color: var(--success)">✅ Venue Booked & Confirmed</h4>
            <div class="request-connected-details" style="margin-bottom: 0">
              <p><strong>Venue:</strong> ${r.place_name} (${r.venue_location})</p>
              <p><strong>Amount Paid:</strong> $${r.venue_amount.toFixed(2)}</p>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="request-item-header">
          <div>
            <span class="request-item-title">${r.event_type} event</span>
            <div class="request-item-date">Date: ${r.date}</div>
          </div>
          <span class="status-badge ${r.status}">${r.status}</span>
        </div>
        <div class="request-details-grid">
          <div>Preferred Location: <strong>${r.location}</strong></div>
          <div>Max Budget: <strong>$${r.budget.toFixed(2)}</strong></div>
          <div style="grid-column: span 2">Notes: <span class="text-muted">${r.notes || 'None'}</span></div>
        </div>
        ${connectionHtml}
      `;
      container.appendChild(card);
    });

    // Attach click handlers to pay connection
    container.querySelectorAll('.btn-pay-connection').forEach(btn => {
      btn.addEventListener('click', () => {
        openPaymentModal(btn.getAttribute('data-booking-id'), btn.getAttribute('data-amount'));
      });
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="error-msg">Failed to load requests.</div>';
  }
}

// ==========================================================================
// VENDOR DASHBOARD MODULES
// ==========================================================================
function initVendorDashboardTabs() {
  const tabs = {
    'vendor-tab-places': 'vendor-places-panel',
    'vendor-tab-add-place': 'vendor-add-place-panel',
    'vendor-tab-bookings': 'vendor-bookings-panel'
  };

  const buttons = document.querySelectorAll('#vendor-dashboard .sidebar-link');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetPanelId = tabs[btn.id];
      const panels = document.querySelectorAll('#vendor-dashboard .tab-panel');
      panels.forEach(p => p.classList.add('hidden'));
      document.getElementById(targetPanelId).classList.remove('hidden');

      if (btn.id === 'vendor-tab-places') fetchVendorPlaces();
      if (btn.id === 'vendor-tab-bookings') fetchVendorBookings();
    });
  });
}

// Fetch listed places for Vendor
async function fetchVendorPlaces() {
  const container = document.getElementById('vendor-places-list');
  container.innerHTML = '<div class="text-center">Loading your venue inventory...</div>';

  try {
    const response = await fetch('/api/vendor/places');
    const places = await response.json();

    if (!response.ok) {
      container.innerHTML = `<div class="error-msg">Error: ${places.error}</div>`;
      return;
    }

    if (places.length === 0) {
      container.innerHTML = '<div class="text-center text-muted">You have listed no locations yet. Use "List New Place" tab to begin.</div>';
      return;
    }

    container.innerHTML = '';
    places.forEach(p => {
      const card = document.createElement('div');
      card.className = 'glass-card place-card';

      const tagHtml = p.event_types.split(',')
        .map(t => `<span class="place-tag">${t.trim()}</span>`)
        .join('');

      card.innerHTML = `
        <div>
          <div class="place-header">
            <div>
              <h3 class="place-title">${p.place_name}</h3>
            </div>
            <div class="place-price">$${p.amount.toFixed(2)}<span>/day</span></div>
          </div>
          
          <div class="place-details-row">
            <div class="detail-item">
              <span class="detail-icon">📍</span>
              <span>${p.location}</span>
            </div>
            <div class="place-tags">
              ${tagHtml}
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="error-msg">Server error.</div>';
  }
}

// Fetch bookings scheduled for Vendor's places
async function fetchVendorBookings() {
  const tbody = document.getElementById('vendor-bookings-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading schedule reservations...</td></tr>';

  try {
    const response = await fetch('/api/vendor/bookings');
    const bookings = await response.json();

    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center error-msg">Failed: ${bookings.error}</td></tr>`;
      return;
    }

    if (bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No bookings have been scheduled for your venues yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    bookings.forEach(b => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${b.place_name}</strong></td>
        <td>${b.user_name}</td>
        <td>${b.user_email}</td>
        <td>${b.booking_date}</td>
        <td><span class="place-tag">${b.event_type}</span></td>
        <td><strong>$${b.amount.toFixed(2)}</strong></td>
        <td><span class="status-badge ${b.payment_status}">${b.payment_status}</span></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center error-msg">Server error.</td></tr>';
  }
}

// ==========================================================================
// ADMIN DASHBOARD MODULES
// ==========================================================================
function initAdminDashboardTabs() {
  const tabs = {
    'admin-tab-connect': 'admin-connect-panel',
    'admin-tab-venues': 'admin-venues-panel',
    'admin-tab-users': 'admin-users-panel'
  };

  const buttons = document.querySelectorAll('#admin-dashboard .sidebar-link');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetPanelId = tabs[btn.id];
      const panels = document.querySelectorAll('#admin-dashboard .tab-panel');
      panels.forEach(p => p.classList.add('hidden'));
      document.getElementById(targetPanelId).classList.remove('hidden');

      if (btn.id === 'admin-tab-connect') fetchAdminConnections();
      if (btn.id === 'admin-tab-venues') fetchAdminVenues();
      if (btn.id === 'admin-tab-users') fetchAdminUsers();
    });
  });

  // Connect request and place trigger
  const connectBtn = document.getElementById('admin-btn-connect');
  connectBtn.onclick = handleAdminConnect;
}

// Fetch Admin lists to Connect User requests with Vendor Venues
async function fetchAdminConnections() {
  const reqList = document.getElementById('admin-requests-list');
  const placeList = document.getElementById('admin-places-list');

  reqList.innerHTML = '<div class="text-center">Loading user needs...</div>';
  placeList.innerHTML = '<div class="text-center">Loading options...</div>';

  // Clear active selection states
  activeRequest = null;
  activePlace = null;
  document.getElementById('selected-req-summary').textContent = 'None';
  document.getElementById('selected-place-summary').textContent = 'None';
  document.getElementById('admin-btn-connect').disabled = true;

  try {
    // 1. Fetch user custom requests
    const resReq = await fetch('/api/admin/requests');
    const requests = await resReq.json();

    // 2. Fetch vendor places
    const resPlaces = await fetch('/api/admin/places');
    vendorPlacesCache = await resPlaces.json();

    // Render User Requests (Only show 'pending' requests for connection)
    const pendingReqs = requests.filter(r => r.status === 'pending');
    if (pendingReqs.length === 0) {
      reqList.innerHTML = '<div class="text-center text-muted">No pending user custom requests.</div>';
    } else {
      reqList.innerHTML = '';
      pendingReqs.forEach(r => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.dataset.id = r.id;
        item.innerHTML = `
          <div class="admin-list-item-header">
            <span class="admin-item-title">${r.event_type} (${r.location})</span>
            <span class="status-badge pending">Pending</span>
          </div>
          <div class="admin-item-detail">Budget: <strong>$${r.budget}</strong> | Date: ${r.date}</div>
          <div class="admin-item-detail text-muted" style="margin-top:0.25rem;">User: ${r.requester_name} | Notes: ${r.notes || 'None'}</div>
        `;

        item.addEventListener('click', () => {
          reqList.querySelectorAll('.admin-list-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          activeRequest = r;
          document.getElementById('selected-req-summary').textContent = `${r.event_type} by ${r.requester_name} ($${r.budget})`;
          checkAdminConnectEnable();
        });

        reqList.appendChild(item);
      });
    }

    // Render Vendor Places
    if (vendorPlacesCache.length === 0) {
      placeList.innerHTML = '<div class="text-center text-muted">No venues offered by vendors yet.</div>';
    } else {
      placeList.innerHTML = '';
      vendorPlacesCache.forEach(p => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.dataset.id = p.id;
        item.innerHTML = `
          <div class="admin-list-item-header">
            <span class="admin-item-title">${p.place_name} (${p.location})</span>
            <strong style="color:var(--secondary)">$${p.amount}</strong>
          </div>
          <div class="admin-item-detail">Vendor: ${p.vendor_name} | Types: ${p.event_types}</div>
        `;

        item.addEventListener('click', () => {
          placeList.querySelectorAll('.admin-list-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          activePlace = p;
          document.getElementById('selected-place-summary').textContent = `${p.place_name} ($${p.amount})`;
          checkAdminConnectEnable();
        });

        placeList.appendChild(item);
      });
    }

  } catch (err) {
    console.error(err);
    reqList.innerHTML = '<div class="error-msg">Error connecting.</div>';
  }
}

function checkAdminConnectEnable() {
  const btn = document.getElementById('admin-btn-connect');
  btn.disabled = !(activeRequest && activePlace);
}

async function handleAdminConnect() {
  if (!activeRequest || !activePlace) return;

  const request_id = activeRequest.id;
  const place_id = activePlace.id;

  try {
    const response = await fetch('/api/admin/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, place_id })
    });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || 'Failed to connect', 'error');
      return;
    }

    showToast(data.message, 'success');
    fetchAdminConnections(); // Reload columns
  } catch (err) {
    console.error(err);
    showToast('Failed to execute connect action', 'error');
  }
}

// Fetch and show Venues inside Admin panel
async function fetchAdminVenues() {
  const tbody = document.getElementById('admin-venues-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading venue listings...</td></tr>';

  try {
    const response = await fetch('/api/admin/places');
    const places = await response.json();

    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center error-msg">Failed: ${places.error}</td></tr>`;
      return;
    }

    if (places.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No venues listed yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    places.forEach(p => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${p.place_name}</strong></td>
        <td>${p.vendor_name}</td>
        <td>${p.vendor_email}</td>
        <td><span class="place-tag">${p.event_types}</span></td>
        <td>${p.location}</td>
        <td><strong>$${p.amount.toFixed(2)}</strong></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center error-msg">Server error.</td></tr>';
  }
}

// Fetch and show Users inside Admin panel
async function fetchAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading system accounts...</td></tr>';

  try {
    const response = await fetch('/api/admin/users');
    const users = await response.json();

    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center error-msg">Failed: ${users.error}</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    users.forEach(u => {
      const row = document.createElement('tr');
      const formattedDate = new Date(u.created_at).toLocaleDateString();
      row.innerHTML = `
        <td>${u.id}</td>
        <td><strong>${u.username}</strong></td>
        <td>${u.email}</td>
        <td><span class="user-role-tag ${u.role}">${u.role}</span></td>
        <td>${formattedDate}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" class="text-center error-msg">Server error.</td></tr>';
  }
}

// ==========================================================================
// MODAL WORKFLOWS
// ==========================================================================

// 1. Direct Booking Modal
function openBookingModal(placeId, name, price, eventsString) {
  document.getElementById('modal-booking-place-id').value = placeId;
  document.getElementById('modal-booking-place-name').value = name;
  document.getElementById('modal-booking-amount').value = `$${parseFloat(price).toFixed(2)}`;
  
  // Set date field minimum limit to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('modal-booking-date').min = today;
  document.getElementById('modal-booking-date').value = today;

  // Build events dropdown
  const select = document.getElementById('modal-booking-event-type');
  select.innerHTML = '';
  eventsString.split(',').forEach(e => {
    const cleanEvent = e.trim();
    const opt = document.createElement('option');
    opt.value = cleanEvent;
    opt.textContent = cleanEvent;
    select.appendChild(opt);
  });

  document.getElementById('booking-modal').classList.remove('hidden');
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

// 2. Checkout payment modal
function openPaymentModal(bookingId, priceString) {
  document.getElementById('payment-booking-id').value = bookingId;
  
  // Clean amount output formatting
  let cleanAmount = priceString;
  if (typeof priceString === 'number' || !priceString.startsWith('$')) {
    cleanAmount = `$${parseFloat(priceString).toFixed(2)}`;
  }
  document.getElementById('payment-modal-amount').textContent = cleanAmount;

  document.getElementById('payment-modal').classList.remove('hidden');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.add('hidden');
}

// ==========================================================================
// TOAST NOTIFICATIONS HELPER
// ==========================================================================
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const span = document.getElementById('toast-message');

  span.textContent = message;
  toast.className = 'toast'; // Reset classes
  
  if (type === 'success') {
    toast.style.borderLeft = '4px solid var(--success)';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid var(--danger)';
  } else {
    toast.style.borderLeft = '4px solid var(--primary)';
  }

  toast.classList.remove('hidden');

  // Clear older timeouts
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }

  // Dismiss toast automatically after 4 seconds
  toast.timeoutId = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
