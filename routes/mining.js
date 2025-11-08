const express = require('express');
const router = express.Router();
const { Machine, Mining, Finance, Transaction, VIP, User } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');
const MiningCalculator = require('../utils/miningCalculator');

// Tüm makineleri listele
router.get('/machines', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const machines = await Machine.find({ status: 'active' })
            .populate('vip_requirement', 'vip_name')
            .sort({ price: 1 });

        console.log('✅ Machines fetched:', machines?.length || 0);
        
        // Makine fiyatlarını kontrol et
        machines.forEach(machine => {
            console.log(`💰 Machine: ${machine.machine_name}, Price: ${machine.price}, Type: ${typeof machine.price}`);
        });
        
        res.json({
            success: true,
            machines: machines || []
        });

    } catch (error) {
        console.error('Machines fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Makine satın alma - TAM DÜZELTİLMİŞ VERSİYON
router.post('/purchase-machine', authenticateToken, apiLimiter, async (req, res) => {
    const session = await Machine.startSession();
    session.startTransaction();

    try {
        const userId = req.user.userId;
        const { machine_id, quantity = 1 } = req.body;

        console.log('🛒 Purchase request:', { userId, machine_id, quantity });

        if (!machine_id) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Machine ID is required'
            });
        }

        // Makineyi bul
        const machine = await Machine.findOne({ _id: machine_id, status: 'active' }).session(session);
        if (!machine) {
            await session.abortTransaction();
            session.endSession();
            console.error('❌ Machine not found:', machine_id);
            return res.status(400).json({
                success: false,
                message: 'Machine not found'
            });
        }

        console.log('✅ Machine found:', {
            name: machine.machine_name,
            price: machine.price,
            priceType: typeof machine.price,
            vip_requirement: machine.vip_requirement
        });

        // Stock kontrolü - -1 sınırsız stock demektir
        if (machine.stock !== -1 && machine.stock < quantity) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'Insufficient stock'
            });
        }

        // Kullanıcıyı bul
        const user = await User.findOne({ _id: userId }).session(session);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // VIP kontrolü - sayısal karşılaştırma
        const userVIP = user.vip_level || 0;
        const machineVIP = machine.vip_requirement || 0;
        
        console.log(`👑 VIP Check - User: ${userVIP}, Machine: ${machineVIP}`);
        
        if (userVIP < machineVIP) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `VIP level ${machine.vip_requirement} required for this machine`
            });
        }

        // Fiyatları sayısala çevir - GÜVENLİ VERSİYON
        const machinePrice = parseFloat(machine.price);
        const totalPrice = machinePrice * parseInt(quantity);

        console.log(`💰 Price Check - Machine Price: ${machinePrice}, Total Price: ${totalPrice}, Quantity: ${quantity}`);

        // Finance kaydını bul
        const finance = await Finance.findOne({ user_id: userId }).session(session);
        if (!finance) {
            await session.abortTransaction();
            session.endSession();
            console.error('❌ Finance record not found for user:', userId);
            return res.status(400).json({
                success: false,
                message: 'Finance record not found'
            });
        }

        // Balance'ı sayısala çevir
        const userBalance = finance.available_balance || 0;
        console.log(`💳 Balance Check - User Balance: ${userBalance}, Required: ${totalPrice}, Difference: ${userBalance - totalPrice}`);

        if (userBalance < totalPrice) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: `Insufficient balance. You have ${userBalance.toFixed(6)} TRX but need ${totalPrice.toFixed(6)} TRX`
            });
        }

        // Bakiye güncelleme
        await Finance.updateOne(
            { user_id: userId },
            { 
                $inc: { 
                    available_balance: -totalPrice,
                    total_balance: -totalPrice
                },
                updated_at: new Date()
            },
            { session }
        );

        console.log('✅ Balance updated successfully');

        // Stock güncelleme (-1 ise stock sınırsızdır, güncelleme yapma)
        if (machine.stock !== -1) {
            await Machine.updateOne(
                { _id: machine_id },
                { $inc: { stock: -quantity } },
                { session }
            );
            console.log('✅ Stock updated');
        }

        const dailyEarning = MiningCalculator.calculateDailyEarning(machine.hashrate);
        const machineHashrate = machine.hashrate || 0;
        
        console.log(`⛏️ Creating ${quantity} mining records...`);
        
        // Mining kayıtlarını oluştur
        const miningRecords = [];
        for (let i = 0; i < quantity; i++) {
            miningRecords.push({
                user_id: userId,
                machine_id: machine_id,
                hashrate: machineHashrate,
                amount: machinePrice,
                daily_earning: dailyEarning,
                status: 'active',
                start_time: new Date()
            });
        }

        await Mining.insertMany(miningRecords, { session });

        // Transaction log'u ekle
        const transaction = new Transaction({
            receiver_id: userId,
            amount: -totalPrice,
            transaction_type: 'machine_purchase',
            status: 'completed'
        });
        await transaction.save({ session });

        // Transaction'ı commit et
        await session.commitTransaction();
        session.endSession();

        console.log('✅ Purchase completed successfully');
        res.json({
            success: true,
            message: `Successfully purchased ${quantity} ${machine.machine_name}(s)`,
            daily_earning: dailyEarning * quantity,
            total_paid: totalPrice,
            new_balance: userBalance - totalPrice
        });

    } catch (error) {
        // Hata durumunda rollback
        await session.abortTransaction();
        session.endSession();
        
        console.error('❌ Purchase error:', error);
        res.status(500).json({
            success: false,
            message: 'Purchase failed: ' + error.message
        });
    }
});

