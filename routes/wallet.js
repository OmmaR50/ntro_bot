const TronWeb = require('tronweb');

class TronAddressGenerator {
    constructor() {
        // NILE Testnet configuration
        this.tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: { 
                "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || 'your-trongrid-api-key' 
            }
        });
        
        this.network = 'NILE Testnet';
        this.offline = false;
    }

    async initialize() {
        try {
            // Test connection to NILE Testnet
            await this.tronWeb.trx.getCurrentBlock();
            console.log('✅ Connected to TRON NILE Testnet');
            this.offline = false;
        } catch (error) {
            console.warn('⚠️ Cannot connect to NILE Testnet, using offline mode:', error.message);
            this.offline = true;
        }
    }

    async generateAddress() {
        try {
            if (!this.offline) {
                // Online generation using TronWeb
                const account = await this.tronWeb.createAccount();
                return {
                    success: true,
                    address: {
                        base58: account.address.base58,
                        hex: account.address.hex,
                        privateKey: account.privateKey
                    },
                    network: this.network,
                    offline: false
                };
            } else {
                // Offline generation as fallback
                return this.generateOfflineAddress();
            }
        } catch (error) {
            console.error('Online address generation failed, using offline method:', error);
            return this.generateOfflineAddress();
        }
    }

    generateOfflineAddress() {
        try {
            // Offline address generation
            const account = this.tronWeb.createAccount();
            return {
                success: true,
                address: {
                    base58: account.address.base58,
                    hex: account.address.hex,
                    privateKey: account.privateKey
                },
                network: this.network,
                offline: true
            };
        } catch (error) {
            console.error('Offline address generation failed:', error);
            return {
                success: false,
                message: 'Address generation failed: ' + error.message
            };
        }
    }

    validateAddress(address) {
        try {
            return this.tronWeb.isAddress(address);
        } catch (error) {
            console.error('Address validation error:', error);
            return false;
        }
    }

    async getAddressInfo(address) {
        try {
            if (this.offline) {
                return {
                    balance: 0,
                    isActivated: true,
                    message: 'Offline mode - real balance not available'
                };
            }

            const balance = await this.tronWeb.trx.getBalance(address);
            const account = await this.tronWeb.trx.getAccount(address);
            
            return {
                balance: this.tronWeb.fromSun(balance),
                isActivated: !!account.address,
                transactions: account.transactions || 0,
                createTime: account.create_time || null
            };
        } catch (error) {
            console.error('Get address info error:', error);
            return {
                balance: 0,
                isActivated: false,
                message: 'Error fetching address info: ' + error.message
            };
        }
    }

    async getNetworkInfo() {
        try {
            if (this.offline) {
                return {
                    connected: false,
                    network: this.network,
                    message: 'Offline mode'
                };
            }

            const nodeInfo = await this.tronWeb.trx.getNodeInfo();
            return {
                connected: true,
                network: this.network,
                blockHeight: nodeInfo.block,
                nodeVersion: nodeInfo.configNodeInfo?.codeVersion || 'Unknown'
            };
        } catch (error) {
            return {
                connected: false,
                network: this.network,
                message: 'Connection failed: ' + error.message
            };
        }
    }
}

// Singleton instance
const tronAddressGenerator = new TronAddressGenerator();

// Initialize connection
tronAddressGenerator.initialize().catch(console.error);

module.exports = tronAddressGenerator;