const TelegramBotManager = require('./telegramBot');

class TelegramAuth {
    constructor() {
        this.botManager = new TelegramBotManager();
        console.log('✅ TelegramAuth initialized with real bot support');
    }

    async sendVerificationCode(telegramUsername) {
        try {
            // Clean username (remove @ if present)
            const cleanUsername = telegramUsername.replace('@', '');
            
            if (!cleanUsername) {
                return {
                    success: false,
                    message: 'Telegram username is required'
                };
            }

            console.log(`📱 Sending verification code to Telegram: @${cleanUsername}`);
            
            const result = await this.botManager.sendVerificationCode(cleanUsername);
            
            if (result.sent) {
                return {
                    success: true,
                    code: result.code,
                    message: 'Verification code sent to your Telegram!'
                };
            } else {
                return {
                    success: true,
                    code: result.code,
                    message: result.message || 'Please use this verification code: ' + result.code
                };
            }
        } catch (error) {
            console.error('Telegram code sending error:', error);
            return {
                success: false,
                message: 'Failed to send verification code. Please try again.'
            };
        }
    }

    verifyCode(telegramUsername, code) {
        try {
            const cleanUsername = telegramUsername.replace('@', '');
            
            if (!cleanUsername || !code) {
                return {
                    success: false,
                    message: 'Telegram username and verification code are required'
                };
            }

            console.log(`🔐 Verifying code for @${cleanUsername}: ${code}`);
            
            const result = this.botManager.verifyCode(cleanUsername, code);
            return result;
        } catch (error) {
            console.error('Telegram verification error:', error);
            return {
                success: false,
                message: 'Verification failed. Please try again.'
            };
        }
    }

    // Method to check if bot is active
    isBotActive() {
        return this.botManager.bot !== null;
    }

    // Method to get bot status
    getBotStatus() {
        return this.botManager.getBotStatus();
    }
}

// Create singleton instance
const telegramAuth = new TelegramAuth();

// Cleanup expired codes every minute
setInterval(() => {
    telegramAuth.botManager.cleanupExpiredCodes();
}, 60 * 1000);

module.exports = telegramAuth;