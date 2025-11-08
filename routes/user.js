const express = require('express');
const router = express.Router();
const { User, Finance, Wallet, Mining, Machine, VIP, Referral, Transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const TelegramAuth = require('../utils/telegramAuth');

// Kullanıcı profil bilgileri
router.get('/profile', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('📱 Profile request for user:', userId);

        // Kullanıcı ve finance bilgilerini paralel olarak al
        const [user, finance] = await Promise.all([
            User.findOne({ _id: userId, status: 'active' }),
            Finance.findOne({ user_id: userId })
        ]);

        if (!user) {
            console.log('❌ User not found:', userId);
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ User found:', user.username);

        // Eğer finance kaydı yoksa oluştur
        if (!finance) {
            console.log('📊 Creating finance record for user:', userId);
            const newFinance = new Finance({
                user_id: userId,
                total_balance: 0,
                locked_balance: 0,
                available_balance: 0,
                total_earned: 0,
                total_withdrawn: 0
            });
            await newFinance.save();
        }

        const responseData = {
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                tg_username: user.tg_username,
                tg_verified: user.tg_verified || false,
                ref_code: user.ref_code,
                vip_level: user.vip_level || 0,
                created_at: user.created_at
            },
            finance: {
                total_balance: finance?.total_balance || 0,
                locked_balance: finance?.locked_balance || 0,
                available_balance: finance?.available_balance || 0,
                total_earned: finance?.total_earned || 0,
                total_withdrawn: finance?.total_withdrawn || 0
            }
        };

        console.log('📤 Sending profile data:', {
            username: responseData.user.username,
            vip_level: responseData.user.vip_level,
            tg_verified: responseData.user.tg_verified,
            available_balance: responseData.finance.available_balance
        });

        res.json(responseData);

    } catch (error) {
        console.error('❌ Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

// Telegram doğrulama kodu gönderme
router.post('/request-telegram-verification', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { telegram_username } = req.body;

        if (!telegram_username) {
            return res.status(400).json({
                success: false,
                message: 'Telegram username is required'
            });
        }

        const cleanUsername = telegram_username.replace('@', '');

        // Kullanıcıyı bul
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Telegram username zaten doğrulanmış mı?
        if (user.tg_verified) {
            return res.status(400).json({
                success: false,
                message: 'Telegram is already verified'
            });
        }

        // Telegram username başkası tarafından kullanılıyor mu?
        const existingUser = await User.findOne({ 
            tg_username: cleanUsername, 
            _id: { $ne: userId },
            tg_verified: true 
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'This Telegram username is already verified by another user'
            });
        }

        // Doğrulama kodu gönder
        const result = await TelegramAuth.sendVerificationCode(cleanUsername);
        
        if (result.success) {
            // Kullanıcının telegram username'ini güncelle (henüz doğrulanmamış)
            await User.updateOne(
                { _id: userId },
                { 
                    tg_username: cleanUsername, 
                    tg_verified: false,
                    updated_at: new Date()
                }
            );

            res.json({
                success: true,
                message: result.message,
                code: result.code,
                bot_status: TelegramAuth.getBotStatus()
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }

    } catch (error) {
        console.error('Telegram verification request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send verification code'
        });
    }
});

// Telegram doğrulama kodu onaylama
router.post('/verify-telegram', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { verification_code } = req.body;

        if (!verification_code) {
            return res.status(400).json({
                success: false,
                message: 'Verification code is required'
            });
        }

        // Kullanıcıyı ve telegram bilgilerini al
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!user.tg_username) {
            return res.status(400).json({
                success: false,
                message: 'No Telegram username found. Please request a verification code first.'
            });
        }

        if (user.tg_verified) {
            return res.status(400).json({
                success: false,
                message: 'Telegram is already verified'
            });
        }

        // Kodu doğrula
        const verifyResult = TelegramAuth.verifyCode(user.tg_username, verification_code);
        
        if (verifyResult.success) {
            // Telegram'ı doğrulanmış olarak işaretle
            await User.updateOne(
                { _id: userId },
                { 
                    tg_verified: true,
                    updated_at: new Date()
                }
            );

            console.log('✅ Telegram verified for user:', userId);
            
            res.json({
                success: true,
                message: 'Telegram verification successful! Your account is now verified.',
                telegram_verified: true
            });
        } else {
            res.status(400).json({
                success: false,
                message: verifyResult.message
            });
        }

    } catch (error) {
        console.error('Telegram verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Verification failed'
        });
    }
});

