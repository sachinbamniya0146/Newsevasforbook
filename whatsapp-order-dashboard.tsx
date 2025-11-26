import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { User, Package, TrendingUp, Clock, Phone, MapPin, Book, Globe, Calendar, Activity, Bell, LogOut, Menu, X, QrCode, Smartphone, Search, Filter, ChevronDown, ChevronUp, Eye, Download } from 'lucide-react';

// API Base URL (change this for production)
const API_BASE = 'http://localhost:5000/api';

// Color palette
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Main App Component
export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return <DashboardLayout onLogout={() => setIsAuthenticated(false)} />;
}

// Login Page
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('authToken', data.token);
        onLogin();
      } else {
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Package className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp Order Seva</h1>
          <p className="text-gray-600">Professional Admin Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Demo Credentials:</p>
          <p className="font-mono mt-1">satguru5505 / 5505</p>
        </div>
      </div>
    </div>
  );
}

// Dashboard Layout
function DashboardLayout({ onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold text-gray-900">Order Seva</h2>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<Activity />} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} collapsed={!sidebarOpen} />
          <NavItem icon={<Package />} label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} collapsed={!sidebarOpen} />
          <NavItem icon={<Smartphone />} label="Sessions" active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} collapsed={!sidebarOpen} />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'orders' && 'Order Management'}
                {activeTab === 'sessions' && 'WhatsApp Sessions'}
              </h1>
              <p className="text-sm text-gray-600 mt-1">Welcome back, Admin</p>
            </div>
            <div className="flex items-center space-x-4">
              <Bell className="w-6 h-6 text-gray-600 cursor-pointer hover:text-gray-900" />
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                  A
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'orders' && <OrdersTab />}
          {activeTab === 'sessions' && <SessionsTab />}
        </div>
      </main>
    </div>
  );
}

// Navigation Item
function NavItem({ icon, label, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
        active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <div className={active ? 'text-blue-600' : 'text-gray-500'}>{icon}</div>
      {!collapsed && <span className="font-medium">{label}</span>}
    </button>
  );
}

// Overview Tab
function OverviewTab() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSummary = async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/summary`);
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div></div>;
  }

  const stats = [
    { label: "Today's Orders", value: summary?.todayCount || 0, icon: <Calendar />, color: 'blue' },
    { label: "Yesterday", value: summary?.yesterdayCount || 0, icon: <Clock />, color: 'green' },
    { label: "This Week", value: summary?.weekCount || 0, icon: <TrendingUp />, color: 'yellow' },
    { label: "This Month", value: summary?.monthCount || 0, icon: <Package />, color: 'purple' },
    { label: "Total Orders", value: summary?.totalCount || 0, icon: <Activity />, color: 'indigo' }
  ];

  const bookData = summary?.bookStats ? Object.entries(summary.bookStats).map(([name, value]) => ({ name, value })) : [];
  const weeklyData = summary?.weeklyData || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {stats.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Book Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Book Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={bookData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {bookData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ label, value, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

// Orders Tab
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: 100 });
      const response = await fetch(`${API_BASE}/orders?${params}`);
      const data = await response.json();
      setOrders(data.data || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.mobile?.includes(searchTerm) ||
    order.bookName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, mobile, or book..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(order.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.mobile}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.bookName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.district}, {order.stateName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  );
}

// Order Detail Modal
function OrderDetailModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <DetailItem label="Name" value={order.name} icon={<User className="w-5 h-5" />} />
            <DetailItem label="Father's Name" value={order.father} icon={<User className="w-5 h-5" />} />
            <DetailItem label="Mobile" value={order.mobile} icon={<Phone className="w-5 h-5" />} />
            <DetailItem label="Book" value={order.bookName} icon={<Book className="w-5 h-5" />} />
            <DetailItem label="Language" value={order.language} icon={<Globe className="w-5 h-5" />} />
            <DetailItem label="Status" value={order.status || 'pending'} icon={<Activity className="w-5 h-5" />} />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Address</h3>
            <div className="space-y-3">
              <DetailItem label="Address" value={order.address} icon={<MapPin className="w-5 h-5" />} />
              <div className="grid grid-cols-3 gap-4">
                <DetailItem label="Pincode" value={order.pincode} />
                <DetailItem label="District" value={order.district} />
                <DetailItem label="State" value={order.stateName} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <DetailItem 
              label="Order Time" 
              value={new Date(order.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} 
              icon={<Clock className="w-5 h-5" />} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, icon }) {
  return (
    <div>
      <div className="flex items-center space-x-2 mb-1">
        {icon && <div className="text-gray-400">{icon}</div>}
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-base text-gray-900 font-medium">{value}</p>
    </div>
  );
}

// Sessions Tab
function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <SessionCard key={session.sessionName} session={session} />
        ))}
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  const handleGenerateQR = async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${session.sessionName}/qr`, { method: 'POST' });
      const data = await response.json();
      setQrData(data.qrDataUrl);
      setShowQR(true);
    } catch (error) {
      console.error('Failed to generate QR:', error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{session.sessionName}</h3>
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
          session.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {session.isActive ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="space-y-3 mb-4">
        <div className="text-sm text-gray-600">
          Last connected: {session.lastConnectedAt ? new Date(session.lastConnectedAt).toLocaleString('en-IN') : 'Never'}
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={handleGenerateQR}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
        >
          <QrCode className="w-4 h-4 inline mr-2" />
          QR Code
        </button>
      </div>

      {showQR && qrData && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <img src={qrData} alt="QR Code" className="w-full" />
          <button onClick={() => setShowQR(false)} className="mt-2 w-full text-sm text-gray-600 hover:text-gray-900">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
