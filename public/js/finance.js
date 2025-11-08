class FinanceManager {
    constructor() {
        this.investmentPlans = {
            basic: { dailyReturn: 1.5, period: 30, minAmount: 10, referralBonus: 5 },
            advanced: { dailyReturn: 2.0, period: 60, minAmount: 100, referralBonus: 8 },
            premium: { dailyReturn: 2.5, period: 90, minAmount: 500, referralBonus: 12 }
        };
        this.activeInvestments = [];
        this.investmentHistory = [];
        this.initializeEventListeners();
        this.loadInvestmentData();
        this.setupCalculator();
    }

    initializeEventListeners() {
        // Navigation
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Investment buttons
        document.querySelectorAll('.invest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const plan = e.target.dataset.plan;
                const minAmount = e.target.dataset.min;
                this.showInvestmentModal(plan, minAmount);
            });
        });

        // Calculator inputs
        document.getElementById('calcAmount').addEventListener('input', () => {
            this.updateCalculator();
        });

        document.getElementById('calcPlan').addEventListener('change', () => {
            this.updateCalculator();
        });

        document.getElementById('calcDays').addEventListener('input', () => {
            this.updateCalculator();
        });

        // Investment form
        document.getElementById('investmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processInvestment();
        });

        // Auto-refresh every 60 seconds
        setInterval(() => {
            this.loadInvestmentData();
        }, 60000);
    }

    async loadInvestmentData() {
        try {
            await Promise.all([
                this.loadActiveInvestments(),
                this.loadInvestmentHistory(),
                this.loadInvestmentStats()
            ]);
        } catch (error) {
            console.error('Investment data load error:', error);
            this.showError('Failed to load investment data');
        }
    }

    async loadActiveInvestments() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/finance/active-investments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.activeInvestments = data.investments;
                    this.updateActiveInvestmentsUI();
                }
            }
        } catch (error) {
            console.error('Active investments load error:', error);
        }
    }

    async loadInvestmentHistory() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/finance/investment-history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.investmentHistory = data.history;
                    this.updateInvestmentHistoryUI();
                }
            }
        } catch (error) {
            console.error('Investment history load error:', error);
        }
    }

    async loadInvestmentStats() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/finance/investment-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    document.getElementById('totalInvested').textContent = 
                        this.formatBalance(data.stats.total_invested) + ' TRX';
                    document.getElementById('activePlans').textContent = 
                        data.stats.active_plans;
                }
            }
        } catch (error) {
            console.error('Investment stats load error:', error);
        }
    }

    showInvestmentModal(plan, minAmount) {
        const planInfo = this.investmentPlans[plan];
        const planNames = {
            basic: 'Basic Plan',
            advanced: 'Advanced Plan',
            premium: 'Premium Plan'
        };

        const modalContent = `
            <div class="mb-3">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    You are investing in <strong>${planNames[plan]}</strong>
                </div>
            </div>
            <div class="mb-3">
                <label for="investmentAmount" class="form-label">Investment Amount (TRX)</label>
                <input type="number" class="form-control" id="investmentAmount" 
                       value="${minAmount}" min="${minAmount}" step="1" required>
                <div class="form-text">
                    Minimum investment: ${minAmount} TRX
                </div>
            </div>
            <div class="mb-3">
                <label for="investmentPayPassword" class="form-label">Payment Password</label>
                <input type="password" class="form-control" id="investmentPayPassword" 
                       placeholder="Enter your payment password" required maxlength="6">
            </div>
            <div class="card bg-light mb-3">
                <div class="card-body">
                    <h6 class="card-title">Investment Summary</h6>
                    <div class="row small">
                        <div class="col-6">Plan:</div>
                        <div class="col-6">${planNames[plan]}</div>
                        <div class="col-6">Daily Return:</div>
                        <div class="col-6 text-success">${planInfo.dailyReturn}%</div>
                        <div class="col-6">Contract Period:</div>
                        <div class="col-6">${planInfo.period} days</div>
                        <div class="col-6">Total Return:</div>
                        <div class="col-6 text-primary">${(planInfo.dailyReturn * planInfo.period).toFixed(1)}%</div>
                        <div class="col-6">Referral Bonus:</div>
                        <div class="col-6 text-warning">${planInfo.referralBonus}%</div>
                    </div>
                </div>
            </div>
            <div class="d-grid gap-2">
                <button type="submit" class="btn btn-primary py-2">
                    <i class="fas fa-check me-2"></i>Confirm Investment
                </button>
            </div>
        `;

        document.getElementById('investmentModalContent').innerHTML = modalContent;
        document.getElementById('investmentModalTitle').innerHTML = 
            `<i class="fas fa-rocket me-2"></i>Invest in ${planNames[plan]}`;

        // Store current plan in modal for form submission
        document.getElementById('investmentModal').dataset.currentPlan = plan;

        const modal = new bootstrap.Modal(document.getElementById('investmentModal'));
        modal.show();
    }

    async processInvestment() {
        const amount = parseFloat(document.getElementById('investmentAmount').value);
        const payPassword = document.getElementById('investmentPayPassword').value;
        const plan = document.getElementById('investmentModal').dataset.currentPlan;

        if (!amount || !payPassword) {
            this.showError('Please fill all fields');
            return;
        }

        const planInfo = this.investmentPlans[plan];
        if (amount < planInfo.minAmount) {
            this.showError(`Minimum investment for this plan is ${planInfo.minAmount} TRX`);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/finance/invest', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan: plan,
                    amount: amount,
                    pay_password: payPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showInvestmentSuccess(data.investment);
                document.getElementById('investmentForm').reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('investmentModal'));
                modal.hide();
                await this.loadInvestmentData();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Investment error:', error);
            this.showError('Investment failed. Please try again.');
        }
    }

    setupCalculator() {
        this.updateCalculator();
    }

    updateCalculator() {
        const amount = parseFloat(document.getElementById('calcAmount').value) || 0;
        const plan = document.getElementById('calcPlan').value;
        const days = parseInt(document.getElementById('calcDays').value) || 30;

        const planInfo = this.investmentPlans[plan];
        const dailyRate = planInfo.dailyReturn / 100;
        
        const dailyProfit = amount * dailyRate;
        const weeklyProfit = dailyProfit * 7;
        const monthlyProfit = dailyProfit * 30;
        const totalProfit = dailyProfit * days;
        const totalReturn = amount + totalProfit;
        const roi = (totalProfit / amount) * 100;

        document.getElementById('calcDailyProfit').textContent = this.formatBalance(dailyProfit) + ' TRX';
        document.getElementById('calcWeeklyProfit').textContent = this.formatBalance(weeklyProfit) + ' TRX';
        document.getElementById('calcMonthlyProfit').textContent = this.formatBalance(monthlyProfit) + ' TRX';
        document.getElementById('calcTotalProfit').textContent = this.formatBalance(totalProfit) + ' TRX';
        document.getElementById('calcTotalReturn').textContent = this.formatBalance(totalReturn) + ' TRX';
        document.getElementById('calcROI').textContent = roi.toFixed(2) + '%';
    }

    updateActiveInvestmentsUI() {
        const container = document.getElementById('activeInvestments');
        
        if (!this.activeInvestments || this.activeInvestments.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-chart-bar fa-3x mb-3"></i>
                    <h5>No Active Investments</h5>
                    <p>Start investing to see your active plans here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.activeInvestments.map(investment => {
            const progress = this.calculateInvestmentProgress(investment);
            const earned = investment.total_earned || 0;
            const remaining = investment.amount * (investment.daily_return / 100) * investment.contract_period - earned;

            return `
                <div class="investment-item card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <h6 class="mb-1">${investment.plan_name}</h6>
                                <small class="text-muted">${investment.contract_period} days</small>
                            </div>
                            <div class="col-md-2">
                                <strong>${this.formatBalance(investment.amount)} TRX</strong>
                            </div>
                            <div class="col-md-2">
                                <span class="text-success">${investment.daily_return}% daily</span>
                            </div>
                            <div class="col-md-3">
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-success" style="width: ${progress}%"></div>
                                </div>
                                <small class="text-muted">${progress}% completed</small>
                            </div>
                            <div class="col-md-2 text-end">
                                <span class="badge bg-success">Active</span>
                            </div>
                        </div>
                        <div class="row mt-2 text-center">
                            <div class="col-4">
                                <small class="text-muted">Earned</small>
                                <div class="fw-bold text-success">${this.formatBalance(earned)} TRX</div>
                            </div>
                            <div class="col-4">
                                <small class="text-muted">Remaining</small>
                                <div class="fw-bold text-warning">${this.formatBalance(remaining)} TRX</div>
                            </div>
                            <div class="col-4">
                                <small class="text-muted">Ends In</small>
                                <div class="fw-bold text-info">${this.getDaysRemaining(investment.end_date)} days</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateInvestmentHistoryUI() {
        const container = document.getElementById('investmentHistory');
        
        if (!this.investmentHistory || this.investmentHistory.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-receipt fa-3x mb-3"></i>
                    <h5>No Investment History</h5>
                    <p>Your investment history will appear here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Plan</th>
                            <th>Amount</th>
                            <th>Period</th>
                            <th>Total Earned</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.investmentHistory.map(investment => `
                            <tr>
                                <td>${investment.plan_name}</td>
                                <td>${this.formatBalance(investment.amount)} TRX</td>
                                <td>${investment.contract_period} days</td>
                                <td class="text-success">${this.formatBalance(investment.total_earned)} TRX</td>
                                <td>${new Date(investment.start_date).toLocaleDateString()}</td>
                                <td>${new Date(investment.end_date).toLocaleDateString()}</td>
                                <td>
                                    <span class="badge ${investment.status === 'completed' ? 'bg-success' : 'bg-secondary'}">
                                        ${investment.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    calculateInvestmentProgress(investment) {
        const start = new Date(investment.start_date);
        const end = new Date(investment.end_date);
        const now = new Date();
        
        const totalDuration = end - start;
        const elapsed = now - start;
        
        return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    }

    getDaysRemaining(endDate) {
        const end = new Date(endDate);
        const now = new Date();
        const diff = end - now;
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    showInvestmentSuccess(investment) {
        Swal.fire({
            icon: 'success',
            title: 'Investment Successful!',
            html: `
                <div class="text-start">
                    <p><strong>Investment Details:</strong></p>
                    <div class="row">
                        <div class="col-6">Plan:</div>
                        <div class="col-6">${investment.plan_name}</div>
                    </div>
                    <div class="row">
                        <div class="col-6">Amount:</div>
                        <div class="col-6">${this.formatBalance(investment.amount)} TRX</div>
                    </div>
                    <div class="row">
                        <div class="col-6">Daily Return:</div>
                        <div class="col-6 text-success">${investment.daily_return}%</div>
                    </div>
                    <div class="row">
                        <div class="col-6">Contract Period:</div>
                        <div class="col-6">${investment.contract_period} days</div>
                    </div>
                    <div class="row">
                        <div class="col-6">Expected Total:</div>
                        <div class="col-6 text-primary">${this.formatBalance(investment.expected_total)} TRX</div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Great!'
        });
    }

    formatBalance(amount) {
        return parseFloat(amount || 0).toFixed(6);
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

// Initialize finance manager
document.addEventListener('DOMContentLoaded', () => {
    new FinanceManager();
});