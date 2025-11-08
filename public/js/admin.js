class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('adminToken');
        this.currentView = 'dashboard';
        this.usersPage = 1;
        this.usersLimit = 20;
        this.usersSearch = '';
        this.transactionsPage = 1;
        this.transactionsLimit = 50;
        this.transactionsType = '';
        this.transactionsStatus = '';
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.bindEvents();
        this.loadDashboard();
    }

    checkAuth() {
        // Admin panel direkt erişilebilir, token kontrolü yap
        if (!this.token) {
            // Token yoksa login sayfasına yönlendir
            window.location.href = '/admin-login';
            return;
        }

        // Token varsa doğrula
        this.verifyToken().then(valid => {
            if (!valid) {
                window.location.href = '/admin-login';
            }
        }).catch(() => {
            window.location.href = '/admin-login';
        });
    }

    async verifyToken() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.admin-nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.switchView(e));
        });

        // Quick action buttons
        document.querySelectorAll('button[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e));
        });

        // Refresh button
        document.getElementById('refreshData').addEventListener('click', () => this.refreshData());

        // Users management
        document.getElementById('userSearch').addEventListener('input', (e) => this.handleUserSearch(e));
        document.getElementById('usersPerPage').addEventListener('change', (e) => this.handleUsersPerPage(e));
        document.getElementById('prevUsersPage').addEventListener('click', () => this.prevUsersPage());
        document.getElementById('nextUsersPage').addEventListener('click', () => this.nextUsersPage());

        // Transactions management
        document.getElementById('transactionTypeFilter').addEventListener('change', (e) => this.handleTransactionFilter(e));
        document.getElementById('transactionStatusFilter').addEventListener('change', (e) => this.handleTransactionFilter(e));

        // Chart period
        document.getElementById('chartPeriod').addEventListener('change', () => this.loadDashboard());

        // Statistics period
        document.getElementById('statisticsPeriod').addEventListener('change', () => this.loadStatistics());
    }

    switchView(e) {
        e.preventDefault();
        const view = e.target.getAttribute('data-view') || e.target.closest('[data-view]').getAttribute('data-view');
        
        // Update navigation
        document.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');
        
        // Hide all views
        document.querySelectorAll('.admin-view').forEach(view => view.style.display = 'none');
        
        // Show selected view
        document.getElementById(`${view}View`).style.display = 'block';
        
        // Update title
        const titles = {
            dashboard: 'Admin Dashboard',
            users: 'User Management',
            transactions: 'Transaction Management',
            machines: 'Machine Management',
            settings: 'System Settings',
            statistics: 'Platform Statistics'
        };
        document.getElementById('currentViewTitle').innerHTML = 
            `<i class="fas fa-${this.getViewIcon(view)} me-2 text-primary"></i>${titles[view]}`;
        
        this.currentView = view;
        
        // Load view data
        this.loadViewData(view);
    }

    getViewIcon(view) {
        const icons = {
            dashboard: 'tachometer-alt',
            users: 'users',
            transactions: 'exchange-alt',
            machines: 'server',
            settings: 'cog',
            statistics: 'chart-bar'
        };
        return icons[view];
    }

    loadViewData(view) {
        switch(view) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'transactions':
                this.loadTransactions();
                break;
            case 'machines':
                this.loadMachines();
                break;
            case 'settings':
                this.loadSettings();
                break;
            case 'statistics':
                this.loadStatistics();
                break;
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (!response.ok) throw new Error('Failed to load dashboard');
            
            const result = await response.json();
            
            if (result.success) {
                this.updateDashboardStats(result.stats);
                this.createActivityChart();
            }
        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('totalUsers').textContent = stats.total_users?.toLocaleString() || '0';
        document.getElementById('activeMining').textContent = stats.active_mining?.toLocaleString() || '0';
        document.getElementById('totalBalance').textContent = stats.total_balance?.toFixed(2) || '0';
        document.getElementById('todayTransactions').textContent = stats.today_transactions?.toLocaleString() || '0';
        document.getElementById('newUsersToday').textContent = stats.new_users_today?.toLocaleString() || '0';
        document.getElementById('totalWithdrawals').textContent = stats.total_withdrawals?.toFixed(2) + ' TRX' || '0 TRX';
    }

    createActivityChart() {
        const ctx = document.getElementById('activityChart').getContext('2d');
        if (window.activityChart) {
            window.activityChart.destroy();
        }
        window.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'User Activity',
                    data: [65, 59, 80, 81, 56, 55, 40],
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    async loadUsers() {
        try {
            const response = await fetch(`/api/admin/users?page=${this.usersPage}&limit=${this.usersLimit}&search=${this.usersSearch}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (!response.ok) throw new Error('Failed to load users');
            
            const result = await response.json();
            
            if (result.success) {
                this.renderUsers(result.users, result.pagination);
            }
        } catch (error) {
            console.error('Users load error:', error);
            this.showUsersError();
        }
    }

    renderUsers(users, pagination) {
        const tbody = document.getElementById('usersList');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center text-muted py-4">
                        <i class="fas fa-users fa-2x mb-3"></i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td><small class="text-muted">${user.user_id || user._id}</small></td>
                <td>
                    <strong>${user.username}</strong>
                    ${user.tg_verified ? '<i class="fas fa-check-circle text-success ms-1" title="Telegram Verified"></i>' : ''}
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="vip-badge">VIP ${user.vip_level || 0}</span>
                </td>
                <td class="balance-positive">
                    <strong>${(user.available_balance || 0).toFixed(2)} TRX</strong>
                </td>
                <td>${user.active_miners || 0}</td>
                <td><small>${new Date(user.created_at).toLocaleDateString()}</small></td>
                <td>
                    <span class="user-status-${user.status}">
                        <i class="fas fa-circle me-1"></i>${user.status}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary action-btn" onclick="admin.viewUser('${user.user_id || user._id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning action-btn" onclick="admin.editUser('${user.user_id || user._id}')" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info action-btn" onclick="admin.manageBalance('${user.user_id || user._id}')" title="Manage Balance">
                        <i class="fas fa-coins"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.updateUsersPagination(pagination);
    }

    // ... Diğer metodlar aynı kalacak, sadece login kısmı kaldırıldı

    showError(message) {
        Swal.fire('Error', message, 'error');
    }

    showSuccess(message) {
        Swal.fire('Success', message, 'success');
    }

    exportData() {
        this.showSuccess('Export feature will be implemented soon!');
    }

    addUser() {
        this.showSuccess('Add user feature will be implemented soon!');
    }

    viewUser(userId) {
        this.showSuccess(`View user ${userId} details - Feature coming soon!`);
    }

    editUser(userId) {
        this.showSuccess(`Edit user ${userId} - Feature coming soon!`);
    }

    manageBalance(userId) {
        this.showSuccess(`Manage balance for user ${userId} - Feature coming soon!`);
    }

    refreshData() {
        this.loadViewData(this.currentView);
        Swal.fire({
            title: 'Refreshing...',
            timer: 1000,
            timerProgressBar: true,
            didOpen: () => Swal.showLoading()
        });
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminPanel();
});