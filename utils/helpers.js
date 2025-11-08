class Helpers {
    static formatNumber(num, decimals = 6) {
        if (isNaN(num) || num === null || num === undefined) {
            return '0'.padEnd(decimals + 2, '0');
        }
        return parseFloat(num).toFixed(decimals);
    }

    static formatCurrency(amount, currency = 'TRX') {
        return `${this.formatNumber(amount)} ${currency}`;
    }

    static formatHashrate(hashrate) {
        if (hashrate >= 1000000) {
            return (hashrate / 1000000).toFixed(2) + ' MH/s';
        } else if (hashrate >= 1000) {
            return (hashrate / 1000).toFixed(2) + ' KH/s';
        } else {
            return this.formatNumber(hashrate) + ' H/s';
        }
    }

    static formatPercentage(value, decimals = 2) {
        return `${this.formatNumber(value * 100, decimals)}%`;
    }

    static generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static generateRefCode() {
        return 'REF' + Date.now().toString().slice(-6) + this.generateId(3).toUpperCase();
    }

    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static validateUsername(username) {
        const re = /^[a-zA-Z0-9_]{3,20}$/;
        return re.test(username);
    }

    static validatePassword(password) {
        return password && password.length >= 6;
    }

    static validatePayPassword(password) {
        const re = /^\d{4,6}$/;
        return re.test(password);
    }

    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    static truncateString(str, maxLength = 50) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    }

    static formatDate(date, includeTime = true) {
        if (!date) return 'N/A';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';
        
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return d.toLocaleDateString('en-US', options);
    }

    static formatRelativeTime(date) {
        if (!date) return 'N/A';
        
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} hr ago`;
        if (diffDays < 7) return `${diffDays} day ago`;
        
        return this.formatDate(date, false);
    }

    static calculateProgress(current, total) {
        if (total <= 0) return 0;
        return Math.min(100, Math.max(0, (current / total) * 100));
    }

    static debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    static getRandomColor() {
        const colors = [
            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#d35400', '#c0392b', '#16a085'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    static isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    static getBrowserInfo() {
        const ua = navigator.userAgent;
        let browserName;
        let browserVersion;

        if (ua.includes('Chrome')) {
            browserName = 'Chrome';
            browserVersion = ua.match(/Chrome\/([0-9.]+)/)?.[1];
        } else if (ua.includes('Firefox')) {
            browserName = 'Firefox';
            browserVersion = ua.match(/Firefox\/([0-9.]+)/)?.[1];
        } else if (ua.includes('Safari')) {
            browserName = 'Safari';
            browserVersion = ua.match(/Version\/([0-9.]+)/)?.[1];
        } else if (ua.includes('Edge')) {
            browserName = 'Edge';
            browserVersion = ua.match(/Edge\/([0-9.]+)/)?.[1];
        } else {
            browserName = 'Unknown';
            browserVersion = 'Unknown';
        }

        return {
            name: browserName,
            version: browserVersion,
            userAgent: ua,
            isMobile: this.isMobileDevice()
        };
    }

    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateGradient(color1, color2) {
        return `linear-gradient(135deg, ${color1}, ${color2})`;
    }

    static calculateAge(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }
}

module.exports = Helpers;