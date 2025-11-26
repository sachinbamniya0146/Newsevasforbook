import fs from 'fs';
import path from 'path';

const DB_DIR = '/sdcard/DCIM/gyan ganga seva/orders';
const DB_FILE = path.join(DB_DIR, 'orders.json');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ orders: [] }, null, 2));
}

export async function saveOrder(orderData) {
  try {
    let data = { orders: [] };
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, 'utf8');
      data = JSON.parse(fileContent);
    }
    if (!data.orders) data.orders = [];
    const order = {
      id: Date.now().toString(),
      ...orderData,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    data.orders.push(order);
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log('Order saved:', order.id);
    return order;
  } catch (error) {
    console.error('Database save error:', error);
    throw error;
  }
}

export async function getAllOrders() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    const fileContent = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(fileContent);
    return data.orders || [];
  } catch (error) {
    console.error('Database read error:', error);
    return [];
  }
}

export async function getOrderById(orderId) {
  try {
    const orders = await getAllOrders();
    return orders.find(order => order.id === orderId);
  } catch (error) {
    console.error('Database search error:', error);
    return null;
  }
}

export async function getPendingOrders() {
  try {
    const orders = await getAllOrders();
    return orders.filter(order => !order.status || order.status === 'pending');
  } catch (error) {
    console.error('Pending orders error:', error);
    return [];
  }
}

export async function searchOrderByMobile(mobile) {
  try {
    const orders = await getAllOrders();
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    return orders.filter(order => order.mobile && order.mobile.includes(cleanMobile));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export async function getTodayOrders() {
  try {
    const orders = await getAllOrders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
  } catch (error) {
    console.error('Today orders error:', error);
    return [];
  }
}

export async function getOrderStats() {
  try {
    const orders = await getAllOrders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    
    const monthOrders = orders.filter(o => new Date(o.createdAt) >= thisMonthStart);
    const pendingOrders = orders.filter(o => !o.status || o.status === 'pending');
    const completedOrders = orders.filter(o => o.status === 'completed');
    
    const sessionStats = {};
    orders.forEach(order => {
      const session = order.sessionName || 'Unknown';
      sessionStats[session] = (sessionStats[session] || 0) + 1;
    });
    
    const bookStats = {};
    orders.forEach(order => {
      const book = order.bookName || 'Unknown';
      bookStats[book] = (bookStats[book] || 0) + 1;
    });
    
    return {
      total: orders.length,
      today: todayOrders.length,
      thisMonth: monthOrders.length,
      pending: pendingOrders.length,
      completed: completedOrders.length,
      sessionStats,
      bookStats
    };
  } catch (error) {
    console.error('Stats error:', error);
    return { total: 0, today: 0, thisMonth: 0, pending: 0, completed: 0, sessionStats: {}, bookStats: {} };
  }
}

export async function exportOrdersToCSV() {
  try {
    const orders = await getAllOrders();
    if (orders.length === 0) return null;
    
    const headers = ['Order ID', 'Name', 'Father', 'Mobile', 'Book', 'Language', 'Address', 'Pincode', 'District', 'State', 'Date', 'Status'];
    let csvContent = headers.join(',') + '\n';
    
    orders.forEach(order => {
      const row = [
        order.id || '',
        (order.name || '').replace(/,/g, ';'),
        (order.father || '').replace(/,/g, ';'),
        order.mobile || '',
        (order.bookName || '').replace(/,/g, ';'),
        order.language || '',
        (order.fullAddress || '').replace(/,/g, ';'),
        order.pincode || '',
        order.district || '',
        order.stateName || '',
        order.createdAt || '',
        order.status || 'pending'
      ];
      csvContent += row.join(',') + '\n';
    });
    
    const timestamp = new Date().toISOString().split('T')[0];
    const csvFileName = `orders_export_${timestamp}.csv`;
    const csvFilePath = path.join(DB_DIR, csvFileName);
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');
    console.log('CSV exported:', csvFilePath);
    return csvFilePath;
  } catch (error) {
    console.error('CSV export error:', error);
    return null;
  }
}

export default { saveOrder, getAllOrders, getOrderById, getPendingOrders, searchOrderByMobile, getOrderStats, getTodayOrders, exportOrdersToCSV };