// Telegram doğrulama durumunu getir
router.get('/telegram-status', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        const user = await User.findOne({ _id: userId }, 'tg_username tg_verified');
        
        res.json({
            success: true,
            telegram: {
                username: user?.tg_username,
                verified: user?.tg_verified || false
            }
        });

    } catch (error) {
        console.error('Telegram status query error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Dashboard verileri
router.get('/dashboard', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('📊 Dashboard request for user:', userId);

        // Tüm gerekli verileri paralel olarak al
        const [user, finance, miningStats, referralCount] = await Promise.all([
            User.findOne({ _id: userId, status: 'active' }, 'username email vip_level ref_code created_at'),
            Finance.findOne({ user_id: userId }, 'available_balance total_balance total_earned'),
            Mining.aggregate([
                { $match: { user_id: userId, status: 'active' } },
                { 
                    $group: {
                        _id: null,
                        active_miners: { $sum: 1 },
                        total_earned: { $sum: '$total_earning' },
                        daily_income: { $sum: '$daily_earning' }
                    }
                }
            ]),
            User.countDocuments({ ref_by: userId })
        ]);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const miningData = miningStats.length > 0 ? miningStats[0] : {};

        const responseData = {
            success: true,
            user: {
                username: user.username,
                email: user.email,
                vip_level: user.vip_level || 0,
                ref_code: user.ref_code,
                member_since: user.created_at
            },
            stats: {
                balance: finance?.available_balance || 0,
                total_balance: finance?.total_balance || 0,
                total_earned: finance?.total_earned || 0,
                active_miners: miningData.active_miners || 0,
                daily_income: miningData.daily_income || 0,
                total_referrals: referralCount || 0
            }
        };

        console.log('📤 Sending dashboard data');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Dashboard query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data'
        });
    }
});

// Wallet verileri
router.get('/wallet', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('👛 Wallet request for user:', userId);

        const [finance, wallet, transactions] = await Promise.all([
            Finance.findOne({ user_id: userId }),
            Wallet.findOne({ user_id: userId }),
            Transaction.find({
                $or: [{ receiver_id: userId }, { sender_id: userId }]
            }).sort({ date: -1 }).limit(10)
        ]);

        const responseData = {
            success: true,
            balance: {
                available: finance?.available_balance || 0,
                total: finance?.total_balance || 0,
                earned: finance?.total_earned || 0,
                withdrawn: finance?.total_withdrawn || 0
            },
            wallet: wallet || {
                wallet_address: '',
                deposit_address: ''
            },
            transactions: transactions || []
        };

        console.log('📤 Sending wallet data');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Wallet query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load wallet data'
        });
    }
});

// Mining verileri
router.get('/mining', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('⛏️ Mining request for user:', userId);

        const [activeMining, availableMachines, miningStats] = await Promise.all([
            Mining.find({ user_id: userId, status: 'active' })
                .populate('machine_id', 'machine_name hashrate'),
            Machine.find({ status: 'active' }),
            Mining.aggregate([
                { $match: { user_id: userId, status: 'active' } },
                { 
                    $group: {
                        _id: null,
                        active_count: { $sum: 1 },
                        total_earned: { $sum: '$total_earning' },
                        daily_income: { $sum: '$daily_earning' }
                    }
                }
            ])
        ]);

        const stats = miningStats.length > 0 ? miningStats[0] : {};

        const responseData = {
            success: true,
            active_mining: activeMining || [],
            available_machines: availableMachines || [],
            stats: {
                active_count: stats.active_count || 0,
                total_earned: stats.total_earned || 0,
                daily_income: stats.daily_income || 0
            }
        };

        console.log('📤 Sending mining data');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Mining query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load mining data'
        });
    }
});

