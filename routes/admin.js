const express = require('express');
const router = express.Router();
const { User, Finance, Mining, Transaction, Machine, Referral, Investment } = require('../config/database');
const { authenticateToken, generateToken } = require('../middleware/auth');
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require('../config/constants');
const AESEncryption = require('../utils/encryption');

// Admin girişi
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateToken('admin', 'admin');
        res.json({
            success: true,
            message: 'Admin login successful',
            token,
            user: {
                userId: 'admin',
                username: 'admin',
                isAdmin: true
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid admin credentials'
        });
    }
});

// Admin middleware
const isAdmin = (req, res, next) => {
    if (req.user && req.user.username === 'admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
};

// Admin dashboard
router.get('/dashboard', authenticateToken, isAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            activeMining,
            totalBalance,
            todayTransactions,
            newUsersToday,
            totalWithdrawals
        ] = await Promise.all([
            User.countDocuments(),
            Mining.countDocuments({ status: 'active' }),
            Finance.aggregate([{ $group: { _id: null, total: { $sum: '$total_balance' } } }]),
            Transaction.countDocuments({ 
                date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } 
            }),
            User.countDocuments({ 
                created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } 
            }),
            Transaction.aggregate([
                { 
                    $match: { 
                        transaction_type: 'withdrawal', 
                        status: 'completed',
                        amount: { $lt: 0 }
                    } 
                },
                { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
            ])
        ]);

        const stats = {
            total_users: totalUsers,
            active_mining: activeMining,
            total_balance: totalBalance.length > 0 ? totalBalance[0].total : 0,
            today_transactions: todayTransactions,
            new_users_today: newUsersToday,
            total_withdrawals: totalWithdrawals.length > 0 ? totalWithdrawals[0].total : 0
        };

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Kullanıcı listesi
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // Search filter
        let filter = {};
        if (search) {
            filter = {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const [users, totalUsers] = await Promise.all([
            User.aggregate([
                { $match: filter },
                {
                    $lookup: {
                        from: 'finances',
                        localField: '_id',
                        foreignField: 'user_id',
                        as: 'finance'
                    }
                },
                {
                    $lookup: {
                        from: 'minings',
                        localField: '_id',
                        foreignField: 'user_id',
                        as: 'mining'
                    }
                },
                {
                    $project: {
                        user_id: '$_id',
                        username: 1,
                        email: 1,
                        vip_level: 1,
                        created_at: 1,
                        status: 1,
                        total_balance: { $arrayElemAt: ['$finance.total_balance', 0] } || 0,
                        available_balance: { $arrayElemAt: ['$finance.available_balance', 0] } || 0,
                        active_miners: {
                            $size: {
                                $filter: {
                                    input: '$mining',
                                    as: 'mining',
                                    cond: { $eq: ['$$mining.status', 'active'] }
                                }
                            }
                        }
                    }
                },
                { $sort: { created_at: -1 } },
                { $skip: skip },
                { $limit: parseInt(limit) }
            ]),
            User.countDocuments(filter)
        ]);

        res.json({
            success: true,
            users: users || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalUsers,
                pages: Math.ceil(totalUsers / limit)
            }
        });

    } catch (error) {
        console.error('Admin users error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Kullanıcı detayları
router.get('/users/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await User.aggregate([
            { $match: { _id: userId } },
            {
                $lookup: {
                    from: 'finances',
                    localField: '_id',
                    foreignField: 'user_id',
                    as: 'finance'
                }
            },
            {
                $lookup: {
                    from: 'minings',
                    localField: '_id',
                    foreignField: 'user_id',
                    as: 'mining'
                }
            },
            {
                $lookup: {
                    from: 'referrals',
                    localField: '_id',
                    foreignField: 'referrer_id',
                    as: 'referrals'
                }
            },
            {
                $lookup: {
                    from: 'transactions',
                    localField: '_id',
                    foreignField: 'receiver_id',
                    as: 'deposits'
                }
            },
            {
                $lookup: {
                    from: 'transactions',
                    localField: '_id',
                    foreignField: 'sender_id',
                    as: 'withdrawals'
                }
            },
            {
                $project: {
                    user_id: '$_id',
                    username: 1,
                    email: 1,
                    vip_level: 1,
                    created_at: 1,
                    status: 1,
                    tg_username: 1,
                    tg_verified: 1,
                    ref_code: 1,
                    total_miners: { $size: '$mining' },
                    total_referrals: { $size: '$referrals' },
                    total_deposits: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$deposits',
                                        as: 'deposit',
                                        cond: { $gt: ['$$deposit.amount', 0] }
                                    }
                                },
                                as: 'deposit',
                                in: '$$deposit.amount'
                            }
                        }
                    },
                    total_withdrawals: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$withdrawals',
                                        as: 'withdrawal',
                                        cond: { $lt: ['$$withdrawal.amount', 0] }
                                    }
                                },
                                as: 'withdrawal',
                                in: { $abs: '$$withdrawal.amount' }
                            }
                        }
                    },
                    finance: { $arrayElemAt: ['$finance', 0] }
                }
            }
        ]);

        if (!user || user.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: user[0]
        });

    } catch (error) {
        console.error('Admin user detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Kullanıcı durumu güncelle
router.put('/users/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;

        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        await User.updateOne(
            { _id: userId },
            { 
                status: status,
                updated_at: new Date()
            }
        );

        res.json({
            success: true,
            message: `User status updated to ${status}`
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status'
        });
    }
});

