const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1] || 
                  req.cookies?.token || 
                  req.query?.token;

    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Access token required' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid or expired token' 
            });
        }
        req.user = decoded;
        next();
    });
};

const generateToken = (userId, username) => {
    return jwt.sign(
        { 
            userId: userId, // MongoDB ObjectId string olarak saklanacak
            username: username,
            timestamp: Date.now()
        }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
    );
};

// Admin yetkilendirme middleware'i (opsiyonel - eğer admin.js'de kullanıyorsanız)
const requireAdmin = (req, res, next) => {
    // Bu kısmı admin route'larınızın yapısına göre güncelleyebilirsiniz
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

module.exports = { 
    authenticateToken, 
    generateToken,
    requireAdmin // Eğer kullanıyorsanız
};