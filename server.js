// server.js - Express Backend for WhatsApp Order Seva Dashboard
// Integrates with existing bot.js without breaking it

import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = '9174406375';

// Credentials (hardcoded as per requirement)
const ADMIN_CREDENTIALS = {
  username: 'satguru5505',
  password: '5505'
};

// Middleware
app.use(cors());
app.use(express.json());

// Database paths (reusing existing structure)
const ORDERS_DB = './data/orders.json';
const SESSIONS_DIR = './sessions';

// ==================== UTILITY FUNCTIONS ====================

function readOrders() {
  try {
    if (!fs.existsSync(ORDERS_DB)) {
      return [];
    }
    const data = fs.readFileSync(ORDERS_DB, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Read orders error:', error);
    return [];
  }
}

function getOrdersByDateRange(orders, startDate, endDate) {
  return orders.filter(order => {
    const orderDate = new Date(order.timestamp);
    return orderDate >= startDate && orderDate <= endDate;
  });
}

function getISTDate(date = new Date()) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

// ==================== AUTHENTICATION ====================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, message: 'Login successful' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// ==================== ORDERS API ====================

// Get orders summary (statistics)
app.get('/api/orders/summary', (req, res) => {
  try {
    const orders = readOrders();
    const now = getISTDate();
    
    // Calculate date ranges in IST
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count orders
    const todayCount = orders.filter(o => new Date(o.timestamp) >= todayStart).length;
    const yesterdayCount = orders.filter(o => {
      const orderDate = new Date(o.timestamp);
      return orderDate >= yesterdayStart && orderDate < todayStart;
    }).length;
    const weekCount = orders.filter(o => new Date(o.timestamp) >= weekStart).length;
    const monthCount = orders.filter(o => new Date(o.timestamp) >= monthStart).length;
    const totalCount = orders.length;

    // Book statistics
    const bookStats = {};
    orders.forEach(order => {
      const book = order.bookName || 'Unknown';
      bookStats[book] = (bookStats[book] || 0) + 1;
    });

    // Weekly data for chart (last 7 days)
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayStart);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.timestamp);
        return orderDate >= date && orderDate < nextDate;
      }).length;
      
      weeklyData.push({
        date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        orders: dayOrders
      });
    }

    res.json({
      success: true,
      todayCount,
      yesterdayCount,
      weekCount,
      monthCount,
      totalCount,
      bookStats,
      weeklyData
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get orders with pagination and filters
app.get('/api/orders', (req, res) => {
  try {
    const { page = 1, limit = 25, search = '', status = 'all', fromDate, toDate } = req.query;
    
    let orders = readOrders();

    // Filter by status
    if (status !== 'all') {
      orders = orders.filter(o => (o.status || 'pending') === status);
    }

    // Filter by date range
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      orders = getOrdersByDateRange(orders, start, end);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter(o =>
        o.name?.toLowerCase().includes(searchLower) ||
        o.mobile?.includes(search) ||
        o.bookName?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination
    const total = orders.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedOrders = orders.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: paginatedOrders,
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single order by ID
app.get('/api/orders/:id', (req, res) => {
  try {
    const orders = readOrders();
    const order = orders.find(o => o.id === parseInt(req.params.id));

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get book-wise statistics
app.get('/api/orders/stats/by-book', (req, res) => {
  try {
    const orders = readOrders();
    const bookStats = {};
    
    orders.forEach(order => {
      const book = order.bookName || 'Unknown';
      if (!bookStats[book]) {
        bookStats[book] = { count: 0, languages: {} };
      }
      bookStats[book].count++;
      
      const lang = order.language || 'Unknown';
      bookStats[book].languages[lang] = (bookStats[book].languages[lang] || 0) + 1;
    });

    res.json({ success: true, data: bookStats });
  } catch (error) {
    console.error('Book stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get last 24 hours statistics
app.get('/api/orders/stats/last24hours', (req, res) => {
  try {
    const orders = readOrders();
    const now = getISTDate();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentOrders = orders.filter(o => new Date(o.timestamp) >= last24h);
    
    // Hourly breakdown
    const hourlyData = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const hourOrders = recentOrders.filter(o => {
        const orderDate = new Date(o.timestamp);
        return orderDate >= hourStart && orderDate < hourEnd;
      }).length;
      
      hourlyData.push({
        hour: hourStart.getHours(),
        orders: hourOrders
      });
    }

    res.json({
      success: true,
      totalLast24h: recentOrders.length,
      hourlyData
    });
  } catch (error) {
    console.error('Last 24h stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SESSIONS API ====================

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return res.json({ success: true, sessions: [] });
    }

    const sessionFolders = fs.readdirSync(SESSIONS_DIR)
      .filter(f => fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory());

    const sessions = sessionFolders.map(sessionName => {
      const credsPath = path.join(SESSIONS_DIR, sessionName, 'creds.json');
      const hasCredentials = fs.existsSync(credsPath);

      return {
        sessionName,
        isActive: false, // You can implement active checking logic
        hasCredentials,
        lastConnectedAt: hasCredentials ? fs.statSync(credsPath).mtime : null
      };
    });

    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Sessions list error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate pairing code for a session
app.post('/api/sessions/:sessionName/pair-code', async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    // This would need integration with your bot.js
    // For now, return a placeholder response
    
    res.json({
      success: true,
      sessionName,
      pairingCode: 'XXXX-XXXX', // Placeholder - needs bot.js integration
      message: 'Feature requires bot.js integration'
    });
  } catch (error) {
    console.error('Pairing code error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate QR code for a session
app.post('/api/sessions/:sessionName/qr', async (req, res) => {
  try {
    const { sessionName } = req.params;
    
    // Generate a sample QR code
    // In production, this should come from Baileys
    const qrString = `whatsapp-session:${sessionName}:${Date.now()}`;
    const qrDataUrl = await QRCode.toDataURL(qrString);

    res.json({
      success: true,
      sessionName,
      qrDataUrl,
      message: 'Scan this QR code in WhatsApp > Linked Devices'
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get session status
app.get('/api/sessions/:sessionName/status', (req, res) => {
  try {
    const { sessionName } = req.params;
    const credsPath = path.join(SESSIONS_DIR, sessionName, 'creds.json');
    
    if (!fs.existsSync(credsPath)) {
      return res.json({
        success: true,
        isConnected: false,
        message: 'Session not initialized'
      });
    }

    res.json({
      success: true,
      isConnected: true, // Placeholder - needs bot.js integration
      lastConnectionUpdate: fs.statSync(credsPath).mtime
    });
  } catch (error) {
    console.error('Session status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    timezone: 'Asia/Kolkata'
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 WhatsApp Order Seva Dashboard Backend`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Server running on: http://localhost:${PORT}`);
  console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🔐 Admin Login: satguru5505 / 5505`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📝 Available Endpoints:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/orders/summary`);
  console.log(`   GET  /api/orders`);
  console.log(`   GET  /api/orders/:id`);
  console.log(`   GET  /api/sessions`);
  console.log(`   POST /api/sessions/:name/qr`);
  console.log(`   GET  /api/health`);
  console.log(`\n🔄 Bot Integration: Running alongside bot.js\n`);
});

export default app;
