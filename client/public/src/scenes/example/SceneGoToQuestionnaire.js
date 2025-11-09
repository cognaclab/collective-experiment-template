// SceneGoToQuestionnaire

import {rand
	, goToQuestionnaire
} from '../../functions.js';

class SceneGoToQuestionnaire extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneGoToQuestionnaire', active: false });
	}

	preload(){
	}

	init(data) {
		this.totalPointsAllRounds = data.totalPointsAllRounds || 0;
		this.roundBreakdown = data.roundBreakdown || [];
		this.totalGameRounds = data.totalGameRounds || 1;
		this.optionOrder = data.optionOrder || [1, 2, 3];
		this.horizon = data.horizon || 0;
		this.n = data.n || 1;
		this.prob_means = data.prob_means || null;
		this.payment = data.payment || null;
	}

	create(){
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF');

		let yPosition = 80;

		// Title
		this.add.text(configWidth/2, yPosition, 'Round Complete!', {
			fontSize: '48px',
			fill: '#000',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 70;

		// Total points
		this.add.text(configWidth/2, yPosition, `Total Points Earned: ${this.totalPointsAllRounds}`, {
			fontSize: '36px',
			fill: '#ff6600',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 60;

		// Per-round breakdown (only if multiple rounds)
		if (this.totalGameRounds > 1) {
			this.add.text(configWidth/2, yPosition, 'Points per Round:', {
				fontSize: '24px',
				fill: '#000'
			}).setOrigin(0.5);
			yPosition += 40;

			for (let i = 0; i < this.totalGameRounds; i++) {
				const roundPoints = this.roundBreakdown[i] || 0;
				this.add.text(configWidth/2, yPosition, `Round ${i + 1}: ${roundPoints} points`, {
					fontSize: '20px',
					fill: '#666'
				}).setOrigin(0.5);
				yPosition += 35;
			}
			yPosition += 20;
		}

		// Machine probabilities (for debugging)
		// Display in visual order (Machine 1 = left, Machine 2 = right, etc.)
		// Shows the actual probabilities assigned to each position via optionOrder
		if (this.prob_means && this.prob_means.length > 0) {
			this.add.text(configWidth/2, yPosition, 'Machine Probabilities:', {
				fontSize: '22px',
				fill: '#000',
				fontStyle: 'bold'
			}).setOrigin(0.5);
			yPosition += 35;

			for (let position = 0; position < this.prob_means.length; position++) {
				const displayMachineNumber = position + 1; // Machine 1, Machine 2, etc. (visual order)
				const actualMachineId = this.optionOrder[position]; // Which machine ID was at this position
				const probability = this.prob_means[actualMachineId - 1][0]; // Get that machine's probability

				this.add.text(configWidth/2, yPosition, `Machine ${displayMachineNumber}: ${(probability * 100).toFixed(0)}% chance of 100 points`, {
					fontSize: '20px',
					fill: '#666'
				}).setOrigin(0.5);
				yPosition += 32;
			}
			yPosition += 30;
		}

		// Monetary conversion section
		yPosition += 20;

		// Use payment data from server if available, otherwise fall back to globals
		let paymentBreakdown;
		if (this.payment && this.payment.breakdown) {
			paymentBreakdown = this.payment.breakdown;
		} else {
			// Legacy fallback using global variables
			const totalEarning_GBP = Math.round((totalPayoff_perIndiv * cent_per_point)) / 100;
			const waitingBonus_GBP = Math.round(waitingBonus) / 100;
			paymentBreakdown = {
				flatFee: 0,
				pointsAmount: totalEarning_GBP,
				completionBonus: 0,
				waitingBonus: waitingBonus_GBP
			};
		}

		this.add.text(configWidth/2, yPosition, 'Payment Summary:', {
			fontSize: '28px',
			fill: '#000',
			fontStyle: 'bold'
		}).setOrigin(0.5);
		yPosition += 45;

		// Base participation fee (if present)
		if (paymentBreakdown.flatFee > 0) {
			const currency = this.payment?.currency || 'GBP';
			const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency;
			this.add.text(configWidth/2, yPosition, `Base participation fee: ${symbol}${paymentBreakdown.flatFee.toFixed(2)}`, {
				fontSize: '22px',
				fill: '#666'
			}).setOrigin(0.5);
			yPosition += 35;
		}

		// Points earned
		const currency = this.payment?.currency || 'GBP';
		const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency;
		this.add.text(configWidth/2, yPosition, `Points reward (${this.totalPointsAllRounds} pts): ${symbol}${paymentBreakdown.pointsAmount.toFixed(2)}`, {
			fontSize: '26px',
			fill: '#ff6600'
		}).setOrigin(0.5);
		yPosition += 40;

		// Waiting bonus (if present)
		if (paymentBreakdown.waitingBonus > 0) {
			this.add.text(configWidth/2, yPosition, `Waiting bonus: ${symbol}${paymentBreakdown.waitingBonus.toFixed(2)}`, {
				fontSize: '26px',
				fill: '#ff6600'
			}).setOrigin(0.5);
			yPosition += 40;
		}

		// Completion bonus (if present)
		if (paymentBreakdown.completionBonus > 0) {
			this.add.text(configWidth/2, yPosition, `Completion bonus: ${symbol}${paymentBreakdown.completionBonus.toFixed(2)}`, {
				fontSize: '26px',
				fill: '#ff6600'
			}).setOrigin(0.5);
			yPosition += 40;
		}

		// Total payment
		yPosition += 10;
		const totalPayment = this.payment?.formatted || `${symbol}0.00`;
		this.add.text(configWidth/2, yPosition, `Total Payment: ${totalPayment}`, {
			fontSize: '32px',
			fill: '#008800',
			fontStyle: 'bold'
		}).setOrigin(0.5);
		yPosition += 60;

		// isThisGameCompleted status changes
		isThisGameCompleted = true;
		completed = 1;
		$("#completed").val(1);

		// POST button
		let questionnaireStarts = document.getElementById('questionnaireStarts');
		questionnaireStarts.innerHTML = "<div class='btn2'><div id='connectBtn'>START SHORT SURVEY</div></div>";

		let connectBtn = document.getElementById('connectBtn');
		connectBtn.addEventListener('click', goToQuestionnaire, false);
	}

	update(){}
};

export default SceneGoToQuestionnaire;