// Kullanıcı bakiyesi güncelle
router.put('/users/:id/balance', authenticateToken, isAdmin, async (req, res) => {
    const session = await User.startSession();
    session.startTransaction();

    try {
        const userId = req.params.id;
        const { amount, type, reason } = req.body;

        if (!amount || !type) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Amount and type are required'
            });
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        const balanceUpdate = type === 'add' ? numericAmount : -numericAmount;
        const transactionType = type === 'add' ? 'admin_deposit' : 'admin_withdrawal';

        // Bakiyeyi güncelle
        await Finance.updateOne(
            { user_id: userId },
            { 
                $inc: { 
                    available_balance: balanceUpdate,
                    total_balance: balanceUpdate
                },
                updated_at: new Date()
            },
            { session }
        );

        // Transaction kaydı oluştur
        const transaction = new Transaction({
            sender_id: type === 'add' ? null : userId,
            receiver_id: type === 'add' ? userId : null,
            amount: balanceUpdate,
            transaction_type: transactionType,
            status: 'completed',
            date: new Date()
        });
        await transaction.save({ session });

        // Transaction'ı commit et
        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: `Balance ${type === 'add' ? 'added' : 'deducted'} successfully`
        });

    } catch (error) {
        // Hata durumunda rollback
        await session.abortTransaction();
        session.endSession();
        
        console.error('Update balance error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update balance'
        });
    }
});

// Transaction yönetimi
router.get('/transactions', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, type = '', status = '' } = req.query;
        const skip = (page - 1) * limit;

        // Filter oluştur
        let filter = {};
        if (type) filter.transaction_type = type;
        if (status) filter.status = status;

        const [transactions, totalCount] = await Promise.all([
            Transaction.find(filter)
                .populate('sender_id', 'username')
                .populate('receiver_id', 'username')
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Transaction.countDocuments(filter)
        ]);

        res.json({
            success: true,
            transactions: transactions || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Admin transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Transaction durumu güncelle
router.put('/transactions/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        await Transaction.updateOne(
            { _id: id },
            { status: status }
        );

        res.json({
            success: true,
            message: 'Transaction updated successfully'
        });

    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update transaction'
        });
    }
});