// Aktif mining'leri getir
router.get('/active-mining', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('⛏️ Active mining request for user:', userId);

        const [activeMining, stats] = await Promise.all([
            Mining.find({ user_id: userId, status: 'active' })
                .populate('machine_id', 'machine_name')
                .sort({ start_time: -1 }),
            Mining.aggregate([
                { $match: { user_id: userId, status: 'active' } },
                {
                    $group: {
                        _id: null,
                        total_machines: { $sum: 1 },
                        total_hashrate: { $sum: '$hashrate' },
                        total_daily_earning: { $sum: '$daily_earning' },
                        total_earned: { $sum: '$total_earning' }
                    }
                }
            ])
        ]);

        console.log('✅ Active mining found:', activeMining?.length || 0);

        const statistics = stats.length > 0 ? stats[0] : {
            total_machines: 0,
            total_hashrate: 0,
            total_daily_earning: 0,
            total_earned: 0
        };

        const responseData = {
            success: true,
            mining: activeMining || [],
            statistics: statistics
        };

        console.log('📤 Sending active mining data');
        res.json(responseData);

    } catch (error) {
        console.error('❌ Active mining fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

// Mining durdurma
router.post('/stop-mining/:mining_id', authenticateToken, apiLimiter, async (req, res) => {
    const session = await Mining.startSession();
    session.startTransaction();

    try {
        const userId = req.user.userId;
        const miningId = req.params.mining_id;

        console.log('🛑 Stop mining request:', { userId, miningId });

        // Mining kaydını bul
        const mining = await Mining.findOne({ 
            _id: miningId, 
            user_id: userId, 
            status: 'active' 
        }).session(session);

        if (!mining) {
            await session.abortTransaction();
            session.endSession();
            console.error('❌ Mining not found or already stopped');
            return res.status(400).json({
                success: false,
                message: 'Mining not found or already stopped'
            });
        }

        const endTime = new Date();
        const startTime = mining.start_time;
        const durationHours = (endTime - startTime) / (1000 * 60 * 60);
        const totalEarned = (mining.daily_earning / 24) * durationHours;

        console.log(`💰 Mining earnings calculated: ${totalEarned} TRX`);

        // Mining'i durdur
        await Mining.updateOne(
            { _id: miningId },
            { 
                status: 'stopped', 
                end_time: endTime,
                total_earning: totalEarned
            },
            { session }
        );

        // Bakiyeyi güncelle
        await Finance.updateOne(
            { user_id: userId },
            { 
                $inc: { 
                    available_balance: totalEarned,
                    total_balance: totalEarned,
                    total_earned: totalEarned
                },
                updated_at: new Date()
            },
            { session }
        );

        console.log('✅ Balance updated successfully');

        // Transaction log'u ekle
        const transaction = new Transaction({
            receiver_id: userId,
            amount: totalEarned,
            transaction_type: 'mining_earnings',
            status: 'completed'
        });
        await transaction.save({ session });

        // Transaction'ı commit et
        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: 'Mining stopped successfully',
            earned: totalEarned,
            duration: durationHours
        });

    } catch (error) {
        // Hata durumunda rollback
        await session.abortTransaction();
        session.endSession();
        
        console.error('❌ Stop mining error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop mining'
        });
    }
});

// Tüm mining'leri durdur
router.post('/stop-all-mining', authenticateToken, apiLimiter, async (req, res) => {
    const session = await Mining.startSession();
    session.startTransaction();

    try {
        const userId = req.user.userId;

        console.log('🛑 Stop all mining request for user:', userId);

        // Aktif mining'leri bul
        const activeMinings = await Mining.find({ 
            user_id: userId, 
            status: 'active' 
        }).session(session);

        if (!activeMinings || activeMinings.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
                success: false,
                message: 'No active mining found'
            });
        }

        console.log(`🛑 Stopping ${activeMinings.length} mining machines`);

        let totalEarned = 0;
        const endTime = new Date();

        // Tüm mining'leri durdur ve kazançları hesapla
        for (const mining of activeMinings) {
            const startTime = mining.start_time;
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);
            const miningEarned = (mining.daily_earning / 24) * durationHours;
            totalEarned += miningEarned;

            await Mining.updateOne(
                { _id: mining._id },
                { 
                    status: 'stopped', 
                    end_time: endTime,
                    total_earning: miningEarned
                },
                { session }
            );
        }

        // Toplam bakiyeyi güncelle
        await Finance.updateOne(
            { user_id: userId },
            { 
                $inc: { 
                    available_balance: totalEarned,
                    total_balance: totalEarned,
                    total_earned: totalEarned
                },
                updated_at: new Date()
            },
            { session }
        );

        // Transaction log'u ekle
        const transaction = new Transaction({
            receiver_id: userId,
            amount: totalEarned,
            transaction_type: 'mining_earnings_all',
            status: 'completed'
        });
        await transaction.save({ session });

        // Transaction'ı commit et
        await session.commitTransaction();
        session.endSession();

        console.log('✅ All mining stopped successfully');
        res.json({
            success: true,
            message: `All mining stopped successfully. Earned: ${totalEarned.toFixed(6)} TRX`,
            total_earned: totalEarned,
            machines_stopped: activeMinings.length
        });

    } catch (error) {
        // Hata durumunda rollback
        await session.abortTransaction();
        session.endSession();
        
        console.error('❌ Stop all mining error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop all mining'
        });
    }
});

// Mining history
router.get('/mining-history', authenticateToken, apiLimiter, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log('📜 Mining history request for user:', userId);

        const history = await Mining.find({ user_id: userId })
            .populate('machine_id', 'machine_name')
            .sort({ start_time: -1 })
            .limit(50);

        console.log('✅ Mining history found:', history?.length || 0);

        res.json({
            success: true,
            history: history || []
        });

    } catch (error) {
        console.error('❌ Mining history error:', error);
        res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
});

module.exports = router;