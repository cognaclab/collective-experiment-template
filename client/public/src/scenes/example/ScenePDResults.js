// ScenePDResults - Show both players' choices and payoffs
// Displays what each player chose and how many points they earned

import { PDTheme } from '../../ui/pdTheme.js';

class ScenePDResults extends Phaser.Scene {

    constructor() {
        super({ key: 'ScenePDResults', active: false });
    }

    preload() {
    }

    init(data) {
        this.trial = data.trial || 1;
        this.showBothChoices = data.showBothChoices !== undefined ? data.showBothChoices : true;
        this.showPayoffs = data.showPayoffs !== undefined ? data.showPayoffs : true;

        // Round/turn structure
        this.gameRound = data.gameRound || 1;
        this.turnWithinRound = data.turnWithinRound || 1;
        this.turnsPerRound = data.turnsPerRound || 2;
        this.totalRounds = data.totalRounds || 3;

        // Get result data - prefer passed data from server, fallback to window.lastPDResult (for networked PD)
        const result = window.lastPDResult || {};

        // Use data from server if provided, otherwise use stored result from all_pairs_complete
        this.myChoice = data.myChoice !== undefined ? data.myChoice : result.myChoice;
        this.partnerChoice = data.partnerChoice !== undefined ? data.partnerChoice : result.partnerChoice;
        this.myPayoff = data.myPayoff !== undefined ? data.myPayoff : result.myPayoff;
        this.partnerPayoff = data.partnerPayoff !== undefined ? data.partnerPayoff : result.partnerPayoff;
        this.totalPoints = data.totalPoints || result.cumulativePayoff || 0;
        this.wasMiss = data.wasMiss || false;
        this.wasTimeout = data.wasTimeout || false;

        // Avatar IDs from server or stored result
        this.avatarId = data.avatarId || result.avatarId || null;
        this.partnerAvatarId = data.partnerAvatarId || result.partnerAvatarId || null;

        console.log('ScenePDResults.init() - resolved data:', {
            myChoice: this.myChoice,
            partnerChoice: this.partnerChoice,
            myPayoff: this.myPayoff,
            partnerPayoff: this.partnerPayoff,
            totalPoints: this.totalPoints,
            gameRound: this.gameRound,
            turnWithinRound: this.turnWithinRound,
            turnsPerRound: this.turnsPerRound,
            fromServer: data.myChoice !== undefined,
            fromWindow: result.myChoice !== undefined
        });
    }

