class ProfileManager {
    constructor() {
        this.userData = null;
        this.referrals = [];
        this.vipLevels = [];
        this.telegramStatus = null;
        this.initializeEventListeners();
        this.loadProfileData();
        this.loadTelegramStatus();
    }

    initializeEventListeners() {
        try {
            // Navigation
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }

            // Profile form
            const profileForm = document.getElementById('profileForm');
            if (profileForm) {
                profileForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.updateProfile();
                });
            }

            // Change payment password
            const changePayPasswordForm = document.getElementById('changePayPasswordForm');
            if (changePayPasswordForm) {
                changePayPasswordForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.changePayPassword();
                });
            }

            // Copy referral link
            const copyRefLink = document.getElementById('copyRefLink');
            if (copyRefLink) {
                copyRefLink.addEventListener('click', () => {
                    this.copyReferralLink();
                });
            }

            // Tab switching
            const tabTriggers = document.querySelectorAll('[data-bs-toggle="tab"]');
            tabTriggers.forEach(tab => {
                tab.addEventListener('show.bs.tab', (e) => {
                    this.handleTabChange(e.target.getAttribute('id'));
                });
            });

            // Refresh referrals
            const refreshReferrals = document.getElementById('refreshReferrals');
            if (refreshReferrals) {
                refreshReferrals.addEventListener('click', () => {
                    this.loadReferrals(true);
                });
            }

            // Telegram doğrulama butonları
            const requestTelegramBtn = document.getElementById('requestTelegramVerification');
            const verifyTelegramBtn = document.getElementById('verifyTelegramBtn');
            
            if (requestTelegramBtn) {
                requestTelegramBtn.addEventListener('click', () => this.requestTelegramVerification());
            }
            
            if (verifyTelegramBtn) {
                verifyTelegramBtn.addEventListener('click', () => this.verifyTelegramCode());
            }

            console.log('✅ Profile event listeners initialized');

        } catch (error) {
            console.error('❌ Event listeners error:', error);
        }
    }

    async loadProfileData() {
        try {
            console.log('🔄 Loading profile data...');
            await Promise.all([
                this.loadUserProfile(),
                this.loadReferrals(),
                this.loadVipInfo()
            ]);
        } catch (error) {
            console.error('❌ Profile data load error:', error);
            this.showError('Failed to load profile data');
        }
    }

    async loadTelegramStatus() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/telegram-status', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.telegramStatus = data.telegram;
                    this.updateTelegramUI();
                }
            }
        } catch (error) {
            console.error('Telegram status load error:', error);
        }
    }

    updateTelegramUI() {
        const telegramSection = document.getElementById('telegramVerificationSection');
        const telegramStatus = document.getElementById('telegramVerificationStatus');
        
        if (!this.telegramStatus) return;

        if (this.telegramStatus.verified) {
            // Zaten doğrulanmışsa
            if (telegramSection) telegramSection.style.display = 'none';
            if (telegramStatus) {
                telegramStatus.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fab fa-telegram me-2"></i>
                        <strong>Telegram Verified</strong>
                        <div class="mt-1">
                            <small>Username: @${this.telegramStatus.username}</small>
                        </div>
                    </div>
                `;
                telegramStatus.style.display = 'block';
            }
        } else {
            // Doğrulanmamışsa
            if (telegramSection) telegramSection.style.display = 'block';
            if (telegramStatus) telegramStatus.style.display = 'none';
            
            // Telegram username input'unu doldur
            const telegramInput = document.getElementById('profileTelegram');
            if (telegramInput && this.telegramStatus.username) {
                telegramInput.value = this.telegramStatus.username;
            }
        }
    }

    async requestTelegramVerification() {
        const telegramUsername = document.getElementById('profileTelegram')?.value || '';
        
        if (!telegramUsername) {
            this.showError('Please enter your Telegram username');
            return;
        }

        const cleanUsername = telegramUsername.replace('@', '');

        try {
            const button = document.getElementById('requestTelegramVerification');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Sending...';
            button.disabled = true;

            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/request-telegram-verification', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ telegram_username: cleanUsername })
            });

            const data = await response.json();

            if (data.success) {
                if (data.message.includes('sent to your Telegram')) {
                    this.showSuccess('Verification code sent to your Telegram!');
                    
                    // Doğrulama kodu input'unu göster
                    document.getElementById('telegramCodeSection').style.display = 'block';
                    document.getElementById('verifyTelegramBtn').style.display = 'block';
                } else {
                    // Simulated mode - kodu göster
                    Swal.fire({
                        icon: 'info',
                        title: 'Your Verification Code',
                        html: `
                            <div class="text-center">
                                <i class="fas fa-key fa-3x text-warning mb-3"></i>
                                <h5>Telegram Bot is in Simulated Mode</h5>
                                <div class="alert alert-warning">
                                    <h2 class="text-danger mb-2">${data.code}</h2>
                                    <small>Enter this 6-digit code in the verification field below</small>
                                </div>
                                <p class="text-muted small">
                                    <i class="fas fa-exclamation-triangle me-1"></i>
                                    In production, this code would be sent automatically to your Telegram.
                                </p>
                            </div>
                        `,
                        confirmButtonText: 'Copy Code'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            navigator.clipboard.writeText(data.code);
                            document.getElementById('telegramVerificationCode').value = data.code;
                        }
                    });
                    
                    document.getElementById('telegramCodeSection').style.display = 'block';
                    document.getElementById('verifyTelegramBtn').style.display = 'block';
                }
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Telegram verification request error:', error);
            this.showError('Failed to send verification code');
        } finally {
            const button = document.getElementById('requestTelegramVerification');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async verifyTelegramCode() {
        const verificationCode = document.getElementById('telegramVerificationCode')?.value || '';
        
        if (!verificationCode) {
            this.showError('Please enter the verification code');
            return;
        }

        if (verificationCode.length !== 6) {
            this.showError('Verification code must be 6 digits');
            return;
        }

        try {
            const button = document.getElementById('verifyTelegramBtn');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Verifying...';
            button.disabled = true;

            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/verify-telegram', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ verification_code: verificationCode })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess(data.message);
                
                // UI'ı güncelle
                document.getElementById('telegramVerificationSection').style.display = 'none';
                document.getElementById('telegramVerificationStatus').style.display = 'block';
                
                // Sayfayı yenile
                await this.loadTelegramStatus();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('Telegram verification error:', error);
            this.showError('Failed to verify code');
        } finally {
            const button = document.getElementById('verifyTelegramBtn');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async loadVipInfo() {
        try {
            console.log('🔄 Loading VIP info...');
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/vip-info', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📦 VIP info data:', data);
                
                if (data.success) {
                    this.vipLevels = data.vip_levels;
                    this.updateVIPUI();
                } else {
                    console.error('❌ VIP info error:', data.message);
                }
            } else {
                console.error('❌ VIP info fetch failed:', response.status);
            }
        } catch (error) {
            console.error('❌ VIP info load error:', error);
        }
    }

    updateVIPUI() {
        const container = document.getElementById('vipLevels');
        if (!container) {
            console.error('❌ VIP levels container not found');
            return;
        }

        if (!this.vipLevels.length) {
            container.innerHTML = `
                <div class="col-12 text-center text-muted py-4">
                    <div class="loading-spinner mb-2"></div>
                    <p>Loading VIP levels...</p>
                </div>
            `;
            return;
        }

        console.log('🔄 Updating VIP UI with levels:', this.vipLevels);

        container.innerHTML = this.vipLevels.map(level => {
            const isCurrent = level.is_current;
            const canUpgrade = level.can_upgrade;
            const currentVipLevel = this.userData?.user?.vip_level || 0;
            const hasUpgraded = level.level < currentVipLevel;

            console.log(`VIP Level ${level.level}:`, {
                isCurrent,
                canUpgrade,
                currentVipLevel,
                hasUpgraded,
                price: level.price,
                availableBalance: this.userData?.finance?.available_balance
            });

            return `
                <div class="col-md-4 mb-4">
                    <div class="card vip-level-card ${isCurrent ? 'current-vip border-primary' : ''} h-100">
                        <div class="card-header text-center ${this.getVIPColorClass(level.level)}">
                            <h5 class="card-title mb-0 text-white">${level.name}</h5>
                            ${isCurrent ? '<span class="badge bg-light text-dark">Current</span>' : ''}
                        </div>
                        <div class="card-body">
                            <div class="text-center mb-3">
                                <h3 class="${level.price > 0 ? 'text-success' : 'text-muted'}">
                                    ${level.price > 0 ? `${level.price} TRX` : 'FREE'}
                                </h3>
                                ${level.level > currentVipLevel && !canUpgrade ? `
                                    <small class="text-danger">
                                        Need ${this.formatBalance(level.price - (this.userData?.finance?.available_balance || 0))} more TRX
                                    </small>
                                ` : ''}
                            </div>
                            
                            <div class="mb-3">
                                <small class="text-muted d-block">Withdrawal Fee: ${level.withdrawal_fee}%</small>
                                <small class="text-muted d-block">Min Withdrawal: ${level.min_withdrawal} TRX</small>
                                <small class="text-muted d-block">Referral Bonus: ${level.referral_bonus}%</small>
                            </div>

                            <ul class="list-unstyled small">
                                ${level.features.map(feature => `
                                    <li class="mb-1">
                                        <i class="fas fa-check text-success me-1"></i>
                                        ${feature.trim()}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="card-footer text-center">
                            ${isCurrent ? `
                                <span class="badge bg-success">Current Plan</span>
                            ` : hasUpgraded ? `
                                <span class="badge bg-secondary">Already Upgraded</span>
                            ` : canUpgrade ? `
                                <button class="btn btn-primary btn-sm upgrade-vip-btn" 
                                        data-vip-level="${level.level}"
                                        data-vip-name="${level.name}"
                                        data-vip-price="${level.price}">
                                    Upgrade to ${level.name}
                                </button>
                            ` : level.level > currentVipLevel ? `
                                <button class="btn btn-secondary btn-sm" disabled>
                                    Insufficient Balance
                                </button>
                            ` : `
                                <span class="badge bg-warning">Requires Previous Tier</span>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add upgrade event listeners
        this.attachVipUpgradeListeners();
        
        // Update VIP status cards
        this.updateVipStatusCards();
        
        console.log('✅ VIP UI updated successfully');
    }

    attachVipUpgradeListeners() {
        // Mevcut butonları temizle
        document.querySelectorAll('.upgrade-vip-btn').forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        // Yeni event listener'ları ekle
        document.querySelectorAll('.upgrade-vip-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const vipLevel = parseInt(e.target.getAttribute('data-vip-level'));
                const vipName = e.target.getAttribute('data-vip-name');
                const vipPrice = parseFloat(e.target.getAttribute('data-vip-price'));
                
                console.log('🔄 VIP upgrade button clicked:', { vipLevel, vipName, vipPrice });
                this.showVIPUpgradeModal(vipLevel, vipName, vipPrice);
            });
        });

        console.log(`✅ Attached upgrade listeners to ${document.querySelectorAll('.upgrade-vip-btn').length} buttons`);
    }

    async showVIPUpgradeModal(vipLevel, vipName, vipPrice) {
        console.log('🔄 Showing VIP upgrade modal:', { vipLevel, vipName, vipPrice });

        const availableBalance = this.userData?.finance?.available_balance || 0;
        const level = this.vipLevels.find(l => l.level === vipLevel);

        if (!level) {
            this.showError('VIP level not found');
            return;
        }

        const result = await Swal.fire({
            title: `Upgrade to ${vipName}?`,
            html: `
                <div class="text-start">
                    <p><strong>Upgrade Cost:</strong> <span class="text-success">${vipPrice} TRX</span></p>
                    <p><strong>Your Balance:</strong> ${this.formatBalance(availableBalance)} TRX</p>
                    
                    ${availableBalance < vipPrice ? 
                        '<p class="text-danger"><strong>Insufficient balance!</strong> You need ' + 
                        this.formatBalance(vipPrice - availableBalance) + ' more TRX</p>' : 
                        '<p class="text-success"><strong>Sufficient balance ✓</strong></p>'
                    }
                    
                    <div class="mt-3">
                        <strong>New Benefits:</strong>
                        <ul class="small mt-2">
                            ${level.features.map(feature => `
                                <li>${feature.trim()}</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
            `,
            icon: availableBalance < vipPrice ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: `Upgrade to ${vipName} (${vipPrice} TRX)`,
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            preConfirm: async () => {
                try {
                    console.log('🔄 Processing VIP upgrade...');
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/user/upgrade-vip', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ vip_level: vipLevel })
                    });

                    const data = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(data.message || 'Upgrade failed');
                    }
                    
                    return data;
                } catch (error) {
                    Swal.showValidationMessage(`Upgrade failed: ${error.message}`);
                    return false;
                }
            }
        });

        if (result.isConfirmed && result.value) {
            this.showSuccess(result.value.message || `Successfully upgraded to ${vipName}!`);
            
            // Sayfayı yenile
            await this.loadProfileData();
        } else if (result.isDismissed) {
            console.log('VIP upgrade cancelled by user');
        }
    }

    updateVipStatusCards() {
        const currentVipLevel = document.getElementById('currentVipLevel');
        const vipAvailableBalance = document.getElementById('vipAvailableBalance');
        
        if (currentVipLevel) {
            const currentLevel = this.vipLevels.find(level => level.is_current);
            currentVipLevel.textContent = currentLevel ? currentLevel.name : 'Bronze';
        }
        
        if (vipAvailableBalance) {
            vipAvailableBalance.textContent = this.formatBalance(this.userData?.finance?.available_balance || 0) + ' TRX';
        }
    }

    getVIPColorClass(level) {
        const colors = {
            0: 'bg-secondary',
            1: 'bg-silver', 
            2: 'bg-warning'
        };
        return colors[level] || 'bg-secondary';
    }

    async loadUserProfile() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.showError('No authentication token found. Please login again.');
                window.location.href = '/login';
                return;
            }

            console.log('🔄 Fetching user profile...');
            const response = await fetch('/api/user/profile', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📱 Profile response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Profile data received:', data);
                
                if (data.success) {
                    this.userData = data;
                    console.log('💰 Finance data available:', {
                        available_balance: data.finance?.available_balance,
                        total_balance: data.finance?.total_balance,
                        total_earned: data.finance?.total_earned
                    });
                    this.updateProfileUI();
                    
                    // Balance'ı sidebar'da da güncelle
                    this.updateSidebarBalance(data.finance?.available_balance);
                } else {
                    this.showError(data.message || 'Failed to load profile');
                }
            } else {
                if (response.status === 401) {
                    this.showError('Session expired. Please login again.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                    return;
                }
                const errorText = await response.text();
                console.error('❌ Profile fetch error:', errorText);
                this.showError('Failed to load profile information');
            }
        } catch (error) {
            console.error('❌ Profile load error:', error);
            this.showError('Failed to load profile information');
        }
    }

    updateSidebarBalance(balance) {
        const availableBalance = document.getElementById('availableBalance');
        if (availableBalance) {
            const formattedBalance = this.formatBalance(parseFloat(balance) || 0);
            availableBalance.textContent = formattedBalance + ' TRX';
            console.log('✅ Sidebar balance updated:', formattedBalance);
        }
    }

    updateProfileUI() {
        if (!this.userData) {
            console.error('❌ No user data available');
            return;
        }

        const { user, finance } = this.userData;

        console.log('🔄 Updating profile UI with:', { 
            user: user.username,
            finance: {
                available_balance: finance?.available_balance,
                total_balance: finance?.total_balance,
                total_earned: finance?.total_earned
            }
        });

        try {
            // Basic info
            const profileUsername = document.getElementById('profileUsername');
            const profileEmail = document.getElementById('profileEmail');
            
            if (profileUsername) profileUsername.value = user.username || '';
            if (profileEmail) profileEmail.value = user.email || '';

            // Statistics
            const memberSince = document.getElementById('memberSince');
            const totalEarned = document.getElementById('totalEarned');
            const activeMiners = document.getElementById('activeMiners');
            const totalReferrals = document.getElementById('totalReferrals');
            
            if (memberSince) {
                memberSince.textContent = user.created_at ? 
                    new Date(user.created_at).toLocaleDateString() : 'N/A';
            }
            
            // Finance verilerini kullan
            if (totalEarned) {
                totalEarned.textContent = this.formatBalance(finance?.total_earned || 0) + ' TRX';
            }
            
            // Mining verisi yoksa 0 göster
            if (activeMiners) {
                activeMiners.textContent = '0';
            }
            
            if (totalReferrals) {
                totalReferrals.textContent = this.referrals.length;
            }

            // Statistics card - Finance verilerini kullan
            const totalEarnedStat = document.getElementById('totalEarnedStat');
            if (totalEarnedStat) {
                totalEarnedStat.textContent = this.formatBalance(finance?.total_earned || 0) + ' TRX';
            }

            // Balance card
            const availableBalanceCard = document.getElementById('availableBalanceCard');
            if (availableBalanceCard) {
                availableBalanceCard.textContent = this.formatBalance(finance?.available_balance || 0) + ' TRX';
            }

            // Total balance card
            const totalBalanceCard = document.getElementById('totalBalanceCard');
            if (totalBalanceCard) {
                totalBalanceCard.textContent = this.formatBalance(finance?.total_balance || 0) + ' TRX';
            }

            // Referral info
            const refCode = document.getElementById('refCode');
            const refLink = document.getElementById('refLink');
            
            if (refCode) refCode.value = user.ref_code || 'N/A';
            if (refLink) {
                refLink.value = `${window.location.origin}/?ref=${user.ref_code || ''}`;
            }

            // Update VIP badge
            this.updateVIPBadge(user.vip_level || 0);

            console.log('✅ Profile UI updated successfully');

        } catch (error) {
            console.error('❌ UI update error:', error);
        }
    }

    async loadReferrals(showRefresh = false) {
        try {
            if (showRefresh) {
                this.showLoading('referralsList', 'Refreshing referrals...');
            }

            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/referrals', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Referrals data:', data);
                
                if (data.success) {
                    this.referrals = data.referrals || [];
                    this.updateReferralsUI(data);
                    
                    if (showRefresh) {
                        this.showSuccess('Referrals updated');
                    }
                } else {
                    this.showError(data.message || 'Failed to load referrals');
                }
            } else {
                this.showError('Failed to load referrals');
            }
        } catch (error) {
            console.error('❌ Referrals load error:', error);
            if (showRefresh) {
                this.showError('Failed to refresh referrals');
            }
        }
    }

    updateReferralsUI(data) {
        const { referrals, total_earned } = data;
        const container = document.getElementById('referralsList');

        if (!container) return;

        // Update referral stats
        const totalReferralEarnings = document.getElementById('totalReferralEarnings');
        const activeReferrals = document.getElementById('activeReferrals');
        
        if (totalReferralEarnings) {
            totalReferralEarnings.textContent = this.formatBalance(total_earned) + ' TRX';
        }
        if (activeReferrals) {
            activeReferrals.textContent = referrals?.length || 0;
        }

        if (!referrals || referrals.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="fas fa-users fa-3x mb-3"></i>
                    <h5>No Referrals Yet</h5>
                    <p class="mb-3">Share your referral link to start earning</p>
                    <div class="alert alert-info">
                        <strong>Referral Bonus:</strong> Earn 5% of your referrals' mining earnings!
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Join Date</th>
                            <th>Earned</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${referrals.map(ref => `
                            <tr>
                                <td>
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-user-circle text-primary me-2"></i>
                                        ${ref.username}
                                    </div>
                                </td>
                                <td>${new Date(ref.created_at).toLocaleDateString()}</td>
                                <td class="text-success">${this.formatBalance(ref.earned_amount)} TRX</td>
                                <td>
                                    <span class="badge bg-success">Active</span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    updateVIPBadge(vipLevel) {
        const badges = [
            { class: 'bg-secondary', text: 'Bronze Member' },
            { class: 'bg-silver', text: 'Silver Member' },
            { class: 'bg-warning', text: 'Gold Member' }
        ];

        const badge = badges[vipLevel] || badges[0];
        const vipBadgeElement = document.getElementById('vipBadge');
        if (vipBadgeElement) {
            vipBadgeElement.innerHTML = `
                <span class="badge ${badge.class}">
                    <i class="fas fa-crown me-1"></i>${badge.text}
                </span>
            `;
        }

        // Update sidebar VIP level
        const userVIPLevel = document.getElementById('userVIPLevel');
        if (userVIPLevel) {
            const vipNames = ['Bronze', 'Silver', 'Gold'];
            userVIPLevel.textContent = vipNames[vipLevel] || 'Bronze';
        }
    }

    async updateProfile() {
        const formData = {
            username: document.getElementById('profileUsername')?.value || '',
            email: document.getElementById('profileEmail')?.value || ''
        };

        if (!formData.username || !formData.email) {
            this.showError('Username and email are required');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Profile updated successfully!');
                // Update stored user data
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                user.username = formData.username;
                user.email = formData.email;
                localStorage.setItem('user', JSON.stringify(user));
                
                await this.loadUserProfile();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('❌ Profile update error:', error);
            this.showError('Failed to update profile');
        }
    }

    async changePayPassword() {
        const currentPassword = document.getElementById('currentPayPassword')?.value || '';
        const newPassword = document.getElementById('newPayPassword')?.value || '';
        const confirmPassword = document.getElementById('confirmPayPassword')?.value || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showError('Please fill all password fields');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError('New passwords do not match');
            return;
        }

        if (newPassword.length < 4 || newPassword.length > 6) {
            this.showError('Payment password must be 4-6 digits');
            return;
        }

        if (!/^\d+$/.test(newPassword)) {
            this.showError('Payment password must contain only numbers');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/user/change-pay-password', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Payment password updated successfully!');
                document.getElementById('changePayPasswordForm').reset();
            } else {
                this.showError(data.message);
            }
        } catch (error) {
            console.error('❌ Pay password change error:', error);
            this.showError('Failed to change payment password');
        }
    }

    copyReferralLink() {
        const refLink = document.getElementById('refLink');
        if (!refLink) return;

        refLink.select();
        refLink.setSelectionRange(0, 99999);

        navigator.clipboard.writeText(refLink.value).then(() => {
            this.showSuccess('Referral link copied to clipboard!');
        }).catch(err => {
            console.error('❌ Copy failed:', err);
            // Fallback for older browsers
            try {
                refLink.select();
                document.execCommand('copy');
                this.showSuccess('Referral link copied to clipboard!');
            } catch (fallbackError) {
                this.showError('Failed to copy referral link');
            }
        });
    }

    handleTabChange(tabId) {
        console.log('🔄 Tab changed:', tabId);
        // Load specific tab data if needed
        switch (tabId) {
            case 'profile-tab':
                this.loadUserProfile();
                break;
            case 'referrals-tab':
                this.loadReferrals();
                break;
            case 'security-tab':
                // Security tab specific actions
                break;
            case 'vip-tab':
                this.loadVipInfo();
                break;
        }
    }

    formatBalance(amount) {
        return parseFloat(amount || 0).toFixed(6);
    }

    showLoading(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary mb-2"></div>
                    <p class="text-muted">${message}</p>
                </div>
            `;
        }
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
            confirmButtonText: 'Yes, logout!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/';
            }
        });
    }
}

// Initialize profile manager
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing ProfileManager...');
    new ProfileManager();
});