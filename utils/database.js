import fs from 'fs';
import path from 'path';

const DB_DIR = '/sdcard/DCIM/gyan ganga seva/orders';
const DB_FILE = path.join(DB_DIR, 'orders.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Ensure database file exists
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
    
    console.log('✅ Order saved to database:', order.id);
    return order;
  } catch (error) {
    console.error('❌ Database save error:', error);
    throw error;
  }
}

export async function getAllOrders() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return [];
    }
    
    const fileContent = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(fileContent);
    
    return data.orders || [];
  } catch (error) {
    console.error('❌ Database read error:', error);
    return [];
  }
}

export async function getOrderById(orderId) {
  try {
    const orders = await getAllOrders();
    return orders.find(order => order.id === orderId);
  } catch (error) {
    console.error('❌ Database search error:', error);
    return null;
  }
}

export async function getOrderStats() {
  try {
    const orders = await getAllOrders();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const monthOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= thisMonth;
    });
    
    const pendingOrders = orders.filter(order => 
      order.status === 'pending' || !order.status
    );
    
    const completedOrders = orders.filter(order => 
      order.status === 'completed'
    );
    
    // Session-wise stats
    const sessionStats = {};
    orders.forEach(order => {
      const session = order.sessionName || 'Unknown';
      if (!sessionStats[session]) {
        sessionStats[session] = 0;
      }
      sessionStats[session]++;
    });
    
    // Book-wise stats
    const bookStats = {};
    orders.forEach(order => {
      const book = order.bookName || 'Unknown';
      if (!bookStats[book]) {
        bookStats[book] = 0;
      }
      bookStats[book]++;
    });
    
    return {
      total: orders.length,
      today: todayOrders.length,
      thisMonth: monthOrders.length,
      pending: pendingOrders.length,
      completed: completedOrders.length,
      sessionStats: sessionStats,
      bookStats: bookStats
    };
  } catch (error) {
    console.error('❌ Stats error:', error);
    return {
      total: 0,
      today: 0,
      thisMonth: 0,
      pending: 0,
      completed: 0,
      sessionStats: {},
      bookStats: {}
    };
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
    console.error('❌ Today orders error:', error);
    return [];
  }
}

export async function getPendingOrders() {
  try {
    const orders = await getAllOrders();
    return orders.filter(order => 
      order.status === 'pending' || !order.status
    );
  } catch (error) {
    console.error('❌ Pending orders error:', error);
    return [];
  }
}

export async function searchOrderByMobile(mobile) {
  try {
    const orders = await getAllOrders();
    return orders.filter(order => 
      order.mobile && order.mobile.includes(mobile)
    );
  } catch (error) {
    console.error('❌ Search error:', error);
    return [];
  }
}

export async function updateOrderStatus(orderId, status) {
  try {
    let data = { orders: [] };
    
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, 'utf8');
      data = JSON.parse(fileContent);
    }
    
    const orderIndex = data.orders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) {
      return null;
    }
    
    data.orders[orderIndex].status = status;
    data.orders[orderIndex].updatedAt = new Date().toISOString();
    
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    
    console.log('✅ Order status updated:', orderId, status);
    return data.orders[orderIndex];
  } catch (error) {
    console.error('❌ Update error:', error);
    return null;
  }
}

export async function deleteOrder(orderId) {
  try {
    let data = { orders: [] };
    
    if (fs.existsSync(DB_FILE)) {
      const fileContent = fs.readFileSync(DB_FILE, 'utf8');
      data = JSON.parse(fileContent);
    }
    
    const initialLength = data.orders.length;
    data.orders = data.orders.filter(order => order.id !== orderId);
    
    if (data.orders.length === initialLength) {
      return false;
    }
    
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    
    console.log('✅ Order deleted:', orderId);
    return true;
  } catch (error) {
    console.error('❌ Delete error:', error);
    return false;
  }
}

export async function getOrdersByDateRange(startDate, endDate) {
  try {
    const orders = await getAllOrders();
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });
  } catch (error) {
    console.error('❌ Date range error:', error);
    return [];
  }
}

export async function exportOrdersToCSV() {
  try {
    const orders = await getAllOrders();
    
    if (!orders.length) {
      return null;
    }
    
    // CSV Header
    let csv = 'ID,Name,Father,Mobile,Book,Language,PostOffice,Address,Pincode,District,State,Status,Created At\n';
    
    // CSV Rows
    orders.forEach(order => {
      csv += `"${order.id}",`;
      csv += `"${order.name}",`;
      csv += `"${order.father}",`;
      csv += `"${order.mobile}",`;
      csv += `"${order.bookName}",`;
      csv += `"${order.language}",`;
      csv += `"${order.postOffice || ''}",`;
      csv += `"${order.address}",`;
      csv += `"${order.pincode}",`;
      csv += `"${order.district}",`;
      csv += `"${order.stateName}",`;
      csv += `"${order.status || 'pending'}",`;
      csv += `"${order.createdAt}"\n`;
    });
    
    const csvPath = path.join(DB_DIR, `orders_export_${Date.now()}.csv`);
    fs.writeFileSync(csvPath, csv);
    
    console.log('✅ Orders exported to CSV:', csvPath);
    return csvPath;
  } catch (error) {
    console.error('❌ Export error:', error);
    return null;
  }
}