// Makine yönetimi
router.get('/machines', authenticateToken, isAdmin, async (req, res) => {
    try {
        const machines = await Machine.aggregate([
            {
                $lookup: {
                    from: 'minings',
                    localField: '_id',
                    foreignField: 'machine_id',
                    as: 'mining_data'
                }
            },
            {
                $project: {
                    machine_id: '$_id',
                    machine_name: 1,
                    hashrate: 1,
                    price: 1,
                    power_consumption: 1,
                    maintenance_cost: 1,
                    vip_requirement: 1,
                    stock: 1,
                    status: 1,
                    active_count: {
                        $size: {
                            $filter: {
                                input: '$mining_data',
                                as: 'mining',
                                cond: { $eq: ['$$mining.status', 'active'] }
                            }
                        }
                    },
                    total_count: { $size: '$mining_data' }
                }
            },
            { $sort: { price: 1 } }
        ]);

        res.json({
            success: true,
            machines: machines || []
        });

    } catch (error) {
        console.error('Admin machines error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Yeni makine ekle
router.post('/machines', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { machine_name, hashrate, price, power_consumption, maintenance_cost, vip_requirement, stock } = req.body;

        if (!machine_name || !hashrate || !price) {
            return res.status(400).json({
                success: false,
                message: 'Machine name, hashrate and price are required'
            });
        }

        const machine = new Machine({
            machine_name,
            hashrate: parseFloat(hashrate),
            price: parseFloat(price),
            power_consumption: power_consumption ? parseFloat(power_consumption) : 0,
            maintenance_cost: maintenance_cost ? parseFloat(maintenance_cost) : 0,
            vip_requirement: vip_requirement ? parseInt(vip_requirement) : 0,
            stock: stock ? parseInt(stock) : -1,
            status: 'active'
        });

        await machine.save();

        res.json({
            success: true,
            message: 'Machine added successfully',
            machine_id: machine._id
        });

    } catch (error) {
        console.error('Add machine error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add machine'
        });
    }
});

// Makine güncelle
router.put('/machines/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const machineId = req.params.id;
        const { machine_name, hashrate, price, power_consumption, maintenance_cost, vip_requirement, stock, status } = req.body;

        await Machine.updateOne(
            { _id: machineId },
            {
                machine_name,
                hashrate: parseFloat(hashrate),
                price: parseFloat(price),
                power_consumption: power_consumption ? parseFloat(power_consumption) : 0,
                maintenance_cost: maintenance_cost ? parseFloat(maintenance_cost) : 0,
                vip_requirement: vip_requirement ? parseInt(vip_requirement) : 0,
                stock: stock ? parseInt(stock) : -1,
                status: status
            }
        );

        res.json({
            success: true,
            message: 'Machine updated successfully'
        });

    } catch (error) {
        console.error('Update machine error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update machine'
        });
    }
});

// Sistem ayarları
router.get('/settings', authenticateToken, isAdmin, (req, res) => {
    const settings = {
        site_name: 'MiningSim',
        maintenance_mode: false,
        registration_enabled: true,
        withdrawal_enabled: true,
        min_deposit: 10,
        referral_bonus: 5,
        version: '1.0.0'
    };

    res.json({
        success: true,
        settings: settings
    });
});

// Sistem istatistikleri
router.get('/statistics', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { period = 'today' } = req.query;

        // Date filter oluştur
        let dateFilter = {};
        const now = new Date();
        
        if (period === 'today') {
            dateFilter = { $gte: new Date(now.setHours(0, 0, 0, 0)) };
        } else if (period === 'week') {
            dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
        } else if (period === 'month') {
            dateFilter = { $gte: new Date(now.setDate(now.getDate() - 30)) };
        }

        const [
            newUsersToday,
            depositsCount,
            withdrawalsCount,
            depositsAmount,
            withdrawalsAmount,
            newMiningToday
        ] = await Promise.all([
            User.countDocuments({ created_at: dateFilter }),
            Transaction.countDocuments({ 
                date: dateFilter, 
                transaction_type: 'deposit',
                amount: { $gt: 0 }
            }),
            Transaction.countDocuments({ 
                date: dateFilter, 
                transaction_type: 'withdrawal',
                amount: { $lt: 0 }
            }),
            Transaction.aggregate([
                { 
                    $match: { 
                        date: dateFilter, 
                        transaction_type: 'deposit',
                        amount: { $gt: 0 }
                    } 
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                { 
                    $match: { 
                        date: dateFilter, 
                        transaction_type: 'withdrawal',
                        amount: { $lt: 0 }
                    } 
                },
                { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
            ]),
            Mining.countDocuments({ 
                start_time: dateFilter, 
                status: 'active' 
            })
        ]);

        const statistics = {
            new_users_today: newUsersToday,
            deposits_count: depositsCount,
            withdrawals_count: withdrawalsCount,
            deposits_amount: depositsAmount.length > 0 ? depositsAmount[0].total : 0,
            withdrawals_amount: withdrawalsAmount.length > 0 ? withdrawalsAmount[0].total : 0,
            new_mining_today: newMiningToday
        };

        res.json({
            success: true,
            statistics: statistics,
            period: period
        });

    } catch (error) {
        console.error('Admin statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

module.exports = router;