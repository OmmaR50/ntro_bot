const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Database initialization - MongoDB bağlantısı
const { connection } = require('./config/database');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const miningRoutes = require('./routes/mining');
const financeRoutes = require('./routes/finance');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/mining', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'mining.html'));
});

app.get('/wallet', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'wallet.html'));
});

app.get('/finance', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'finance.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});

app.get('/404', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', '404.html'));
});

// Database connection status endpoint (opsiyonel)
app.get('/api/health', async (req, res) => {
    try {
        const dbStatus = connection.readyState === 1 ? 'connected' : 'disconnected';
        res.json({
            success: true,
            database: dbStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database health check failed'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler - Tüm tanımlanmamış route'lar için 404 sayfası göster
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Server başlatma
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`📧 Admin Login: ${process.env.ADMIN_USERNAME}`);
    console.log(`🔗 Access the app at: http://localhost:${PORT}`);
    console.log(`🔗 Admin Login: http://localhost:${PORT}/admin-login`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Telegram Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Not set'}`);
});