// Finance verileri
router.get('/finance', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('💰 Finance request for user:', userId);

        const [finance, transactions, earnings] = await Promise.all([
            Finance.findOne({ user_id: userId }),
            Transaction.find({
                $or: [{ receiver_id: userId }, { sender_id: userId }]
            }).sort({ date: -1 }).limit(50),
            Mining.aggregate([
                { $match: { user_id: userId, status: 'active' } },
                { 
                    $group: {
                        _id: null,
                        daily_earnings: { $sum: '$daily_earning' }
                    }
                }
            ])
        ]);

        const earningsData = earnings.length > 0 ? earnings[0] : {};

        const responseData = {
            success: true,
            balance: {
                available: finance?.available_balance || 0,
                total: finance?.total_balance || 0,
                earned: finance?.total_earned || 0,
                withdrawn: finance?.total_withdrawn || 0,
                daily_earnings: earningsData.daily_earnings || 0
            },
            transactions: transactions || []
        };

        console.log('📤 Sending finance data');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Finance query error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load finance data'
        });
    }
});

// Referral bilgileri
router.get('/referrals', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('📱 Referrals request for user:', userId);

        const [referrals, totalEarnings] = await Promise.all([
            User.find({ ref_by: userId }, 'username created_at _id')
                .sort({ created_at: -1 }),
            Referral.aggregate([
                { $match: { referrer_id: userId } },
                { 
                    $group: {
                        _id: null,
                        total_earned: { $sum: '$earned_amount' }
                    }
                }
            ])
        ]);

        const referralsWithEarnings = referrals.map(ref => ({
            username: ref.username,
            created_at: ref.created_at,
            earned_amount: 0 // Şimdilik 0, daha sonra REFERRAL tablosundan alınabilir
        }));

        const totalEarned = totalEarnings.length > 0 ? totalEarnings[0].total_earned : 0;

        const responseData = {
            success: true,
            referrals: referralsWithEarnings,
            total_earned: totalEarned
        };

        console.log('📤 Sending referrals data');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Referrals query error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Profil güncelleme
router.put('/profile', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { username, email } = req.body;

        console.log('📱 Profile update for user:', userId, { username, email });

        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: 'Username and email are required'
            });
        }

        const currentUser = await User.findOne({ _id: userId });
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Username değiştiyse kontrol et
        if (username !== currentUser.username) {
            const existingUsername = await User.findOne({ 
                username: username, 
                _id: { $ne: userId } 
            });
            if (existingUsername) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
        }

        // Email değiştiyse kontrol et
        if (email !== currentUser.email) {
            const existingEmail = await User.findOne({ 
                email: email, 
                _id: { $ne: userId } 
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already taken'
                });
            }
        }

        // Profili güncelle
        await User.updateOne(
            { _id: userId },
            { 
                username: username,
                email: email,
                updated_at: new Date()
            }
        );

        console.log('✅ Profile updated successfully');
        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('❌ Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Update failed'
        });
    }
});

// Payment password değiştirme
router.put('/change-pay-password', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { current_password, new_password } = req.body;

        console.log('📱 Change pay password for user:', userId);

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Current and new password required'
            });
        }

        if (new_password.length < 4 || new_password.length > 6 || !/^\d+$/.test(new_password)) {
            return res.status(400).json({
                success: false,
                message: 'Payment password must be 4-6 digits (numbers only)'
            });
        }

        const user = await User.findOne({ _id: userId });
        if (!user || !user.pay_password) {
            return res.status(400).json({
                success: false,
                message: 'User not found or no payment password set'
            });
        }

        // Şifre karşılaştırma - basit versiyon
        if (current_password !== user.pay_password) {
            return res.status(400).json({
                success: false,
                message: 'Current payment password is incorrect'
            });
        }

        // Yeni şifreyi kaydet
        await User.updateOne(
            { _id: userId },
            { 
                pay_password: new_password,
                updated_at: new Date()
            }
        );

        console.log('✅ Payment password updated successfully');
        res.json({
            success: true,
            message: 'Payment password updated successfully'
        });

    } catch (error) {
        console.error('❌ Password update error:', error);
        res.status(500).json({
            success: false,
            message: 'Update failed'
        });
    }
});

