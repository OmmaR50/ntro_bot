class AuthManager {
    constructor() {
        this.isLogin = true;
        this.initializeEventListeners();
        this.checkExistingToken();
        this.checkBotStatus();
    }

    initializeEventListeners() {
        document.querySelectorAll('.btn-swap').forEach(btn => {
            btn.addEventListener('click', () => this.swapForms());
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        
        // Payment password sadece rakam girişi
        document.getElementById('regPayPassword').addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });

        console.log('✅ Auth event listeners initialized');
    }

    async checkBotStatus() {
        try {
            const response = await fetch('/api/auth/telegram-bot-status');
            const result = await response.json();
            
            if (result.success) {
                const status = result.bot_status;
                this.updateBotStatusUI(status);
            }
        } catch (error) {
            console.error('Bot status check error:', error);
        }
    }

    updateBotStatusUI(status) {
        const statusElement = document.getElementById('botStatus');
        if (statusElement) {
            if (status.active) {
                statusElement.innerHTML = `
                    <div class="alert alert-success py-2">
                        <i class="fab fa-telegram me-2"></i>
                        <strong>Telegram Bot Active</strong>
                        <small class="d-block">You can verify Telegram in your profile</small>
                    </div>
                `;
            } else {
                statusElement.innerHTML = `
                    <div class="alert alert-warning py-2">
                        <i class="fab fa-telegram me-2"></i>
                        <strong>Telegram Bot: Simulated Mode</strong>
                        <small class="d-block">Telegram verification available in profile</small>
                    </div>
                `;
            }
        }
    }

    checkExistingToken() {
        const token = localStorage.getItem('token');
        if (token) {
            window.location.href = '/dashboard';
        }
    }

    swapForms() {
        this.isLogin = !this.isLogin;
        
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const welcomeTitle = document.querySelector('.welcome-title');
        const swapBtn = document.querySelector('.btn-swap');

        if (this.isLogin) {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            welcomeTitle.textContent = 'Welcome Back!';
            swapBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i>Register Now';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            welcomeTitle.textContent = 'Create Account';
            swapBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Login';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = {
            username: document.getElementById('loginUsername').value,
            password: document.getElementById('loginPassword').value
        };

        if (!formData.username || !formData.password) {
            Swal.fire('Error!', 'Please fill all fields', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Login successful!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = '/dashboard';
                });
            } else {
                Swal.fire('Error!', result.message, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            Swal.fire('Error!', 'Network error occurred', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = {
            username: document.getElementById('regUsername').value,
            email: document.getElementById('regEmail').value,
            password: document.getElementById('regPassword').value,
            pay_password: document.getElementById('regPayPassword').value,
            ref_code: document.getElementById('regRefCode').value
        };

        // Validation
        if (!formData.username || !formData.email || !formData.password || !formData.pay_password) {
            Swal.fire('Error!', 'Please fill all required fields', 'error');
            return;
        }

        if (formData.username.length < 3 || formData.username.length > 20) {
            Swal.fire('Error!', 'Username must be 3-20 characters', 'error');
            return;
        }

        if (formData.pay_password.length < 4 || formData.pay_password.length > 6) {
            Swal.fire('Error!', 'Payment password must be 4-6 digits', 'error');
            return;
        }

        if (!document.getElementById('acceptTerms').checked) {
            Swal.fire('Error!', 'Please accept the terms and conditions', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                localStorage.setItem('token', result.token);
                localStorage.setItem('user', JSON.stringify(result.user));
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    text: 'Registration successful!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = '/dashboard';
                });
            } else {
                Swal.fire('Error!', result.message, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            Swal.fire('Error!', 'Network error occurred', 'error');
        }
    }
}

// Initialize auth manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});