// ═══════════════════════════════════════════════════════════════
// 🌐 WEB DASHBOARD SERVER
// ═══════════════════════════════════════════════════════════════
// Features:
// ✅ Modern responsive dashboard
// ✅ WhatsApp session management
// ✅ Live order monitoring
// ✅ Bulk sender controls
// ✅ Template management
// ✅ Real-time statistics
// ✅ Admin command panel
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global state (in production, use Redis/Database)
let activeSessions = new Map();
let systemStats = {
  totalOrders: 0,
  todayOrders: 0,
  bulkCampaigns: 0,
  activeUsers: 0
};

// ═════════════════════════════════════════════════════════════
// 🏒 ROUTES
// ═════════════════════════════════════════════════════════════

// Home - Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get system status
app.get('/api/status', (req, res) => {
  try {
    const ordersData = loadOrdersData();
    const sessions = Array.from(activeSessions.values());
    
    res.json({
      success: true,
      stats: {
        totalOrders: ordersData.length,
        todayOrders: getTodayOrders(ordersData).length,
        activeSessions: sessions.length,
        uptime: process.uptime()
      },
      sessions: sessions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = Array.from(activeSessions.values());
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register/Update session (called by bot)
app.post('/api/session/register', (req, res) => {
  try {
    const { sessionName, phoneNumber, status, qrCode } = req.body;
    
    activeSessions.set(sessionName, {
      sessionName,
      phoneNumber: phoneNumber || 'Not paired',
      status: status || 'active',
      qrCode: qrCode || null,
      lastSeen: new Date().toISOString(),
      uptime: 0
    });
    
    res.json({ success: true, message: 'Session registered' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get orders
app.get('/api/orders', (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const ordersData = loadOrdersData();
    
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedOrders = ordersData.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      orders: paginatedOrders,
      total: ordersData.length,
      page: parseInt(page),
      totalPages: Math.ceil(ordersData.length / limit)
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get bulk campaign status
app.get('/api/bulk/status', (req, res) => {
  try {
    // Load bulk state from file
    const bulkStatePath = '../data/bulk_state.json';
    let bulkState = {};
    
    if (fs.existsSync(bulkStatePath)) {
      bulkState = JSON.parse(fs.readFileSync(bulkStatePath, 'utf8'));
    }
    
    res.json({ success: true, bulkState });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Control bulk sender
app.post('/api/bulk/control', (req, res) => {
  try {
    const { action } = req.body; // start, stop, pause, resume
    
    // In production, this would send command to bulk sender process
    res.json({ success: true, message: `Bulk sender ${action}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get templates
app.get('/api/templates', (req, res) => {
  try {
    const templatesPath = '../templates';
    const templates = [];
    
    if (fs.existsSync(templatesPath)) {
      const files = fs.readdirSync(templatesPath);
      files.forEach(file => {
        if (file.endsWith('.txt')) {
          const content = fs.readFileSync(path.join(templatesPath, file), 'utf8');
          templates.push({
            name: file,
            content: content,
            length: content.length
          });
        }
      });
    }
    
    res.json({ success: true, templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update template
app.post('/api/templates/update', (req, res) => {
  try {
    const { name, content } = req.body;
    const templatesPath = '../templates';
    
    if (!fs.existsSync(templatesPath)) {
      fs.mkdirSync(templatesPath, { recursive: true });
    }
    
    fs.writeFileSync(path.join(templatesPath, name), content, 'utf8');
    
    res.json({ success: true, message: 'Template updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pair new WhatsApp
app.post('/api/whatsapp/pair', (req, res) => {
  try {
    const { phoneNumber, method } = req.body; // method: 'qr' or 'code'
    
    // In production, this would trigger pairing in bot
    res.json({ 
      success: true, 
      message: 'Pairing initiated',
      qrCode: method === 'qr' ? 'QR_CODE_DATA' : null,
      pairingCode: method === 'code' ? 'PAIRING_CODE' : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// 🛠️ HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════

function loadOrdersData() {
  try {
    const ordersPath = '../data/orders.json';
    if (fs.existsSync(ordersPath)) {
      return JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }
    return [];
  } catch {
    return [];
  }
}

function getTodayOrders(orders) {
  const today = new Date().toISOString().split('T')[0];
  return orders.filter(order => {
    const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
    return orderDate === today;
  });
}

// ═════════════════════════════════════════════════════════════
// 🚀 START SERVER
// ═════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n════════════════════════════════════════`);
  console.log(`🌐 Web Dashboard Running`);
  console.log(`════════════════════════════════════════`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://0.0.0.0:${PORT}`);
  console.log(`════════════════════════════════════════\n`);
});

export default app;