// VIP bilgilerini getir
router.get('/vip-info', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('📱 VIP info request for user:', userId);

        const [user, vipLevels, finance] = await Promise.all([
            User.findOne({ _id: userId }, 'vip_level'),
            VIP.find().sort({ vip_level: 1 }),
            Finance.findOne({ user_id: userId }, 'available_balance')
        ]);

        const currentVipLevel = user?.vip_level || 0;
        const availableBalance = finance?.available_balance || 0;

        // VIP seviyelerini işle
        const processedVipLevels = vipLevels.map(level => ({
            level: level.vip_level,
            name: level.vip_name,
            price: level.vip_price,
            features: level.vip_features ? level.vip_features.split(', ') : [],
            withdrawal_fee: level.withdrawal_fee,
            min_withdrawal: level.min_withdrawal,
            referral_bonus: level.referral_bonus,
            is_current: level.vip_level === currentVipLevel,
            can_upgrade: level.vip_level > currentVipLevel && availableBalance >= level.vip_price,
            upgrade_cost: level.vip_price
        }));

        const responseData = {
            success: true,
            current_vip_level: currentVipLevel,
            available_balance: availableBalance,
            vip_levels: processedVipLevels
        };

        console.log('📤 Sending VIP info');
        res.json(responseData);

    } catch (error) {
        console.error('❌ VIP info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load VIP information'
        });
    }
});

// VIP seviye yükseltme
router.post('/upgrade-vip', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { vip_level } = req.body;

        console.log('📱 VIP upgrade request:', { userId, vip_level });

        if (vip_level === undefined || vip_level === null || vip_level < 1 || vip_level > 2) {
            return res.status(400).json({
                success: false,
                message: 'Invalid VIP level. Must be 1 (Silver) or 2 (Gold)'
            });
        }

        // Mevcut kullanıcı ve VIP bilgilerini al
        const [user, vipInfo, finance] = await Promise.all([
            User.findOne({ _id: userId }),
            VIP.findOne({ vip_level: vip_level }),
            Finance.findOne({ user_id: userId })
        ]);

        // Kontroller
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!vipInfo) {
            return res.status(400).json({
                success: false,
                message: 'Invalid VIP level'
            });
        }

        if (!finance) {
            return res.status(400).json({
                success: false,
                message: 'Finance record not found'
            });
        }

        const currentVipLevel = user.vip_level || 0;
        const vipPrice = vipInfo.vip_price;
        const availableBalance = finance.available_balance || 0;

        console.log('🔍 VIP upgrade check:', {
            currentVipLevel,
            targetVipLevel: vip_level,
            vipPrice,
            availableBalance
        });

        // VIP seviye kontrolü
        if (currentVipLevel >= vip_level) {
            return res.status(400).json({
                success: false,
                message: `You are already ${vip_level === 1 ? 'Silver' : 'Gold'} VIP or higher`
            });
        }

        // Sıralı yükseltme kontrolü
        if (vip_level - currentVipLevel > 1) {
            return res.status(400).json({
                success: false,
                message: `Please upgrade to ${vip_level === 2 ? 'Silver' : 'Bronze'} first`
            });
        }

        // Bakiye kontrolü
        if (availableBalance < vipPrice) {
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. Need ${vipPrice} TRX but only have ${availableBalance} TRX`
            });
        }

        // MongoDB transaction başlat
        const session = await User.startSession();
        session.startTransaction();

        try {
            // Bakiyeyi güncelle
            await Finance.updateOne(
                { user_id: userId },
                { 
                    $inc: { 
                        available_balance: -vipPrice,
                        total_balance: -vipPrice
                    },
                    updated_at: new Date()
                },
                { session }
            );

            // VIP seviyesini güncelle
            await User.updateOne(
                { _id: userId },
                { 
                    vip_level: vip_level,
                    updated_at: new Date()
                },
                { session }
            );

            // Transaction kaydı
            const transaction = new Transaction({
                receiver_id: userId,
                amount: -vipPrice,
                transaction_type: `vip_upgrade_${vipInfo.vip_name.toLowerCase()}`,
                status: 'completed'
            });
            await transaction.save({ session });

            // Transaction'ı commit et
            await session.commitTransaction();
            session.endSession();

            console.log('✅ VIP upgrade successful for user:', userId);
            
            res.json({
                success: true,
                message: `Successfully upgraded to ${vipInfo.vip_name} VIP!`,
                new_vip_level: vip_level,
                amount_paid: vipPrice
            });

        } catch (transactionError) {
            // Hata durumunda rollback
            await session.abortTransaction();
            session.endSession();
            throw transactionError;
        }

    } catch (error) {
        console.error('❌ VIP upgrade error:', error);
        res.status(500).json({
            success: false,
            message: 'VIP upgrade failed: ' + error.message
        });
    }
});

module.exports = router;