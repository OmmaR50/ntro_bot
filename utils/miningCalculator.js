class MiningCalculator {
    static calculateDailyEarning(hashrate) {
        const baseRate = 0.001;
        const dailyEarning = (parseFloat(hashrate) / 100) * baseRate;
        return parseFloat(dailyEarning.toFixed(6));
    }

    static calculateHourlyEarning(hashrate) {
        const dailyEarning = this.calculateDailyEarning(hashrate);
        return parseFloat((dailyEarning / 24).toFixed(6));
    }

    static calculateMonthlyEarning(hashrate) {
        const dailyEarning = this.calculateDailyEarning(hashrate);
        return parseFloat((dailyEarning * 30).toFixed(6));
    }

    static calculateROI(purchasePrice, hashrate) {
        const dailyEarning = this.calculateDailyEarning(hashrate);
        if (dailyEarning <= 0) return Infinity;
        return Math.ceil(parseFloat(purchasePrice) / dailyEarning);
    }

    static calculateTotalEarning(hashrate, hours) {
        const hourlyEarning = this.calculateHourlyEarning(hashrate);
        return parseFloat((hourlyEarning * hours).toFixed(6));
    }

    static calculateNetworkDifficulty() {
        return 1 + Math.random() * 0.5;
    }

    static calculateMaintenanceCost(powerConsumption, hours = 24) {
        const electricityRate = 0.05;
        return parseFloat((powerConsumption * electricityRate * hours / 1000).toFixed(6));
    }

    static calculateNetProfit(hashrate, powerConsumption, hours = 24) {
        const grossEarning = this.calculateTotalEarning(hashrate, hours);
        const maintenanceCost = this.calculateMaintenanceCost(powerConsumption, hours);
        return parseFloat((grossEarning - maintenanceCost).toFixed(6));
    }
}

module.exports = MiningCalculator;