    create() {
        console.log('ScenePDResults.create() - trial:', this.trial);
        console.log('My choice:', this.myChoice, 'Partner choice:', this.partnerChoice);
        console.log('My payoff:', this.myPayoff, 'Partner payoff:', this.partnerPayoff);

        // Background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        // Title - conditional based on experiment type
        let titleText;
        if (this.turnsPerRound > 1) {
            // Networked PD with turn structure
            titleText = `Round ${this.gameRound} - Turn ${this.turnWithinRound} Results`;
        } else {
            // Simple PD without turns
            titleText = `Trial ${this.trial} Results`;
        }
        const title = this.add.text(400, 50, titleText, {
            fontSize: '32px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Show remaining turns info (only for networked PD with turns)
        if (this.turnsPerRound > 1) {
            const turnsRemaining = this.turnsPerRound - this.turnWithinRound;
            if (turnsRemaining > 0) {
                this.add.text(400, 85, `${turnsRemaining} turn${turnsRemaining !== 1 ? 's' : ''} remaining with this partner`, {
                    fontSize: '16px',
                    fill: '#666',
                    fontStyle: 'italic'
                }).setOrigin(0.5);
            } else {
                this.add.text(400, 85, 'Final turn with this partner - vote next', {
                    fontSize: '16px',
                    fill: PDTheme.text.waiting,
                    fontStyle: 'italic'
                }).setOrigin(0.5);
            }
        }

        // Choice labels - same grey for both choices to avoid moral color coding
        const choiceLabels = ['Cooperate', 'Defect'];
        const choiceColor = PDTheme.results.choiceBox;

        let yPos = 150;

        // Handle miss/timeout cases
        if (this.wasMiss || this.wasTimeout) {
            const missText = this.add.text(400, 200,
                this.wasMiss ? 'You did not make a choice in time!' : 'You took too long to decide!',
                { fontSize: '24px', fill: PDTheme.text.error, fontStyle: 'bold' }
            ).setOrigin(0.5);

            yPos += 60;
        }

        // Display both players' choices with avatars
        if (this.showBothChoices) {
            const leftX = 250;
            const rightX = 550;
            let avatarYOffset = 0;

            // Display avatars if available
            if (this.avatarId && this.textures.exists(`avatar_${this.avatarId}`)) {
                const myAvatar = this.add.image(leftX, yPos + 30, `avatar_${this.avatarId}`);
                myAvatar.setScale(0.12);
                avatarYOffset = 70;
            }

            if (this.partnerAvatarId && this.textures.exists(`avatar_${this.partnerAvatarId}`)) {
                const partnerAvatar = this.add.image(rightX, yPos + 30, `avatar_${this.partnerAvatarId}`);
                partnerAvatar.setScale(0.12);
                avatarYOffset = 70;
            }

            const labelY = yPos + avatarYOffset;
            const choiceY = labelY + 50;

            // You section (left)
            this.add.text(leftX, labelY, 'You', {
                fontSize: '28px',
                fill: '#333',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            if (this.myChoice !== null && this.myChoice !== undefined) {
                const myChoiceBox = this.add.rectangle(leftX, choiceY, 160, 80, choiceColor);
                const myChoiceText = this.add.text(leftX, choiceY, choiceLabels[this.myChoice], {
                    fontSize: '20px',
                    fill: '#FFF',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
            } else {
                const myChoiceText = this.add.text(leftX, choiceY, 'No choice', {
                    fontSize: '20px',
                    fill: '#999',
                    fontStyle: 'italic'
                }).setOrigin(0.5);
            }

            // Your Partner section (right)
            this.add.text(rightX, labelY, 'Your Partner', {
                fontSize: '28px',
                fill: '#333',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            if (this.partnerChoice !== null && this.partnerChoice !== undefined) {
                const partnerChoiceBox = this.add.rectangle(rightX, choiceY, 160, 80, choiceColor);
                const partnerChoiceText = this.add.text(rightX, choiceY, choiceLabels[this.partnerChoice], {
                    fontSize: '20px',
                    fill: '#FFF',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
            } else {
                const partnerChoiceText = this.add.text(rightX, choiceY, 'No choice', {
                    fontSize: '20px',
                    fill: '#999',
                    fontStyle: 'italic'
                }).setOrigin(0.5);
            }

            yPos = choiceY + 80;
        }

        // Display payoffs
        if (this.showPayoffs) {
            const payoffY = yPos + 40;

            this.add.text(400, payoffY, 'Points Earned:', {
                fontSize: '24px',
                fill: '#333'
            }).setOrigin(0.5);

            // Show individual payoffs
            const payoffDetailsY = payoffY + 50;
            const payoffText = `You: ${this.myPayoff || 0} points  |  Partner: ${this.partnerPayoff || 0} points`;

            this.add.text(400, payoffDetailsY, payoffText, {
                fontSize: '22px',
                fill: PDTheme.text.info,
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Total points accumulated
            // const totalY = payoffDetailsY + 60;
            // this.add.text(400, totalY, `Your Total: ${this.totalPoints} points`, {
            //     fontSize: '28px',
            //     fill: '#4CAF50',
            //     fontStyle: 'bold'
            // }).setOrigin(0.5);
        }

        // Continue button
        const buttonY = 500;
        const continueButton = this.add.rectangle(400, buttonY, 200, 60, PDTheme.buttons.action.normal)
            .setInteractive({ cursor: 'pointer' });

        const continueText = this.add.text(400, buttonY, 'Continue', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Button hover effect
        continueButton.on('pointerover', () => {
            continueButton.setFillStyle(PDTheme.buttons.action.hover);
        });

        continueButton.on('pointerout', () => {
            continueButton.setFillStyle(PDTheme.buttons.action.normal);
        });

        // Button click - emit scene complete
        continueButton.on('pointerdown', () => {
            console.log('Results viewed, emitting scene_complete');

            window.socket.emit('scene_complete', {
                sessionId: window.sessionId,
                roomId: window.roomId,
                subjectId: window.subjectId,
                scene: 'ScenePDResults',
                trial: this.trial
            });

            // Disable button to prevent double-clicks
            continueButton.disableInteractive();
            continueText.setText('Waiting...');
        });

        // Auto-advance after delay (optional, disabled by default)
        // Uncomment if you want auto-progression:
        // this.time.delayedCall(5000, () => {
        //     if (continueButton.input.enabled) {
        //         continueButton.emit('pointerdown');
        //     }
        // });
    }
}

export default ScenePDResults;
