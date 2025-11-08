class Dashboard {
    constructor() {
        this.userData = null;
        this.initializeEventListeners();
        this.loadDashboardData();
        this.startRealTimeUpdates();
    }

    initializeEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Real-time mining earnings
        setInterval(() => {
            this.updateMiningEarnings();
        }, 60000);

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                this.loadDashboardData();
            }
        });
    }

    async loadDashboardData() {
        try {
            console.log('🔄 Loading dashboard data...');
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/';
                return;
            }

            const [dashboardResponse, miningResponse, transactionsResponse] = await Promise.all([
                fetch('/api/user/dashboard', {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }),
                fetch('/api/user/mining', {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }),
                fetch('/api/user/finance', {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
            ]);

            console.log('📊 Dashboard response status:', dashboardResponse.status);

            if (!dashboardResponse.ok) {
                if (dashboardResponse.status === 401) {
                    this.showError('Session expired. Please login again.');
                    localStorage.removeItem('token');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                    return;
                }
                throw new Error('Failed to load dashboard data');
            }

            const dashboardData = await dashboardResponse.json();
            const miningData = miningResponse.ok ? await miningResponse.json() : { active_mining: [] };
            const financeData = transactionsResponse.ok ? await transactionsResponse.json() : { transactions: [] };

            console.log('📦 Dashboard data received:', dashboardData);
            console.log('⛏️ Mining data received:', miningData);
            console.log('💰 Finance data received:', financeData);

            if (dashboardData.success) {
                this.userData = dashboardData;
                this.updateUI(dashboardData);
                this.updateRecentMining(miningData.active_mining?.slice(0, 5) || []);
                this.updateRecentTransactions(financeData.transactions?.slice(0, 5) || []);
                this.updateCharts();
            } else {
                this.showError(dashboardData.message || 'Failed to load dashboard data');
            }

        } catch (error) {
            console.error('❌ Dashboard load error:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateUI(data) {
        const { user, stats, mining } = data;

        console.log('🔄 Updating UI with:', { user, stats, mining });

        try {
            // Update user info
            const usernameNav = document.getElementById('usernameNav');
            const userEmail = document.getElementById('userEmail');
            const userSince = document.getElementById('userSince');
            
            if (usernameNav) usernameNav.textContent = user.username || 'User';
            if (userEmail) userEmail.textContent = user.email || 'N/A';
            if (userSince) {
                userSince.textContent = user.member_since ? 
                    new Date(user.member_since).toLocaleDateString() : 'N/A';
            }

            // Update balances
            const totalBalance = document.getElementById('totalBalance');
            const availableBalance = document.getElementById('availableBalance');
            const lockedBalance = document.getElementById('lockedBalance');
            
            if (totalBalance) totalBalance.textContent = this.formatBalance(stats.balance || 0);
            if (availableBalance) availableBalance.textContent = this.formatBalance(stats.balance || 0);
            if (lockedBalance) lockedBalance.textContent = this.formatBalance(0); // Varsayılan 0

            // Update VIP status
            const vipLevel = document.getElementById('vipLevel');
            const vipStatus = document.getElementById('vipStatus');
            
            if (vipLevel) {
                const vipLevels = ['Bronze', 'Silver', 'Gold'];
                const vipColors = ['bronze', 'silver', 'gold'];
                vipLevel.textContent = vipLevels[user.vip_level] || 'Bronze';
                vipLevel.className = `badge ${vipColors[user.vip_level] || 'bronze'}`;
            }
            
            if (vipStatus) {
                vipStatus.textContent = user.vip_level > 0 ? 'Premium Member' : 'Basic Member';
            }

            // Update mining stats
            const activeMiners = document.getElementById('activeMiners');
            const totalHashrate = document.getElementById('totalHashrate');
            const dailyIncome = document.getElementById('dailyIncome');
            const totalEarned = document.getElementById('totalEarned');
            
            if (activeMiners) activeMiners.textContent = stats.active_miners || 0;
            if (totalHashrate) totalHashrate.textContent = this.formatHashrate(0); // Varsayılan
            if (dailyIncome) dailyIncome.textContent = this.formatBalance(stats.daily_income || 0);
            if (totalEarned) totalEarned.textContent = this.formatBalance(stats.total_earned || 0);

            // Update referral code
            const refCode = document.getElementById('refCode');
            if (refCode) refCode.textContent = user.ref_code || 'N/A';

        } catch (error) {
            console.error('❌ UI update error:', error);
        }
    }

    updateRecentMining(miningData) {
        const container = document.getElementById('recentMining');
        if (!container) return;
        
        console.log('⛏️ Updating recent mining:', miningData);

        if (!miningData || miningData.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-cube fa-2x mb-2"></i>
                    <p class="mb-0">No active mining</p>
                    <small><a href="/mining" class="text-primary">Start mining now</a></small>
                </div>
            `;
            return;
        }

        container.innerHTML = miningData.map(mining => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <i class="fas fa-server text-primary me-3"></i>
                    <div>
                        <h6 class="mb-1">${mining.machine_name || 'Unknown Machine'}</h6>
                        <small class="text-muted">
                            ${this.formatHashrate(mining.hashrate || 0)} • 
                            Started ${this.formatTimeAgo(mining.start_time)}
                        </small>
                    </div>
                </div>
                <span class="badge bg-success rounded-pill">
                    ${this.formatBalance(mining.daily_earning || 0)}/day
                </span>
            </div>
        `).join('');
    }

    updateRecentTransactions(transactions) {
        const container = document.getElementById('recentTransactions');
        if (!container) return;
        
        console.log('💰 Updating recent transactions:', transactions);

        if (!transactions || transactions.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-exchange-alt fa-2x mb-2"></i>
                    <p class="mb-0">No transactions yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(transaction => {
            const isDeposit = transaction.amount > 0;
            const amountClass = isDeposit ? 'text-success' : 'text-danger';
            const icon = isDeposit ? 'fa-arrow-down' : 'fa-arrow-up';
            const type = this.formatTransactionType(transaction.transaction_type);
            const sign = isDeposit ? '+' : '';
            
            return `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div class="d-flex align-items-center">
                            <i class="fas ${icon} ${amountClass} me-3"></i>
                            <div>
                                <h6 class="mb-1">${type}</h6>
                                <small class="text-muted">
                                    ${transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'} • 
                                    ${transaction.status || 'completed'}
                                </small>
                            </div>
                        </div>
                        <span class="${amountClass} fw-bold">
                            ${sign}${this.formatBalance(Math.abs(transaction.amount || 0))} TRX
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateCharts() {
        const earningsCtx = document.getElementById('earningsChart');
        if (!earningsCtx) return;

        try {
            // Basit örnek veri - gerçek uygulamada API'den alınacak
            const earningsData = {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Daily Earnings (TRX)',
                    data: [2.5, 3.2, 2.8, 4.1, 3.5, 5.2, 4.8],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            };

            // Mevcut chart'ı temizle
            const existingChart = Chart.getChart(earningsCtx);
            if (existingChart) {
                existingChart.destroy();
            }

            // Yeni chart oluştur
            new Chart(earningsCtx, {
                type: 'line',
                data: earningsData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(2) + ' TRX';
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });

            console.log('📈 Chart updated successfully');

        } catch (error) {
            console.error('❌ Chart update error:', error);
        }
    }

    async updateMiningEarnings() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/dashboard', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.stats) {
                    // Sadece mining ile ilgili elementleri güncelle
                    const dailyIncome = document.getElementById('dailyIncome');
                    const totalEarned = document.getElementById('totalEarned');
                    
                    if (dailyIncome) {
                        dailyIncome.textContent = this.formatBalance(data.stats.daily_income || 0);
                        this.highlightUpdate('dailyIncome');
                    }
                    if (totalEarned) {
                        totalEarned.textContent = this.formatBalance(data.stats.total_earned || 0);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Earnings update error:', error);
        }
    }

    highlightUpdate(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('text-success', 'fw-bold');
            setTimeout(() => {
                element.classList.remove('text-success', 'fw-bold');
            }, 2000);
        }
    }

    formatBalance(amount) {
        return parseFloat(amount || 0).toFixed(6);
    }

    formatHashrate(hashrate) {
        const hash = parseFloat(hashrate || 0);
        if (hash >= 1000000) {
            return (hash / 1000000).toFixed(2) + ' MH/s';
        } else if (hash >= 1000) {
            return (hash / 1000).toFixed(2) + ' KH/s';
        }
        return hash.toFixed(2) + ' H/s';
    }

    formatTimeAgo(dateString) {
        if (!dateString) return 'N/A';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) {
                return 'just now';
            } else if (diffMins < 60) {
                return `${diffMins}m ago`;
            } else if (diffHours < 24) {
                return `${diffHours}h ago`;
            } else {
                return `${diffDays}d ago`;
            }
        } catch (error) {
            return 'N/A';
        }
    }

    formatTransactionType(type) {
        const types = {
            'deposit': 'Deposit',
            'withdrawal': 'Withdrawal',
            'withdraw': 'Withdrawal',
            'machine_purchase': 'Machine Purchase',
            'mining_earning': 'Mining Earning',
            'vip_upgrade': 'VIP Upgrade',
            'referral_bonus': 'Referral Bonus',
            'purchase': 'Purchase'
        };
        return types[type] || type || 'Transaction';
    }

    startRealTimeUpdates() {
        // Her 30 saniyede bir verileri yenile
        setInterval(() => {
            this.loadDashboardData();
        }, 30000);
    }

    showError(message) {
        console.error('❌ Dashboard Error:', message);
        
        // SweetAlert2 ile hata göster
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Error!',
                text: message,
                timer: 5000,
                showConfirmButton: true
            });
        } else {
            // Fallback alert
            alert('Error: ' + message);
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

// Dashboard'u başlat
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Dashboard...');
    new Dashboard();
});