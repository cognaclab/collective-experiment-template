'use strict';

/**
 * PaymentCalculator
 *
 * Centralized payment calculation logic for experiments.
 * Handles conversion from points to currency, applies fees and bonuses,
 * and provides consistent payment calculations across client and server.
 */
class PaymentCalculator {
    /**
     * Create a PaymentCalculator instance
     * @param {Object} config - Payment configuration
     * @param {number} config.flat_fee - Base payment for participation (in currency units)
     * @param {number} config.completion_fee - Bonus for completing experiment (in currency units)
     * @param {number} config.points_to_currency - Conversion rate from points to currency
     * @param {string} config.currency - Currency code (e.g., 'GBP', 'USD')
     * @param {string} config.currencySymbol - Currency symbol (e.g., '£', '$')
     * @param {number} config.precision - Decimal places for currency (default: 2)
     * @param {number} config.minPayment - Minimum payment guarantee (default: 0)
     * @param {number} config.maxPayment - Maximum payment cap (default: null, no cap)
     */
    constructor(config = {}) {
        this.flatFee = config.flat_fee || 0;
        this.completionFee = config.completion_fee || 0;
        this.pointsToCurrency = config.points_to_currency || 0.0006; // Default: 6p per 100 points
        this.currency = config.currency || 'GBP';
        this.currencySymbol = config.currencySymbol || this.getCurrencySymbol(this.currency);
        this.precision = config.precision !== undefined ? config.precision : 2;
        this.minPayment = config.minPayment !== undefined ? config.minPayment : 0;
        this.maxPayment = config.maxPayment || null;
    }

    /**
     * Get currency symbol for common currencies
     * @param {string} currency - Currency code
     * @returns {string} Currency symbol
     */
    getCurrencySymbol(currency) {
        const symbols = {
            'GBP': '£',
            'USD': '$',
            'EUR': '€',
            'JPY': '¥'
        };
        return symbols[currency] || currency;
    }

    /**
     * Convert points to currency
     * @param {number} points - Number of points earned
     * @returns {number} Currency amount
     */
    pointsToAmount(points) {
        if (typeof points !== 'number' || isNaN(points)) {
            points = 0;
        }
        return points * this.pointsToCurrency;
    }

    /**
     * Calculate payment for a single trial
     * @param {number} points - Points earned in the trial
     * @returns {Object} Payment breakdown
     */
    calculateTrialPayment(points) {
        const amount = this.pointsToAmount(points);
        return {
            points: points,
            amount: amount,
            formatted: this.formatCurrency(amount)
        };
    }

    /**
     * Calculate total session payment
     * @param {number} totalPoints - Total points earned across all trials
     * @param {number} waitingBonus - Waiting bonus in minor units (pence/cents)
     * @param {boolean} completed - Whether the experiment was completed
     * @returns {Object} Payment breakdown
     */
    calculateSessionPayment(totalPoints, waitingBonus = 0, completed = true) {
        // Convert waiting bonus from pence/cents to currency units
        const waitingBonusAmount = waitingBonus / 100;

        // Calculate components
        const pointsAmount = this.pointsToAmount(totalPoints);
        const completionAmount = completed ? this.completionFee : 0;

        // Calculate total
        let total = this.flatFee + pointsAmount + completionAmount + waitingBonusAmount;

        // Apply min/max constraints
        if (this.minPayment !== null && total < this.minPayment) {
            total = this.minPayment;
        }
        if (this.maxPayment !== null && total > this.maxPayment) {
            total = this.maxPayment;
        }

        return {
            breakdown: {
                flatFee: this.flatFee,
                pointsEarned: totalPoints,
                pointsAmount: pointsAmount,
                completionFee: completionAmount,
                waitingBonus: waitingBonusAmount
            },
            total: total,
            totalInMinorUnits: Math.round(total * 100), // pence/cents
            formatted: this.formatCurrency(total),
            currency: this.currency
        };
    }

    /**
     * Calculate final payment for a client
     * @param {Object} client - Client object with payment data
     * @param {Object} room - Room object with payment arrays
     * @returns {Object} Final payment calculation
     */
    calculateFinalPayment(client, room) {
        const clientIdx = client.subjectNumber - 1;

        // Get total points for this client
        let totalPoints = 0;
        if (room.totalPayoff_perIndiv && room.totalPayoff_perIndiv[clientIdx] !== undefined) {
            totalPoints = room.totalPayoff_perIndiv[clientIdx];
        }

        // Get waiting bonus (already in pence/cents)
        const waitingBonus = client.waitingBonus || 0;

        // Determine if completed (could be enhanced with more logic)
        const completed = true; // Assume completed if reached payment calculation

        return this.calculateSessionPayment(totalPoints, waitingBonus, completed);
    }

    /**
     * Format currency amount with symbol and precision
     * @param {number} amount - Amount in currency units
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount)) {
            amount = 0;
        }
        return `${this.currencySymbol}${amount.toFixed(this.precision)}`;
    }

    /**
     * Get payment summary for display
     * @param {Object} paymentData - Payment calculation result
     * @returns {Object} Display-friendly payment summary
     */
    getPaymentSummary(paymentData) {
        const breakdown = paymentData.breakdown;

        return {
            items: [
                {
                    label: 'Base payment',
                    amount: breakdown.flatFee,
                    formatted: this.formatCurrency(breakdown.flatFee)
                },
                {
                    label: `Points earned (${breakdown.pointsEarned} points)`,
                    amount: breakdown.pointsAmount,
                    formatted: this.formatCurrency(breakdown.pointsAmount)
                },
                {
                    label: 'Completion bonus',
                    amount: breakdown.completionFee,
                    formatted: this.formatCurrency(breakdown.completionFee),
                    show: breakdown.completionFee > 0
                },
                {
                    label: 'Waiting bonus',
                    amount: breakdown.waitingBonus,
                    formatted: this.formatCurrency(breakdown.waitingBonus),
                    show: breakdown.waitingBonus > 0
                }
            ].filter(item => item.show !== false),
            total: {
                label: 'Total payment',
                amount: paymentData.total,
                formatted: paymentData.formatted
            },
            currency: paymentData.currency
        };
    }

    /**
     * Get configuration object for client
     * @returns {Object} Client-safe configuration
     */
    getClientConfig() {
        return {
            flatFee: this.flatFee,
            completionFee: this.completionFee,
            pointsToCurrency: this.pointsToCurrency,
            currency: this.currency,
            currencySymbol: this.currencySymbol,
            precision: this.precision
        };
    }
}

module.exports = PaymentCalculator;
