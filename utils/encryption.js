const crypto = require('crypto');
const { AES_SECRET } = require('../config/constants');

class SimpleEncryption {
    static encrypt(text) {
        try {
            if (!text) return null;
            // Sabit salt ile hash - her zaman aynı output
            const hash = crypto.createHash('sha256');
            hash.update(text + AES_SECRET);
            return hash.digest('hex');
        } catch (error) {
            console.error('❌ Encryption error:', error);
            return null;
        }
    }

    static decrypt(encryptedText) {
        // Hash'ler decrypt edilemez, bu nedenle null döndür
        return null;
    }

    static encryptPassword(password) {
        return this.encrypt(password);
    }

    static comparePassword(inputPassword, storedHash) {
        try {
            console.log('🔐 Password Comparison (Hash):', {
                input: inputPassword,
                stored: storedHash ? storedHash.substring(0, 20) + '...' : 'null'
            });

            if (!inputPassword || !storedHash) {
                return false;
            }

            const inputHash = this.encrypt(inputPassword);
            console.log('🔐 Input Hash:', inputHash ? inputHash.substring(0, 20) + '...' : 'null');
            console.log('🔐 Match:', inputHash === storedHash);

            return inputHash === storedHash;
        } catch (error) {
            console.error('❌ Password comparison error:', error);
            return false;
        }
    }

    static encryptPayPassword(password) {
        return this.encrypt(password);
    }

    static comparePayPassword(inputPassword, storedHash) {
        return this.comparePassword(inputPassword, storedHash);
    }
}

module.exports = SimpleEncryption;