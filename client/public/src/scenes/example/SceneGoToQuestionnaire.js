/**
 * SceneGoToQuestionnaire - Experiment completion summary
 * Shows round-by-round breakdown and payment summary before questionnaire
 */

import { goToQuestionnaire } from '../../functions.js';
import { PDTheme } from '../../ui/pdTheme.js';

class SceneGoToQuestionnaire extends Phaser.Scene {

	constructor() {
		super({ key: 'SceneGoToQuestionnaire', active: false });
	}

	preload() {
	}

	init(data) {
		console.log('SceneGoToQuestionnaire.init() received data:', data);
		this.totalPointsAllRounds = data.totalPointsAllRounds || 0;
		this.roundBreakdown = data.roundBreakdown || [];
		this.totalRounds = data.totalRounds || data.totalGameRounds || 1;
		this.payment = data.payment || null;
	}

	create() {
		const centerX = this.cameras.main.width / 2;
		this.cameras.main.setBackgroundColor('#FFFFFF');

		let yPosition = 50;

		// Title
		this.add.text(centerX, yPosition, 'Experiment Complete!', {
			fontSize: '36px',
			fill: '#000',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 60;

		// Create summary panel
		const panelWidth = 500;
		const panelX = centerX;

		// Round Summary Section
		this.add.text(panelX, yPosition, 'Round Summary', {
			fontSize: '24px',
			fill: '#333',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 15;

		// Divider line
		const graphics = this.add.graphics();
		graphics.lineStyle(2, 0xCCCCCC, 1);
		graphics.lineBetween(centerX - panelWidth/2 + 50, yPosition, centerX + panelWidth/2 - 50, yPosition);

		yPosition += 25;

		// Round breakdown
		if (this.roundBreakdown && this.roundBreakdown.length > 0) {
			for (const roundData of this.roundBreakdown) {
				const roundNum = roundData.round || (this.roundBreakdown.indexOf(roundData) + 1);
				const points = roundData.points || roundData || 0;

				this.add.text(panelX, yPosition, `Round ${roundNum}: ${points} points`, {
					fontSize: '20px',
					fill: '#555'
				}).setOrigin(0.5);
				yPosition += 30;
			}
		} else {
			// Fallback for legacy data format
			for (let i = 0; i < this.totalRounds; i++) {
				const roundPoints = Array.isArray(this.roundBreakdown) ? (this.roundBreakdown[i] || 0) : 0;
				this.add.text(panelX, yPosition, `Round ${i + 1}: ${roundPoints} points`, {
					fontSize: '20px',
					fill: '#555'
				}).setOrigin(0.5);
				yPosition += 30;
			}
		}

		yPosition += 5;

		// Total points
		this.add.text(panelX, yPosition, `Total: ${this.totalPointsAllRounds} points`, {
			fontSize: '22px',
			fill: PDTheme.text.info,
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 50;

		// Payment Summary Section
		this.add.text(panelX, yPosition, 'Payment Summary', {
			fontSize: '24px',
			fill: '#333',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 15;

		// Divider line
		graphics.lineBetween(centerX - panelWidth/2 + 50, yPosition, centerX + panelWidth/2 - 50, yPosition);

		yPosition += 25;

		// Get currency symbol
		const currency = this.payment?.currency || 'GBP';
		const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency;

		// Payment breakdown
		const breakdown = this.payment?.breakdown || {
			flatFee: 0,
			pointsAmount: 0,
			waitingBonus: 0,
			completionBonus: 0
		};

		// Base fee (if present)
		if (breakdown.flatFee > 0) {
			this.add.text(panelX, yPosition, `Base fee: ${symbol}${breakdown.flatFee.toFixed(2)}`, {
				fontSize: '20px',
				fill: '#555'
			}).setOrigin(0.5);
			yPosition += 30;
		}

		// Points bonus
		this.add.text(panelX, yPosition, `Points bonus (${this.totalPointsAllRounds} pts): ${symbol}${(breakdown.pointsAmount || 0).toFixed(2)}`, {
			fontSize: '20px',
			fill: '#555'
		}).setOrigin(0.5);
		yPosition += 30;

		// Waiting bonus (if present)
		if (breakdown.waitingBonus > 0) {
			this.add.text(panelX, yPosition, `Waiting bonus: ${symbol}${breakdown.waitingBonus.toFixed(2)}`, {
				fontSize: '20px',
				fill: '#555'
			}).setOrigin(0.5);
			yPosition += 30;
		}

		// Completion bonus (if present)
		if (breakdown.completionBonus > 0) {
			this.add.text(panelX, yPosition, `Completion bonus: ${symbol}${breakdown.completionBonus.toFixed(2)}`, {
				fontSize: '20px',
				fill: '#555'
			}).setOrigin(0.5);
			yPosition += 30;
		}

		yPosition += 10;

		// Total payment
		const totalPayment = this.payment?.formatted || `${symbol}0.00`;
		this.add.text(panelX, yPosition, `Total Payment: ${totalPayment}`, {
			fontSize: '26px',
			fill: PDTheme.text.info,
			fontStyle: 'bold'
		}).setOrigin(0.5);

		yPosition += 60;

		// Survey button (Phaser-based instead of DOM)
		const buttonWidth = 280;
		const buttonHeight = 50;

		const button = this.add.rectangle(centerX, yPosition, buttonWidth, buttonHeight, PDTheme.buttons.action.normal);
		button.setInteractive({ cursor: 'pointer' });

		const buttonText = this.add.text(centerX, yPosition, 'Start Short Survey', {
			fontSize: '22px',
			fill: '#FFF',
			fontStyle: 'bold'
		}).setOrigin(0.5);

		button.on('pointerover', () => {
			button.setFillStyle(PDTheme.buttons.action.hover);
		});

		button.on('pointerout', () => {
			button.setFillStyle(PDTheme.buttons.action.normal);
		});

		button.on('pointerdown', () => {
			// Set completion flags
			if (typeof isThisGameCompleted !== 'undefined') {
				isThisGameCompleted = true;
			}
			if (typeof completed !== 'undefined') {
				completed = 1;
			}
			const completedInput = document.getElementById('completed');
			if (completedInput) {
				completedInput.value = '1';
			}

			// Navigate to questionnaire
			goToQuestionnaire();
		});

		// Also set up legacy DOM button if it exists (for backwards compatibility)
		const questionnaireStarts = document.getElementById('questionnaireStarts');
		if (questionnaireStarts) {
			questionnaireStarts.innerHTML = '';
		}
	}

	update() {}
}

export default SceneGoToQuestionnaire;
