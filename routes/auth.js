const express = require('express');
const router = express.Router();
const { User, Finance } = require('../config/database'); // MongoDB modelleri
const { registerValidation, loginValidation, validateRequest } = require('../middleware/validation');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const { generateToken } = require('../middleware/auth');
const AESEncryption = require('../utils/encryption');
const TelegramAuth = require('../utils/telegramAuth');

// MongoDB User bulma fonksiyonu
const findUserByUsername = async (username) => {
    try {
        const user = await User.findOne({
            $or: [
                { username: username },
                { email: username }
            ]
        });
        return user;
    } catch (error) {
        console.error('User find error:', error);
        throw error;
    }
};

// MongoDB User oluşturma fonksiyonu
const createUser = async (userData) => {
    const { username, email, password, pay_password, ref_code, ref_by } = userData;
    
    console.log('🔐 Before encryption:', {
        username,
        password: password,
        pay_password: pay_password
    });

    const encryptedPassword = AESEncryption.encryptPassword(password);
    const encryptedPayPassword = AESEncryption.encryptPayPassword(pay_password);

    console.log('🔐 After encryption:', {
        encryptedPassword: encryptedPassword ? encryptedPassword.substring(0, 20) + '...' : 'null',
        encryptedPayPassword: encryptedPayPassword ? encryptedPayPassword.substring(0, 20) + '...' : 'null'
    });

    if (!encryptedPassword || !encryptedPayPassword) {
        throw new Error('Password encryption failed');
    }

    try {
        // User oluştur
        const user = new User({
            username,
            email,
            password: encryptedPassword,
            pay_password: encryptedPayPassword,
            ref_code,
            ref_by: ref_by || null,
            tg_username: null,
            tg_verified: false,
            vip_level: 0,
            status: 'active'
        });

        const savedUser = await user.save();
        console.log('✅ User created with ID:', savedUser._id);

        // Finance kaydı oluştur
        const finance = new Finance({
            user_id: savedUser._id,
            total_balance: 0,
            locked_balance: 0,
            available_balance: 0,
            total_earned: 0,
            total_withdrawn: 0
        });

        await finance.save();
        console.log('✅ Finance record created for user:', savedUser._id);

        return savedUser._id;

    } catch (error) {
        console.error('❌ User creation error:', error);
        throw error;
    }
};

router.post('/login',
    loginLimiter,
    loginValidation,
    validateRequest,
    async (req, res) => {
        try {
            const { username, password } = req.body;

            console.log('🔐 Login attempt for:', username);
            console.log('🔐 Input password:', password);

            const user = await findUserByUsername(username);
            if (!user) {
                console.log('❌ User not found:', username);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            console.log('✅ User found:', user.username);
            console.log('🔐 Stored password hash:', user.password ? user.password.substring(0, 20) + '...' : 'null');

            const isPasswordValid = AESEncryption.comparePassword(password, user.password);
            
            if (!isPasswordValid) {
                console.log('❌ Password comparison failed for user:', username);
                
                // Debug için şifreyi tekrar şifrele ve karşılaştır
                const testEncrypt = AESEncryption.encryptPassword(password);
                console.log('🔐 Test encryption:', testEncrypt ? testEncrypt.substring(0, 20) + '...' : 'null');
                console.log('🔐 Stored password:', user.password ? user.password.substring(0, 20) + '...' : 'null');
                console.log('🔐 Direct comparison:', testEncrypt === user.password);
                
                return res.status(400).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            if (user.status !== 'active') {
                console.log('❌ Account not active:', username);
                return res.status(400).json({
                    success: false,
                    message: 'Account is not active'
                });
            }

            const token = generateToken(user._id, user.username);

            console.log('✅ Login successful for:', username);

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    userId: user._id,
                    username: user.username,
                    email: user.email,
                    vip_level: user.vip_level
                }
            });

        } catch (error) {
            console.error('❌ Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
);

router.post('/register', 
    registerLimiter,
    registerValidation,
    validateRequest,
    async (req, res) => {
        try {
            const { username, email, password, pay_password, ref_code } = req.body;
            
            console.log('👤 Registration attempt:', { username, email });

            // Telegram doğrulama artık gerekmiyor - kaldırıldı
            
            const existingUser = await findUserByUsername(username);
            if (existingUser) {
                console.log('❌ User already exists:', username);
                return res.status(400).json({
                    success: false,
                    message: 'Username or email already exists'
                });
            }

            let ref_by = null;
            if (ref_code) {
                const referrer = await User.findOne({ ref_code: ref_code });
                if (referrer) ref_by = referrer._id;
            }
            
            const userRefCode = 'REF' + Date.now().toString().slice(-6);

            const userId = await createUser({
                username,
                email,
                password,
                pay_password,
                ref_code: userRefCode,
                ref_by
            });

            const token = generateToken(userId, username);

            console.log('✅ Registration successful for:', username);

            res.json({
                success: true,
                message: 'Registration successful',
                token,
                user: { 
                    userId, 
                    username, 
                    email, 
                    ref_code: userRefCode,
                    vip_level: 0 
                }
            });
            
        } catch (error) {
            console.error('❌ Registration error:', error);
            
            // MongoDB duplicate key error handling
            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: 'Username or email already exists'
                });
            }
            
            res.status(500).json({
                success: false,
                message: 'Internal server error: ' + error.message
            });
        }
    }
);

// Bot status endpoint
router.get('/telegram-bot-status', (req, res) => {
    try {
        const status = TelegramAuth.getBotStatus();
        res.json({
            success: true,
            bot_status: status
        });
    } catch (error) {
        console.error('Bot status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bot status'
        });
    }
});

// Test endpoint - AES encryption test
router.post('/test-encryption', (req, res) => {
    const { text } = req.body;
    
    if (!text) {
        return res.status(400).json({
            success: false,
            message: 'Text is required'
        });
    }
    
    try {
        const encrypted = AESEncryption.encrypt(text);
        const decrypted = AESEncryption.decrypt(encrypted);
        
        res.json({
            success: true,
            original: text,
            encrypted: encrypted,
            decrypted: decrypted,
            match: text === decrypted
        });
    } catch (error) {
        console.error('Test encryption error:', error);
        res.status(500).json({
            success: false,
            message: 'Encryption test failed'
        });
    }
});

module.exports = router;