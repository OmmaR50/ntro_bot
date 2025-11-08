class WalletManager {
    constructor() {
        this.walletData = null;
        this.privateKeyVisible = false;
        this.transactions = [];
        this.balance = { total_balance: 0, available_balance: 0, locked_balance: 0 };
        this.currentPage = 1;
        this.transactionsPerPage = 20;
        this.initializeEventListeners();
        this.loadAllData();
        this.checkNetworkStatus();
    }

    initializeEventListeners() {
        // Navigation
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Copy buttons
        const copyWalletAddress = document.getElementById('copyWalletAddress');
        if (copyWalletAddress) {
            copyWalletAddress.addEventListener('click', () => {
                this.copyToClipboard('walletAddress');
            });
        }

        const copyDepositAddress = document.getElementById('copyDepositAddress');
        if (copyDepositAddress) {
            copyDepositAddress.addEventListener('click', () => {
                this.copyToClipboard('depositAddress');
            });
        }

        const copyPrivateKey = document.getElementById('copyPrivateKey');
        if (copyPrivateKey) {
            copyPrivateKey.addEventListener('click', () => {
                this.copyToClipboard('privateKey');
            });
        }

        // Toggle private key visibility
        const togglePrivateKey = document.getElementById('togglePrivateKey');
        if (togglePrivateKey) {
            togglePrivateKey.addEventListener('click', () => {
                this.togglePrivateKeyVisibility();
            });
        }

        // Generate new address
        const generateNewAddress = document.getElementById('generateNewAddress');
        if (generateNewAddress) {
            generateNewAddress.addEventListener('click', () => {
                this.generateNewDepositAddress();
            });
        }

        // Update wallet address
        const updateWalletAddress = document.getElementById('updateWalletAddress');
        if (updateWalletAddress) {
            updateWalletAddress.addEventListener('click', () => {
                this.showUpdateWalletModal();
            });
        }

        // Refresh data
        const refreshBalance = document.getElementById('refreshBalance');
        if (refreshBalance) {
            refreshBalance.addEventListener('click', () => {
                this.loadBalance(true);
            });
        }

        const refreshTransactions = document.getElementById('refreshTransactions');
        if (refreshTransactions) {
            refreshTransactions.addEventListener('click', () => {
                this.loadTransactions(true);
            });
        }

        // QR Code generation
        const generateQRCode = document.getElementById('generateQRCode');
        if (generateQRCode) {
            generateQRCode.addEventListener('click', () => {
                this.generateQRCode();
            });
        }

        // Withdrawal form
        const withdrawForm = document.getElementById('withdrawForm');
        if (withdrawForm) {
            withdrawForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleWithdrawal();
            });
        }

        // Transaction pagination
        const prevPage = document.getElementById('prevPage');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                this.changePage(-1);
            });
        }

        const nextPage = document.getElementById('nextPage');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                this.changePage(1);
            });
        }

        const transactionsPerPage = document.getElementById('transactionsPerPage');
        if (transactionsPerPage) {
            transactionsPerPage.addEventListener('change', (e) => {
                this.transactionsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.loadTransactions();
            });
        }

        // Amount quick select
        document.querySelectorAll('.btn-quick-amount').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = e.target.dataset.amount;
                document.getElementById('withdrawAmount').value = amount;
                this.calculateWithdrawalFee();
            });
        });

        // Max amount button
        const btnMaxAmount = document.getElementById('btnMaxAmount');
        if (btnMaxAmount) {
            btnMaxAmount.addEventListener('click', () => {
                document.getElementById('withdrawAmount').value = this.balance.available_balance;
                this.calculateWithdrawalFee();
            });
        }

        // Real-time fee calculation
        const withdrawAmount = document.getElementById('withdrawAmount');
        if (withdrawAmount) {
            withdrawAmount.addEventListener('input', () => {
                this.calculateWithdrawalFee();
            });
        }

        // Auto-refresh every 30 seconds
        setInterval(() => {
            this.loadBalance();
            this.loadTransactions();
        }, 30000);
    }

    async loadAllData() {
        try {
            await Promise.all([
                this.loadWalletData(),
                this.loadBalance(),
                this.loadTransactions()
            ]);
        } catch (error) {
            console.error('Initial data load error:', error);
            this.showError('Failed to load initial data');
        }
    }

    async loadWalletData() {
        try {
            this.showLoading('walletInfo', 'Loading wallet data...');
            
            const token = localStorage.getItem('token');
            const response = await fetch('/api/wallet/info', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.walletData = data.wallet;
                    this.updateWalletUI();
                    this.generateQRCode();
                } else {
                    this.showError(data.message || 'Failed to load wallet data');
                }
            } else {
                this.showError('Failed to load wallet data');
            }
        } catch (error) {
            console.error('Wallet data load error:', error);
            this.showError('Network error while loading wallet data');
        }
    }

    async loadBalance(showRefresh = false) {
        try {
            if (showRefresh) {
                this.showLoading('balanceSection', 'Refreshing balance...');
            }

            const token = localStorage.getItem('token');
            const response = await fetch('/api/finance/balance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.balance = data.balance;
                    this.updateBalanceUI();
                    
                    if (showRefresh) {
                        this.showSuccess('Balance updated');
                    }
                }
            }
        } catch (error) {
            console.error('Balance load error:', error);
            if (showRefresh) {
                this.showError('Failed to refresh balance');
            }
        }
    }

    async loadTransactions(showRefresh = false) {
        try {
            if (showRefresh) {
                this.showLoading('transactionsSection', 'Refreshing transactions...');
            }

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/finance/transactions?page=${this.currentPage}&limit=${this.transactionsPerPage}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.transactions = data.transactions;
                    this.updateTransactionsUI();
                    this.updatePagination(data.pagination);
                    
                    if (showRefresh) {
                        this.showSuccess('Transactions updated');
                    }
                }
            }
        } catch (error) {
            console.error('Transactions load error:', error);
            if (showRefresh) {
                this.showError('Failed to refresh transactions');
            }
        }
    }

    updateWalletUI() {
        if (!this.walletData) return;

        const wallet = this.walletData;
        
        // Update wallet address
        const walletAddressEl = document.getElementById('walletAddress');
        if (walletAddressEl) {
            walletAddressEl.value = wallet.wallet_address || 'Not set';
            walletAddressEl.title = wallet.wallet_address || 'Not set';
        }

        // Update deposit address
        const depositAddressEl = document.getElementById('depositAddress');
        if (depositAddressEl) {
            depositAddressEl.value = wallet.deposit_address || 'Not generated';
            depositAddressEl.title = wallet.deposit_address || 'Not generated';
        }

        // Update private key (hidden by default)
        const privateKeyEl = document.getElementById('privateKey');
        if (privateKeyEl) {
            if (wallet.dp_add_prvkey) {
                privateKeyEl.value = this.privateKeyVisible ? wallet.dp_add_prvkey : '•'.repeat(64);
                privateKeyEl.type = this.privateKeyVisible ? 'text' : 'password';
            } else {
                privateKeyEl.value = 'Not available';
                privateKeyEl.type = 'text';
            }
        }

        // Update button states
        const hasDepositAddress = wallet.deposit_address && wallet.deposit_address !== 'Not generated';
        const hasPrivateKey = wallet.dp_add_prvkey && wallet.dp_add_prvkey !== 'Not available';

        const copyDepositAddressBtn = document.getElementById('copyDepositAddress');
        const copyPrivateKeyBtn = document.getElementById('copyPrivateKey');
        const togglePrivateKeyBtn = document.getElementById('togglePrivateKey');
        const generateQRCodeBtn = document.getElementById('generateQRCode');

        if (copyDepositAddressBtn) copyDepositAddressBtn.disabled = !hasDepositAddress;
        if (copyPrivateKeyBtn) copyPrivateKeyBtn.disabled = !hasPrivateKey;
        if (togglePrivateKeyBtn) togglePrivateKeyBtn.disabled = !hasPrivateKey;
        if (generateQRCodeBtn) generateQRCodeBtn.disabled = !hasDepositAddress;
    }

    updateBalanceUI() {
        const { total_balance, available_balance, locked_balance } = this.balance;

        document.getElementById('totalBalance').textContent = this.formatBalance(total_balance);
        document.getElementById('availableBalance').textContent = this.formatBalance(available_balance);
        document.getElementById('lockedBalance').textContent = this.formatBalance(locked_balance);

        // Update withdrawal form available balance
        document.getElementById('availableBalanceWithdraw').textContent = 
            this.formatBalance(available_balance) + ' TRX';

        // Update progress bars or other visual elements
        this.updateBalanceProgress(available_balance, total_balance);
    }

    updateBalanceProgress(available, total) {
        const progressElement = document.getElementById('balanceProgress');
        if (progressElement && total > 0) {
            const percentage = (available / total) * 100;
            progressElement.style.width = `${percentage}%`;
            progressElement.setAttribute('aria-valuenow', percentage);
        }
    }

    updateTransactionsUI() {
        const container = document.getElementById('transactionsList');
        
        if (!this.transactions || this.transactions.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="fas fa-exchange-alt fa-3x mb-3"></i>
                        <h5>No Transactions</h5>
                        <p>Your transactions will appear here</p>
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = this.transactions.map(transaction => {
            const isDeposit = transaction.amount > 0;
            const amountClass = isDeposit ? 'text-success' : 'text-danger';
            const icon = isDeposit ? 'fa-arrow-down' : 'fa-arrow-up';
            const type = this.formatTransactionType(transaction.transaction_type);
            const sign = isDeposit ? '+' : '';
            const statusClass = this.getStatusClass(transaction.status);

            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="fas ${icon} ${amountClass} me-2"></i>
                            <span>${type}</span>
                        </div>
                    </td>
                    <td>
                        <span class="${amountClass} fw-bold">
                            ${sign}${this.formatBalance(Math.abs(transaction.amount))} TRX
                        </span>
                    </td>
                    <td>${this.formatBalance(transaction.fee)} TRX</td>
                    <td>
                        ${transaction.sender_username ? 
                          `From: ${transaction.sender_username}` : 
                          transaction.receiver_username ? 
                          `To: ${transaction.receiver_username}` : 
                          'System'}
                    </td>
                    <td>${new Date(transaction.date).toLocaleDateString()}</td>
                    <td>
                        <span class="badge ${statusClass}">${transaction.status}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-info btn-transaction-details" 
                                data-transaction-id="${transaction.transaction_id}">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners to detail buttons
        document.querySelectorAll('.btn-transaction-details').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const transactionId = e.target.closest('.btn-transaction-details').dataset.transactionId;
                this.showTransactionDetails(transactionId);
            });
        });
    }

    updatePagination(pagination) {
        const { page, pages, total } = pagination;
        
        document.getElementById('currentPage').textContent = page;
        document.getElementById('totalPages').textContent = pages;
        document.getElementById('totalTransactions').textContent = total;

        // Update button states
        document.getElementById('prevPage').disabled = page <= 1;
        document.getElementById('nextPage').disabled = page >= pages;

        // Update showing text
        const start = ((page - 1) * this.transactionsPerPage) + 1;
        const end = Math.min(page * this.transactionsPerPage, total);
        document.getElementById('showingText').textContent = 
            `Showing ${start}-${end} of ${total} transactions`;
    }

    async handleWithdrawal() {
        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const payPassword = document.getElementById('withdrawPayPassword').value;
        const walletAddress = document.getElementById('withdrawWalletAddress').value;

        if (!amount || !payPassword || !walletAddress) {
            this.showError('Please fill all fields');
            return;
        }

        if (amount <= 0) {
            this.showError('Amount must be positive');
            return;
        }

        // Validate TRON address format
        if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(walletAddress)) {
            this.showError('Invalid TRON wallet address format');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/finance/withdraw', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: amount,
                    pay_password: payPassword,
                    wallet_address: walletAddress
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showWithdrawalSuccess(data.transaction);
                document.getElementById('withdrawForm').reset();
                this.calculateWithdrawalFee();
                await this.loadAllData(); // Reload all data
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Withdrawal error:', error);
            this.showError('Withdrawal failed. Please try again.');
        }
    }

    calculateWithdrawalFee() {
        const amount = parseFloat(document.getElementById('withdrawAmount').value) || 0;
        const userVIP = this.getUserVIPLevel();
        
        let feePercentage = 0.05; // Bronze - 5%
        if (userVIP === 1) feePercentage = 0.03; // Silver - 3%
        if (userVIP === 2) feePercentage = 0.01; // Gold - 1%

        const fee = amount * feePercentage;
        const netAmount = amount - fee;

        document.getElementById('withdrawalFee').textContent = this.formatBalance(fee) + ' TRX';
        document.getElementById('netAmount').textContent = this.formatBalance(netAmount) + ' TRX';
        document.getElementById('withdrawAmountDisplay').textContent = this.formatBalance(amount) + ' TRX';
        document.getElementById('feePercentage').textContent = (feePercentage * 100) + '%';

        // Update minimum withdrawal amount based on VIP level
        const minWithdrawal = userVIP === 0 ? 10 : userVIP === 1 ? 5 : 1;
        document.getElementById('minWithdrawal').textContent = minWithdrawal + ' TRX';

        // Validate amount against minimum
        const amountError = document.getElementById('amountError');
        if (amount > 0 && amount < minWithdrawal) {
            amountError.textContent = `Minimum withdrawal is ${minWithdrawal} TRX`;
        } else if (amount > this.balance.available_balance) {
            amountError.textContent = 'Insufficient balance';
        } else if (amount > 0 && amount >= minWithdrawal) {
            amountError.textContent = '';
        }
    }

    async generateQRCode() {
        const depositAddress = this.walletData?.deposit_address;
        const qrcodeContainer = document.getElementById('qrcode');
        
        if (!qrcodeContainer) return;

        if (!depositAddress || depositAddress === 'Not generated') {
            qrcodeContainer.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-qrcode fa-3x mb-2"></i>
                    <p>Generate deposit address first</p>
                </div>
            `;
            return;
        }

        try {
            // Using a simple QR code generation approach
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(depositAddress)}`;
            
            qrcodeContainer.innerHTML = `
                <div class="text-center">
                    <img src="${qrCodeUrl}" alt="Deposit QR Code" class="img-fluid border rounded">
                    <p class="mt-2 small text-muted">Scan to deposit TRX</p>
                    <small class="text-muted">${depositAddress}</small>
                </div>
            `;
        } catch (error) {
            console.error('QR Code generation error:', error);
            qrcodeContainer.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
                    <p>Failed to generate QR code</p>
                </div>
            `;
        }
    }

    togglePrivateKeyVisibility() {
        const privateKeyEl = document.getElementById('privateKey');
        const toggleBtn = document.getElementById('togglePrivateKey');
        
        if (!privateKeyEl || !toggleBtn || !this.walletData?.dp_add_prvkey) return;

        if (this.privateKeyVisible) {
            privateKeyEl.type = 'password';
            privateKeyEl.value = '•'.repeat(64);
            toggleBtn.innerHTML = '<i class="fas fa-eye me-2"></i>Show Private Key';
            toggleBtn.classList.remove('btn-warning');
            toggleBtn.classList.add('btn-outline-warning');
        } else {
            privateKeyEl.type = 'text';
            privateKeyEl.value = this.walletData.dp_add_prvkey;
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash me-2"></i>Hide Private Key';
            toggleBtn.classList.remove('btn-outline-warning');
            toggleBtn.classList.add('btn-warning');
            
            // Show security warning
            Swal.fire({
                icon: 'warning',
                title: 'Security Warning!',
                html: `
                    <div class="text-start">
                        <p><strong>Never share your private key with anyone!</strong></p>
                        <p>Anyone with your private key can access your funds.</p>
                        <ul class="text-danger">
                            <li>Do not share this key</li>
                            <li>Do not store it online</li>
                            <li>Keep it secure and offline</li>
                        </ul>
                    </div>
                `,
                confirmButtonColor: '#d33',
                confirmButtonText: 'I Understand'
            });
        }
        
        this.privateKeyVisible = !this.privateKeyVisible;
    }

    async generateNewDepositAddress() {
        try {
            const result = await Swal.fire({
                title: 'Generate New Address?',
                text: 'This will create a new TRON deposit address. Your old address will be replaced.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Generate New Address',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            this.showLoading('walletInfo', 'Generating new TRON address...');

            const token = localStorage.getItem('token');
            const response = await fetch('/api/wallet/generate-deposit-address', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('New TRON deposit address generated successfully!');
                await this.loadWalletData();
                this.generateQRCode();
            } else {
                this.showError(data.message || 'Failed to generate address');
            }
        } catch (error) {
            console.error('Generate address error:', error);
            this.showError('Failed to generate new address');
        }
    }

    showUpdateWalletModal() {
        const modalContent = `
            <form id="updateWalletForm">
                <div class="mb-3">
                    <label for="newWalletAddress" class="form-label">Your TRON Wallet Address</label>
                    <input type="text" class="form-control" id="newWalletAddress" 
                           placeholder="T..." required
                           pattern="^T[1-9A-HJ-NP-Za-km-z]{33}$">
                    <div class="form-text">
                        Enter your personal TRON wallet address (starts with T, 34 characters)
                    </div>
                </div>
                <div class="mb-3">
                    <label for="payPassword" class="form-label">Payment Password</label>
                    <input type="password" class="form-control" id="payPassword" 
                           placeholder="Enter your payment password" required
                           maxlength="6" minlength="4">
                </div>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    This address will be used for withdrawals. Make sure it's correct!
                </div>
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-warning">
                        <i class="fas fa-save me-2"></i>Update Wallet Address
                    </button>
                </div>
            </form>
        `;

        const modalContentElement = document.getElementById('updateWalletModalContent');
        if (modalContentElement) {
            modalContentElement.innerHTML = modalContent;
        }

        const modalElement = document.getElementById('updateWalletModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }

        // Re-attach event listener
        const updateWalletForm = document.getElementById('updateWalletForm');
        if (updateWalletForm) {
            updateWalletForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.updateWalletAddress();
            });
        }
    }

    async updateWalletAddress() {
        const newAddressInput = document.getElementById('newWalletAddress');
        const payPasswordInput = document.getElementById('payPassword');

        if (!newAddressInput || !payPasswordInput) return;

        const newAddress = newAddressInput.value;
        const payPassword = payPasswordInput.value;

        if (!newAddress) {
            this.showError('Please enter a wallet address');
            return;
        }

        if (!payPassword) {
            this.showError('Please enter your payment password');
            return;
        }

        // Basic TRON address validation
        if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(newAddress)) {
            this.showError('Invalid TRON address format. TRON addresses start with T and are 34 characters long.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/wallet/update-address', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wallet_address: newAddress,
                    pay_password: payPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Wallet address updated successfully!');
                const modalElement = document.getElementById('updateWalletModal');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) modal.hide();
                }
                await this.loadWalletData();
            } else {
                this.showError(data.message || 'Failed to update wallet address');
            }
        } catch (error) {
            console.error('Update wallet error:', error);
            this.showError('Failed to update wallet address');
        }
    }

    async checkNetworkStatus() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/wallet/network-status', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.updateTronStatus(data);
            } else {
                this.updateTronStatus({ success: false });
            }
        } catch (error) {
            console.error('Network status check error:', error);
            this.updateTronStatus({ success: false });
        }
    }

    updateTronStatus(data) {
        const statusElement = document.getElementById('tronStatus');
        if (!statusElement) return;

        if (data.success && data.network.connected) {
            statusElement.innerHTML = `
                <span class="badge bg-success">
                    <i class="fas fa-check-circle me-1"></i>
                    TRON MainNet • Block #${data.network.blockHeight}
                </span>
            `;
        } else {
            statusElement.innerHTML = `
                <span class="badge bg-warning">
                    <i class="fas fa-exclamation-triangle me-1"></i>
                    TRON MainNet • Offline Mode
                </span>
            `;
        }
    }

    showTransactionDetails(transactionId) {
        const transaction = this.transactions.find(t => t.transaction_id == transactionId);
        if (!transaction) return;

        Swal.fire({
            title: 'Transaction Details',
            html: `
                <div class="text-start">
                    <div class="row mb-2">
                        <div class="col-5"><strong>Type:</strong></div>
                        <div class="col-7">${this.formatTransactionType(transaction.transaction_type)}</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5"><strong>Amount:</strong></div>
                        <div class="col-7">${this.formatBalance(transaction.amount)} TRX</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5"><strong>Fee:</strong></div>
                        <div class="col-7">${this.formatBalance(transaction.fee)} TRX</div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5"><strong>Status:</strong></div>
                        <div class="col-7"><span class="badge ${this.getStatusClass(transaction.status)}">${transaction.status}</span></div>
                    </div>
                    <div class="row mb-2">
                        <div class="col-5"><strong>Date:</strong></div>
                        <div class="col-7">${new Date(transaction.date).toLocaleString()}</div>
                    </div>
                    ${transaction.sender_username ? `
                        <div class="row mb-2">
                            <div class="col-5"><strong>From:</strong></div>
                            <div class="col-7">${transaction.sender_username}</div>
                        </div>
                    ` : ''}
                    ${transaction.receiver_username ? `
                        <div class="row mb-2">
                            <div class="col-5"><strong>To:</strong></div>
                            <div class="col-7">${transaction.receiver_username}</div>
                        </div>
                    ` : ''}
                </div>
            `,
            confirmButtonText: 'Close',
            width: '600px'
        });
    }

    showWithdrawalSuccess(transaction) {
        Swal.fire({
            icon: 'success',
            title: 'Withdrawal Request Submitted!',
            html: `
                <div class="text-start">
                    <p><strong>Transaction Details:</strong></p>
                    <div class="row">
                        <div class="col-6">Amount:</div>
                        <div class="col-6">${this.formatBalance(transaction.amount)} TRX</div>
                    </div>
                    <div class="row">
                        <div class="col-6">Fee:</div>
                        <div class="col-6">${this.formatBalance(transaction.fee)} TRX</div>
                    </div>
                    <div class="row">
                        <div class="col-6">You Receive:</div>
                        <div class="col-6 text-success">${this.formatBalance(transaction.amount - transaction.fee)} TRX</div>
                    </div>
                </div>
            `,
            confirmButtonText: 'OK'
        });
    }

    changePage(direction) {
        this.currentPage += direction;
        this.loadTransactions();
    }

    copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const textToCopy = element.value;

        if (!textToCopy || textToCopy === 'Not set' || textToCopy === 'Not generated' || textToCopy === 'Not available') {
            this.showError('Nothing to copy');
            return;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showSuccess('Copied to clipboard!');
        }).catch(err => {
            console.error('Copy failed:', err);
            this.showError('Failed to copy to clipboard');
        });
    }

    formatTransactionType(type) {
        const types = {
            'deposit': 'Deposit',
            'withdrawal': 'Withdrawal',
            'machine_purchase': 'Machine Purchase',
            'mining_earning': 'Mining Earning',
            'mining_stopped': 'Mining Stopped',
            'mining_stopped_all': 'All Mining Stopped',
            'vip_upgrade': 'VIP Upgrade',
            'referral_bonus': 'Referral Bonus',
            'admin_deposit': 'Admin Deposit',
            'admin_withdrawal': 'Admin Withdrawal'
        };
        return types[type] || type.replace(/_/g, ' ').toUpperCase();
    }

    getStatusClass(status) {
        const classes = {
            'completed': 'bg-success',
            'pending': 'bg-warning',
            'failed': 'bg-danger',
            'cancelled': 'bg-secondary'
        };
        return classes[status] || 'bg-secondary';
    }

    getUserVIPLevel() {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        return userData.vip_level || 0;
    }

    formatBalance(amount) {
        return parseFloat(amount || 0).toFixed(6);
    }

    showLoading(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (container) {
            const loadingHtml = `
                <div class="text-center py-4">
                    <div class="loading-spinner mb-2"></div>
                    <p class="text-muted">${message}</p>
                </div>
            `;
            if (containerId === 'transactionsSection') {
                document.getElementById('transactionsList').innerHTML = loadingHtml;
            } else {
                container.innerHTML = loadingHtml;
            }
        }
    }

    showSuccess(message) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'success',
                title: 'Success!',
                text: message,
                timer: 3000,
                showConfirmButton: false
            });
        }
    }

    showError(message) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: message,
                timer: 5000
            });
        }
    }

    logout() {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Logout?',
                text: 'Are you sure you want to logout?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, logout!',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.performLogout();
                }
            });
        } else {
            if (confirm('Are you sure you want to logout?')) {
                this.performLogout();
            }
        }
    }

    performLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

// Initialize wallet manager
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing WalletManager...');
    new WalletManager();
});