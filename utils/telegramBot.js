const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config/constants');

class TelegramBotManager {
    constructor() {
        this.bot = null;
        this.verificationCodes = new Map();
        this.initializeBot();
    }

    initializeBot() {
        if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === 'your-telegram-bot-token-here') {
            console.log('❌ Telegram Bot Token not set. Using simulated mode.');
            return;
        }

        try {
            this.bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
            console.log('✅ Telegram Bot initialized successfully');

            this.setupHandlers();
        } catch (error) {
            console.error('❌ Failed to initialize Telegram Bot:', error.message);
            console.log('📱 Using simulated Telegram verification');
        }
    }

    setupHandlers() {
        // Start command
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const welcomeMessage = `🤖 **Welcome to MiningSim Bot!**

I will help you verify your account and send you important notifications.

🔐 **Available Commands:**
/verify - Verify your account
/help - Show help information
/status - Check your verification status

📧 **Support:** Contact website support`;
            
            this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
        });

        // Verify command
        this.bot.onText(/\/verify/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId, 
                `🔐 **Account Verification**

To verify your account, please:

1. Go to MiningSim website
2. Go to your Profile page
3. Enter your Telegram username and click "Send Verification Code"
4. Enter the code you receive here

You'll receive a verification code that you need to enter on the website.`,
                { parse_mode: 'Markdown' }
            );
        });

        // Help command
        this.bot.onText(/\/help/, (msg) => {
            const chatId = msg.chat.id;
            this.bot.sendMessage(chatId,
                `🆘 **Help Guide**

🤖 **About MiningSim Bot:**
This bot helps verify your MiningSim account and sends important notifications.

🔐 **Verification Process:**
1. Go to your Profile page on MiningSim
2. Enter your Telegram username
3. Click "Send Verification Code"
4. You'll receive a code here
5. Enter that code on the website

📱 **Notifications:**
• Withdrawal alerts
• Mining updates
• Security notifications
• Bonus announcements

❓ **Need Help?**
Contact website support`,
                { parse_mode: 'Markdown' }
            );
        });

        // Status command
        this.bot.onText(/\/status/, (msg) => {
            const chatId = msg.chat.id;
            const username = msg.from.username;
            
            if (username) {
                const userCode = this.verificationCodes.get(username);
                if (userCode) {
                    this.bot.sendMessage(chatId,
                        `✅ **Verification Status**

👤 Username: @${username}
🔐 Code: ${userCode.code}
⏰ Expires: ${new Date(userCode.timestamp + 10 * 60 * 1000).toLocaleTimeString()}
📱 Status: ${userCode.used ? 'Used' : 'Active'}

Enter this code on the website to verify your account.`,
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    this.bot.sendMessage(chatId,
                        `❌ **No Active Verification**

No verification code found for @${username}.

Please go to MiningSim website Profile page and click "Send Verification Code" to start the verification process.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } else {
                this.bot.sendMessage(chatId,
                    '❌ Please set a username in your Telegram account to use this feature.',
                    { parse_mode: 'Markdown' }
                );
            }
        });

        // Handle all messages
        this.bot.on('message', (msg) => {
            if (!msg.text?.startsWith('/')) {
                const chatId = msg.chat.id;
                this.bot.sendMessage(chatId,
                    `🤖 **MiningSim Bot**

I'm here to help with account verification and notifications.

Use /help to see available commands or /verify to start verification process.`,
                    { parse_mode: 'Markdown' }
                );
            }
        });

        console.log('✅ Telegram Bot handlers setup completed');
    }

    async sendVerificationCode(telegramUsername) {
        const code = this.generateVerificationCode();
        
        // Store verification code
        this.verificationCodes.set(telegramUsername, {
            code: code,
            timestamp: Date.now(),
            used: false
        });

        // Cleanup expired codes
        this.cleanupExpiredCodes();

        if (this.bot) {
            try {
                // Try to find user by username
                const chat = await this.findChatByUsername(telegramUsername);
                if (chat) {
                    await this.bot.sendMessage(chat.id,
                        `✅ **MiningSim Verification Code**

🔐 Your verification code: **${code}**

⏰ This code expires in 10 minutes.

🌐 Go to MiningSim website Profile page and enter this code to complete your verification.

⚠️ Do not share this code with anyone!`,
                        { parse_mode: 'Markdown' }
                    );
                    console.log(`✅ Verification code sent to @${telegramUsername}`);
                    return { success: true, code: code, sent: true };
                } else {
                    console.log(`❌ Could not find Telegram user @${telegramUsername}`);
                    return { success: true, code: code, sent: false, message: 'User not found on Telegram. Please start the bot first.' };
                }
            } catch (error) {
                console.error('Error sending Telegram message:', error.message);
                return { success: true, code: code, sent: false, message: 'Failed to send message. Please try again.' };
            }
        } else {
            // Bot not available, return code for manual entry
            console.log(`📱 Simulated Telegram code for @${telegramUsername}: ${code}`);
            return { 
                success: true, 
                code: code, 
                sent: false, 
                message: 'Telegram bot not configured. Use this code manually: ' + code 
            };
        }
    }

    async findChatByUsername(username) {
        if (!this.bot) return null;
        
        try {
            // This is a simplified approach - in production you might need a different method
            // Users would need to start the bot first
            const updates = await this.bot.getUpdates({ timeout: 1 });
            for (let update of updates) {
                if (update.message?.from?.username === username.replace('@', '')) {
                    return update.message.chat;
                }
            }
            return null;
        } catch (error) {
            console.error('Error finding chat by username:', error);
            return null;
        }
    }

    verifyCode(telegramUsername, code) {
        const storedData = this.verificationCodes.get(telegramUsername);
        
        if (!storedData) {
            return {
                success: false,
                message: 'No verification code found for this username. Please request a new code.'
            };
        }

        if (storedData.used) {
            return {
                success: false,
                message: 'This verification code has already been used. Please request a new code.'
            };
        }

        if (Date.now() - storedData.timestamp > 10 * 60 * 1000) { // 10 minutes
            this.verificationCodes.delete(telegramUsername);
            return {
                success: false,
                message: 'Verification code has expired. Please request a new code.'
            };
        }

        if (storedData.code !== code) {
            return {
                success: false,
                message: 'Invalid verification code. Please check and try again.'
            };
        }

        // Mark code as used
        storedData.used = true;
        
        // Send success notification if bot is available
        if (this.bot) {
            this.sendVerificationSuccess(telegramUsername);
        }

        return {
            success: true,
            message: 'Telegram verification successful! Your account has been verified.'
        };
    }

    async sendVerificationSuccess(telegramUsername) {
        if (!this.bot) return;
        
        try {
            const chat = await this.findChatByUsername(telegramUsername);
            if (chat) {
                await this.bot.sendMessage(chat.id,
                    `🎉 **Account Verified Successfully!**

✅ Your MiningSim account has been successfully verified!

You can now:
• Receive important notifications
• Get security alerts
• Stay updated with mining activities

Thank you for verifying your account! 🚀`,
                    { parse_mode: 'Markdown' }
                );
            }
        } catch (error) {
            console.error('Error sending verification success message:', error);
        }
    }

    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    cleanupExpiredCodes() {
        const now = Date.now();
        for (const [username, data] of this.verificationCodes.entries()) {
            if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
                this.verificationCodes.delete(username);
            }
        }
    }

    // Method to send notifications to users
    async sendNotification(telegramUsername, message) {
        if (!this.bot) return false;

        try {
            const chat = await this.findChatByUsername(telegramUsername);
            if (chat) {
                await this.bot.sendMessage(chat.id, message, { parse_mode: 'Markdown' });
                return true;
            }
        } catch (error) {
            console.error('Error sending notification:', error);
        }
        return false;
    }

    // Get bot status
    getBotStatus() {
        return {
            active: this.bot !== null,
            username: this.bot ? 'MiningSimBot' : null,
            mode: this.bot ? 'Real Bot' : 'Simulated Mode'
        };
    }
}

module.exports = TelegramBotManager;