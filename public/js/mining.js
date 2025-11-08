class MiningManager {
    constructor() {
        this.machines = [];
        this.activeMining = [];
        this.userBalance = 0;
        this.userVIP = 0;
        this.initializeEventListeners();
        this.loadMiningData();
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

        // Quick purchase form
        const quickPurchaseForm = document.getElementById('quickPurchaseForm');
        if (quickPurchaseForm) {
            quickPurchaseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleQuickPurchase();
            });
        }

        const quickMachineSelect = document.getElementById('quickMachineSelect');
        if (quickMachineSelect) {
            quickMachineSelect.addEventListener('change', (e) => {
                this.updateQuickPurchaseInfo();
            });
        }

        const quickQuantity = document.getElementById('quickQuantity');
        if (quickQuantity) {
            quickQuantity.addEventListener('input', (e) => {
                this.updateQuickPurchaseInfo();
            });
        }

        // Search functionality
        const searchMachines = document.getElementById('searchMachines');
        if (searchMachines) {
            searchMachines.addEventListener('input', (e) => {
                this.filterMachines(e.target.value);
            });
        }

        // VIP filter
        const vipFilter = document.getElementById('vipFilter');
        if (vipFilter) {
            vipFilter.addEventListener('change', (e) => {
                this.filterMachinesByVIP(e.target.value);
            });
        }
    }

    async loadMiningData() {
    try {
        console.log('🔄 Loading mining data...');

        // 1️⃣ Önce kullanıcı profili (bakiye ve VIP)
        await this.loadUserProfile();

        // 2️⃣ Ardından makineler (artık balance biliniyor)
        await this.loadMachines();

        // 3️⃣ Sonra aktif mining ve geçmiş
        await this.loadActiveMining();
        await this.loadMiningHistory();

        console.log('✅ Mining data loaded successfully');
    } catch (error) {
        console.error('❌ Mining data load error:', error);
        this.showError('Failed to load mining data');
    }
}


    async loadUserProfile() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.error('❌ No token found');
                window.location.href = '/';
                return;
            }

            console.log('🔄 Loading user profile...');
            const response = await fetch('/api/user/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('📊 Profile response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('📋 Profile API response:', data);
                
                if (data.success) {
                    // Balance değerlerini number'a çevir
                    this.userBalance = parseFloat(data.finance?.available_balance) || 0;
                    this.userVIP = parseInt(data.user?.vip_level) || 0;
                    
                    console.log('💰 Parsed user data:', {
                        balance: this.userBalance,
                        vip: this.userVIP,
                        rawBalance: data.finance?.available_balance,
                        rawVIP: data.user?.vip_level
                    });
                    
                    const availableBalance = document.getElementById('availableBalance');
                    const userVIPLevel = document.getElementById('userVIPLevel');
                    
                    if (availableBalance) {
                        availableBalance.textContent = this.formatBalance(this.userBalance) + ' TRX';
                        console.log('✅ Balance updated in UI:', this.formatBalance(this.userBalance));
                    }
                    
                    if (userVIPLevel) {
                        const vipLevels = ['Bronze', 'Silver', 'Gold'];
                        userVIPLevel.textContent = vipLevels[this.userVIP] || 'Bronze';
                        console.log('✅ VIP updated in UI:', vipLevels[this.userVIP]);
                    }
                } else {
                    console.error('❌ Profile API returned success: false', data);
                }
            } else if (response.status === 401) {
                console.error('❌ Unauthorized - logging out');
                this.logout();
            } else {
                console.error('❌ Profile API error status:', response.status);
                const errorText = await response.text();
                console.error('❌ Profile API error response:', errorText);
            }
        } catch (error) {
            console.error('❌ Profile load error:', error);
        }
    }

    async loadMachines() {
        try {
            const token = localStorage.getItem('token');
            console.log('🔄 Loading machines...');
            
            const response = await fetch('/api/mining/machines', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📋 Machines API response:', data);
                
                if (data.success) {
                    this.machines = data.machines || [];
                    console.log('✅ Machines loaded:', this.machines.length);
                    this.renderMachines();
                    this.updateQuickPurchaseSelect();
                    this.updateMachineStats();
                } else {
                    console.error('❌ Machines API returned success: false', data);
                }
            } else {
                console.error('❌ Machines API error status:', response.status);
            }
        } catch (error) {
            console.error('❌ Machines load error:', error);
        }
    }

    async loadActiveMining() {
        try {
            const token = localStorage.getItem('token');
            console.log('🔄 Loading active mining...');
            
            const response = await fetch('/api/mining/active-mining', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📋 Active mining API response:', data);
                
                if (data.success) {
                    this.activeMining = data.mining || [];
                    console.log('✅ Active mining loaded:', this.activeMining.length);
                    this.renderActiveMining();
                    
                    if (data.statistics) {
                        this.updateMiningStatistics(data.statistics);
                    }
                } else {
                    console.error('❌ Active mining API returned success: false', data);
                }
            } else {
                console.error('❌ Active mining API error status:', response.status);
            }
        } catch (error) {
            console.error('❌ Active mining load error:', error);
        }
    }

    async loadMiningHistory() {
        try {
            const token = localStorage.getItem('token');
            console.log('🔄 Loading mining history...');
            
            const response = await fetch('/api/mining/mining-history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📋 Mining history API response:', data);
                
                if (data.success) {
                    this.renderMiningHistory(data.history || []);
                    console.log('✅ Mining history loaded');
                } else {
                    console.error('❌ Mining history API returned success: false', data);
                }
            } else {
                console.error('❌ Mining history API error status:', response.status);
            }
        } catch (error) {
            console.error('❌ Mining history load error:', error);
        }
    }

    renderMachines() {
        const container = document.getElementById('machinesList');
        if (!container) {
            console.error('❌ Machines container not found');
            return;
        }
        
        console.log('🔄 Rendering machines...', {
            machinesCount: this.machines?.length,
            userBalance: this.userBalance,
            userVIP: this.userVIP
        });

        if (!this.machines || this.machines.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="fas fa-server fa-4x mb-3"></i>
                    <h4>No mining machines available</h4>
                    <p>Please check back later</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.machines.map(machine => {
            // Değerleri kesinlikle number'a çevir
            const machinePrice = parseFloat(machine.price) || 0;
            const machineVIP = parseInt(machine.vip_requirement) || 0;
            const machineHashrate = parseFloat(machine.hashrate) || 0;
            
            const canPurchase = this.userVIP >= machineVIP;
            const isAffordable = this.userBalance >= machinePrice;
            
            console.log(`🔍 Machine Check: ${machine.machine_name}`, {
                price: machinePrice,
                userBalance: this.userBalance,
                vipRequired: machineVIP,
                userVIP: this.userVIP,
                canPurchase: canPurchase,
                isAffordable: isAffordable,
                affordableCheck: `${this.userBalance} >= ${machinePrice} = ${isAffordable}`
            });

            const dailyEarning = this.calculateDailyEarning(machineHashrate);
            const roi = this.calculateROI(machinePrice, machineHashrate);

            return `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="card machine-card h-100 ${!canPurchase ? 'card-disabled' : ''}">
                        <div class="card-header position-relative">
                            <h6 class="card-title mb-0">${machine.machine_name || 'Unknown Machine'}</h6>
                            ${machineVIP > 0 ? 
                              `<span class="badge bg-warning position-absolute top-0 end-0 m-2">VIP ${machineVIP}</span>` : ''}
                        </div>
                        <div class="card-body">
                            <div class="machine-stats">
                                <div class="stat-item">
                                    <small class="text-muted">Hashrate</small>
                                    <div class="h5 text-primary">${this.formatHashrate(machineHashrate)}</div>
                                </div>
                                <div class="stat-item">
                                    <small class="text-muted">Price</small>
                                    <div class="h5 text-success">${this.formatBalance(machinePrice)} TRX</div>
                                </div>
                                <div class="stat-item">
                                    <small class="text-muted">Daily Earning</small>
                                    <div class="h6 text-info">
                                        ${this.formatBalance(dailyEarning)} TRX
                                    </div>
                                </div>
                                <div class="stat-item">
                                    <small class="text-muted">ROI Period</small>
                                    <div class="h6 ${roi <= 30 ? 'text-success' : 'text-warning'}">
                                        ${roi} days
                                    </div>
                                </div>
                            </div>
                            ${machine.stock !== undefined && machine.stock !== 1 ? `
                                <div class="stock-info">
                                    <small class="text-muted">Stock: </small>
                                    <span class="badge ${machine.stock > 5 ? 'bg-success' : machine.stock > 0 ? 'bg-warning' : 'bg-danger'}">
                                        ${machine.stock} left
                                    </span>
                                </div>
                            ` : ''}
                            <!-- Debug info -->
                            <div class="debug-info">
                                <strong>Debug Info:</strong><br>
                                Balance: ${this.userBalance.toFixed(6)} TRX<br>
                                Price: ${machinePrice.toFixed(6)} TRX<br>
                                VIP: You(${this.userVIP}) vs Required(${machineVIP})<br>
                                Can Buy: ${canPurchase ? '✅' : '❌'}, Affordable: ${isAffordable ? '✅' : '❌'}
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-primary w-100 btn-purchase" 
                                    data-machine-id="${machine.machine_id}"
                                    ${!canPurchase || !isAffordable ? 'disabled' : ''}>
                                <i class="fas fa-shopping-cart me-2"></i>
                                Purchase - ${this.formatBalance(machinePrice)} TRX
                            </button>
                            ${!canPurchase ? `
                                <small class="text-warning d-block mt-2 text-center">
                                    <i class="fas fa-crown me-1"></i>
                                    VIP ${machineVIP} required (You: VIP ${this.userVIP})
                                </small>
                            ` : !isAffordable ? `
                                <small class="text-danger d-block mt-2 text-center">
                                    <i class="fas fa-wallet me-1"></i>
                                    Insufficient balance. Need: ${this.formatBalance(machinePrice - this.userBalance)} more TRX
                                </small>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners to purchase buttons
        document.querySelectorAll('.btn-purchase').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const machineId = e.target.closest('.btn-purchase').dataset.machineId;
                console.log('🛒 Purchase button clicked for machine:', machineId);
                this.showPurchaseModal(machineId);
            });
        });

        console.log('✅ Machines rendered successfully');
    }

    renderActiveMining() {
        const container = document.getElementById('activeMiningList');
        if (!container) return;
        
        if (!this.activeMining || this.activeMining.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-cube fa-4x mb-3"></i>
                    <h4>No Active Mining</h4>
                    <p class="mb-3">You don't have any active mining machines</p>
                    <a href="#machinesList" class="btn btn-primary btn-lg">
                        <i class="fas fa-rocket me-2"></i>Start Mining
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = this.activeMining.map(mining => {
            const runningTime = this.calculateRunningTime(mining.start_time);
            const totalEarned = this.calculateTotalEarned(mining.start_time, mining.daily_earning);
            
            return `
                <div class="card mining-machine-card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-server text-primary fa-2x me-3"></i>
                                    <div>
                                        <h6 class="mb-1">${mining.machine_name || 'Unknown Machine'}</h6>
                                        <small class="text-muted">
                                            Started: ${new Date(mining.start_time).toLocaleDateString()}
                                        </small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-2">
                                <small class="text-muted">Hashrate</small>
                                <div class="fw-bold">${this.formatHashrate(mining.hashrate)}</div>
                            </div>
                            <div class="col-md-2">
                                <small class="text-muted">Daily Earning</small>
                                <div class="text-success fw-bold">${this.formatBalance(mining.daily_earning)} TRX</div>
                            </div>
                            <div class="col-md-2">
                                <small class="text-muted">Running Time</small>
                                <div class="text-info">${runningTime}</div>
                            </div>
                            <div class="col-md-3 text-end">
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline-danger btn-stop-mining" 
                                            data-mining-id="${mining.mining_id}"
                                            title="Stop Mining">
                                        <i class="fas fa-stop"></i> Stop
                                    </button>
                                    <button class="btn btn-sm btn-outline-info btn-mining-details"
                                            data-mining-id="${mining.mining_id}"
                                            title="View Details">
                                        <i class="fas fa-chart-bar"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add stop mining event listeners
        document.querySelectorAll('.btn-stop-mining').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const miningId = e.target.closest('.btn-stop-mining').dataset.miningId;
                this.stopMining(miningId);
            });
        });

        // Show stop all button if multiple machines
        if (this.activeMining.length > 1) {
            container.innerHTML += `
                <div class="text-center mt-4">
                    <button class="btn btn-danger btn-lg" id="stopAllMining">
                        <i class="fas fa-stop-circle me-2"></i>Stop All Mining Machines
                    </button>
                </div>
            `;

            const stopAllBtn = document.getElementById('stopAllMining');
            if (stopAllBtn) {
                stopAllBtn.addEventListener('click', () => {
                    this.stopAllMining();
                });
            }
        }
    }

    renderMiningHistory(history) {
        const container = document.getElementById('miningHistory');
        if (!container) return;

        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-history fa-2x mb-2"></i>
                    <p>No mining history</p>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map(item => `
            <tr>
                <td>${item.machine_name || 'Unknown'}</td>
                <td>${this.formatHashrate(item.hashrate)}</td>
                <td>${this.formatBalance(item.amount)} TRX</td>
                <td>${this.formatBalance(item.total_earning)} TRX</td>
                <td>${new Date(item.start_time).toLocaleDateString()}</td>
                <td>${item.end_time ? new Date(item.end_time).toLocaleDateString() : '-'}</td>
                <td>
                    <span class="badge ${item.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${item.status}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    updateMiningStatistics(stats) {
        const activeMiners = document.getElementById('activeMiners');
        const totalHashrate = document.getElementById('totalHashrate');
        const dailyIncome = document.getElementById('dailyIncome');
        const totalEarned = document.getElementById('totalEarned');
        const monthlyEstimate = document.getElementById('monthlyEstimate');
        const networkDifficulty = document.getElementById('networkDifficulty');

        if (activeMiners) activeMiners.textContent = stats.total_machines || 0;
        if (totalHashrate) totalHashrate.textContent = this.formatHashrate(stats.total_hashrate || 0);
        if (dailyIncome) dailyIncome.textContent = this.formatBalance(stats.total_daily_earning || 0) + ' TRX';
        if (totalEarned) totalEarned.textContent = this.formatBalance(stats.total_earned || 0) + ' TRX';
        
        // Calculate and display additional stats
        const monthlyEstimateValue = (stats.total_daily_earning || 0) * 30;
        if (monthlyEstimate) monthlyEstimate.textContent = this.formatBalance(monthlyEstimateValue) + ' TRX';
        
        const networkDifficultyValue = (1 + Math.random() * 0.5).toFixed(2);
        if (networkDifficulty) networkDifficulty.textContent = networkDifficultyValue;
    }

    updateMachineStats() {
        const totalMachines = document.getElementById('totalMachines');
        const affordableMachines = document.getElementById('affordableMachines');

        if (totalMachines && affordableMachines) {
            const totalMachinesCount = this.machines.length;
            const affordableMachinesCount = this.machines.filter(m => {
                const machinePrice = parseFloat(m.price) || 0;
                const machineVIP = parseInt(m.vip_requirement) || 0;
                return machinePrice <= this.userBalance && this.userVIP >= machineVIP;
            }).length;
            
            totalMachines.textContent = totalMachinesCount;
            affordableMachines.textContent = affordableMachinesCount + ' affordable';
        }
    }

    updateQuickPurchaseSelect() {
        const select = document.getElementById('quickMachineSelect');
        if (!select) return;

        const affordableMachines = this.machines.filter(m => {
            const machinePrice = parseFloat(m.price) || 0;
            const machineVIP = parseInt(m.vip_requirement) || 0;
            return machineVIP === 0 && machinePrice <= this.userBalance;
        });

        select.innerHTML = '<option value="">Choose a machine...</option>' +
            affordableMachines.map(machine => {
                const machinePrice = parseFloat(machine.price) || 0;
                const machineHashrate = parseFloat(machine.hashrate) || 0;
                return `
                <option value="${machine.machine_id}" 
                        data-price="${machinePrice}"
                        data-hashrate="${machineHashrate}">
                    ${machine.machine_name} - ${this.formatBalance(machinePrice)} TRX
                </option>
            `}).join('');

        this.updateQuickPurchaseInfo();
    }

    updateQuickPurchaseInfo() {
        const select = document.getElementById('quickMachineSelect');
        const quantity = document.getElementById('quickQuantity');
        const quickTotalCost = document.getElementById('quickTotalCost');
        const quickDailyEarning = document.getElementById('quickDailyEarning');
        const quickROI = document.getElementById('quickROI');

        if (!select || !quantity || !quickTotalCost || !quickDailyEarning || !quickROI) return;

        const quantityValue = parseInt(quantity.value) || 1;
        const selectedOption = select.options[select.selectedIndex];
        
        if (selectedOption && selectedOption.value) {
            const price = parseFloat(selectedOption.dataset.price);
            const hashrate = parseFloat(selectedOption.dataset.hashrate);
            const total = price * quantityValue;
            const dailyEarning = this.calculateDailyEarning(hashrate) * quantityValue;
            const roi = this.calculateROI(total, hashrate * quantityValue);

            quickTotalCost.textContent = this.formatBalance(total) + ' TRX';
            quickDailyEarning.textContent = this.formatBalance(dailyEarning) + ' TRX';
            quickROI.textContent = roi + ' days';
        } else {
            quickTotalCost.textContent = '0.00 TRX';
            quickDailyEarning.textContent = '0.00 TRX';
            quickROI.textContent = '-';
        }
    }

    async handleQuickPurchase() {
        const machineId = document.getElementById('quickMachineSelect')?.value;
        const quantity = parseInt(document.getElementById('quickQuantity')?.value) || 1;

        if (!machineId) {
            this.showError('Please select a machine');
            return;
        }

        await this.purchaseMachine(machineId, quantity);
    }

    async showPurchaseModal(machineId) {
        const machine = this.machines.find(m => m.machine_id == machineId);
        if (!machine) return;

        const machinePrice = parseFloat(machine.price) || 0;
        const machineVIP = parseInt(machine.vip_requirement) || 0;
        const machineHashrate = parseFloat(machine.hashrate) || 0;
        
        const canPurchase = this.userVIP >= machineVIP;
        const isAffordable = this.userBalance >= machinePrice;
        const dailyEarning = this.calculateDailyEarning(machineHashrate);
        const roi = this.calculateROI(machinePrice, machineHashrate);

        const modalContent = `
            <div class="text-center mb-4">
                <i class="fas fa-server fa-3x text-primary mb-3"></i>
                <h4>${machine.machine_name}</h4>
                ${machineVIP > 0 ? 
                  `<span class="badge bg-warning">VIP ${machineVIP} Required</span>` : ''}
            </div>
            
            <div class="row text-center mb-4">
                <div class="col-4">
                    <div class="border rounded p-2">
                        <small class="text-muted d-block">Hashrate</small>
                        <strong>${this.formatHashrate(machineHashrate)}</strong>
                    </div>
                </div>
                <div class="col-4">
                    <div class="border rounded p-2">
                        <small class="text-muted d-block">Price</small>
                        <strong class="text-success">${this.formatBalance(machinePrice)} TRX</strong>
                    </div>
                </div>
                <div class="col-4">
                    <div class="border rounded p-2">
                        <small class="text-muted d-block">Daily</small>
                        <strong class="text-info">${this.formatBalance(dailyEarning)} TRX</strong>
                    </div>
                </div>
            </div>

            <div class="p-3 bg-light rounded mb-3">
                <div class="row">
                    <div class="col-6">
                        <small class="text-muted">Your Balance:</small>
                        <div class="${isAffordable ? 'text-success' : 'text-danger'} fw-bold">
                            ${this.formatBalance(this.userBalance)} TRX
                        </div>
                    </div>
                    <div class="col-6">
                        <small class="text-muted">ROI Period:</small>
                        <div class="fw-bold">${roi} days</div>
                    </div>
                </div>
            </div>

            ${!canPurchase ? `
                <div class="alert alert-warning">
                    <i class="fas fa-crown me-2"></i>
                    You need VIP ${machineVIP} to purchase this machine (You: VIP ${this.userVIP})
                </div>
            ` : !isAffordable ? `
                <div class="alert alert-danger">
                    <i class="fas fa-wallet me-2"></i>
                    Insufficient balance. You need ${this.formatBalance(machinePrice - this.userBalance)} more TRX
                </div>
            ` : ''}

            <div class="d-grid gap-2">
                <button class="btn btn-primary btn-lg" id="confirmPurchase" 
                        ${!canPurchase || !isAffordable ? 'disabled' : ''}>
                    <i class="fas fa-shopping-cart me-2"></i>
                    Confirm Purchase - ${this.formatBalance(machinePrice)} TRX
                </button>
                ${!isAffordable ? `
                    <a href="/wallet" class="btn btn-outline-success">
                        <i class="fas fa-wallet me-2"></i>
                        Deposit Funds
                    </a>
                ` : ''}
            </div>
        `;

        const purchaseModalContent = document.getElementById('purchaseModalContent');
        if (purchaseModalContent) {
            purchaseModalContent.innerHTML = modalContent;
            
            const modalElement = document.getElementById('purchaseModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();

                const confirmPurchase = document.getElementById('confirmPurchase');
                if (confirmPurchase) {
                    confirmPurchase.addEventListener('click', () => {
                        this.purchaseMachine(machineId, 1);
                        modal.hide();
                    });
                }
            }
        }
    }

    async purchaseMachine(machineId, quantity = 1) {
        try {
            const token = localStorage.getItem('token');
            console.log('🛒 Purchasing machine:', { machineId, quantity });
            
            const response = await fetch('/api/mining/purchase-machine', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    machine_id: parseInt(machineId),
                    quantity: parseInt(quantity)
                })
            });

            const result = await response.json();
            console.log('📋 Purchase response:', result);

            if (result.success) {
                this.showSuccess(result.message);
                await this.loadMiningData(); // Reload all data
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('❌ Purchase error:', error);
            this.showError('Purchase failed. Please try again.');
        }
    }

    async stopMining(miningId) {
        try {
            const result = await Swal.fire({
                title: 'Stop Mining?',
                text: 'Are you sure you want to stop this mining machine? You will receive your earned TRX.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, stop it!',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/mining/stop-mining/${miningId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`Mining stopped! Earned: ${this.formatBalance(data.earned)} TRX`);
                await this.loadMiningData();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('❌ Stop mining error:', error);
            this.showError('Failed to stop mining');
        }
    }

    async stopAllMining() {
        try {
            const result = await Swal.fire({
                title: 'Stop All Mining?',
                text: 'Are you sure you want to stop ALL your mining machines?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, stop all!',
                cancelButtonText: 'Cancel'
            });

            if (!result.isConfirmed) return;

            const token = localStorage.getItem('token');
            const response = await fetch('/api/mining/stop-all-mining', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(`Stopped ${data.machines_stopped} machines. Total earned: ${this.formatBalance(data.total_earned)} TRX`);
                await this.loadMiningData();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('❌ Stop all mining error:', error);
            this.showError('Failed to stop mining machines');
        }
    }

    filterMachines(searchTerm) {
        const filtered = this.machines.filter(machine =>
            machine.machine_name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        this.renderFilteredMachines(filtered);
    }

    filterMachinesByVIP(vipLevel) {
        const filtered = vipLevel === 'all' 
            ? this.machines 
            : this.machines.filter(machine => {
                const machineVIP = parseInt(machine.vip_requirement) || 0;
                return machineVIP == vipLevel;
            });
        this.renderFilteredMachines(filtered);
    }

    renderFilteredMachines(machines) {
        const container = document.getElementById('machinesList');
        if (!container) return;

        if (machines.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <i class="fas fa-search fa-3x mb-3"></i>
                    <h4>No machines found</h4>
                    <p>Try adjusting your search criteria</p>
                </div>
            `;
            return;
        }

        // Store original machines
        const originalMachines = [...this.machines];
        
        // Render filtered machines
        this.machines = machines;
        this.renderMachines();
        
        // Restore original machines array
        this.machines = originalMachines;
    }

    calculateDailyEarning(hashrate) {
        const baseRate = 0.001;
        return ((hashrate || 0) / 100) * baseRate;
    }

    calculateROI(price, hashrate) {
        const dailyEarning = this.calculateDailyEarning(hashrate);
        if (dailyEarning <= 0) return Infinity;
        return Math.ceil((price || 0) / dailyEarning);
    }

    calculateRunningTime(startTime) {
        if (!startTime) return '0h';
        
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (diffDays > 0) {
            return `${diffDays}d ${diffHours}h`;
        }
        return `${diffHours}h`;
    }

    calculateTotalEarned(startTime, dailyEarning) {
        if (!startTime) return 0;
        
        const start = new Date(startTime);
        const now = new Date();
        const diffHours = (now - start) / (1000 * 60 * 60);
        return ((dailyEarning || 0) / 24) * diffHours;
    }

    formatBalance(amount) {
        return parseFloat(amount || 0).toFixed(6);
    }

    formatHashrate(hashrate) {
        const hashrateValue = hashrate || 0;
        if (hashrateValue >= 1000) {
            return (hashrateValue / 1000).toFixed(2) + ' KH/s';
        }
        return hashrateValue.toFixed(2) + ' H/s';
    }

    showSuccess(message) {
        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
    }

    showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Error!',
            text: message,
            timer: 5000
        });
    }

    logout() {
        Swal.fire({
            title: 'Logout?',
            text: 'Are you sure you want to logout?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, logout!'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }
        });
    }
}

// Initialize mining manager
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing MiningManager...');
    window.miningManager = new MiningManager();
});