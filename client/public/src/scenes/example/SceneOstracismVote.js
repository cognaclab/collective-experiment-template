/**
 * SceneOstracismVote - Connection maintenance voting interface
 * Allows players to vote to maintain or break connection with their partner
 * Occurs every 5 rounds in Network-Embedded Dyadic Prisoner's Dilemma
 */

export default class SceneOstracismVote extends Phaser.Scene {
    constructor() {
        super({ key: 'SceneOstracismVote' });
    }

    init(data) {
        console.log('SceneOstracismVote.init() received data:', data);

        this.roundNumber = data.roundNumber || 1;
        this.totalRounds = data.totalRounds || 30;

        // Partner info from server
        this.partnerId = data.partnerId;
        this.partnerSubjectId = data.partnerSubjectId || `Player ${this.partnerId}`;

        // Cooperation history and stats from server
        this.cooperationHistory = data.cooperationHistory || [];
        this.cooperationStats = data.cooperationStats || {
            totalInteractions: 0,
            partnerCooperations: 0,
            cooperationRate: 0
        };

        this.cumulativePayoff = data.cumulativePayoff || 0;
        this.isIsolated = data.isIsolated || false;

        // Get last round outcome from window.lastPDResult (set by ScenePDChoice/ScenePDResults)
        const lastResult = window.lastPDResult || {};
        this.lastRoundOutcome = {
            playerChoice: lastResult.myChoice,
            partnerChoice: lastResult.partnerChoice,
            playerPayoff: lastResult.myPayoff,
            partnerPayoff: lastResult.partnerPayoff
        };

        this.voteSubmitted = false;
        this.showingConfirmation = false;
    }

    create() {
        console.log('SceneOstracismVote.create() - partner:', this.partnerSubjectId);
        console.log('Cooperation history:', this.cooperationHistory);
        console.log('Last round outcome:', this.lastRoundOutcome);

        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        // Title
        this.add.text(centerX, 50, 'Connection Decision', {
            fontSize: '36px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(centerX, 90, `After Round ${this.roundNumber}`, {
            fontSize: '20px',
            fill: '#555'
        }).setOrigin(0.5);

        // Partner info panel
        const panelY = 200;
        const panelBg = this.add.rectangle(centerX, panelY, 700, 160, 0xF5F5F5);
        panelBg.setStrokeStyle(2, 0xCCCCCC);

        // Partner name
        this.add.text(centerX, panelY - 60, `Your partner: ${this.partnerSubjectId}`, {
            fontSize: '24px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Last round outcome
        const choiceLabels = ['Cooperate', 'Defect'];
        const playerChoiceText = this.lastRoundOutcome.playerChoice !== undefined
            ? choiceLabels[this.lastRoundOutcome.playerChoice]
            : 'Unknown';
        const partnerChoiceText = this.lastRoundOutcome.partnerChoice !== undefined
            ? choiceLabels[this.lastRoundOutcome.partnerChoice]
            : 'Unknown';

        this.add.text(centerX, panelY - 20,
            `Last round: You chose ${playerChoiceText} | Partner chose ${partnerChoiceText}`, {
            fontSize: '18px',
            fill: '#333'
        }).setOrigin(0.5);

        // Payoffs
        const playerPayoff = this.lastRoundOutcome.playerPayoff !== undefined ? this.lastRoundOutcome.playerPayoff : '?';
        const partnerPayoff = this.lastRoundOutcome.partnerPayoff !== undefined ? this.lastRoundOutcome.partnerPayoff : '?';

        this.add.text(centerX, panelY + 15,
            `You earned: ${playerPayoff} points | Partner earned: ${partnerPayoff} points`, {
            fontSize: '18px',
            fill: '#1976D2'
        }).setOrigin(0.5);

        // Cooperation history summary
        const totalInteractions = this.cooperationStats.totalInteractions;
        const partnerCooperations = this.cooperationStats.partnerCooperations;
        const cooperationRate = this.cooperationStats.cooperationRate;

        let historyText = '';
        let historyColor = '#555';

        if (totalInteractions > 0) {
            historyText = `Over ${totalInteractions} round${totalInteractions !== 1 ? 's' : ''} together, ` +
                `partner cooperated ${partnerCooperations}/${totalInteractions} times (${cooperationRate}%)`;

            // Color based on cooperation rate
            if (cooperationRate >= 70) {
                historyColor = '#4CAF50'; // Green - high cooperation
            } else if (cooperationRate >= 40) {
                historyColor = '#FF9800'; // Orange - medium cooperation
            } else {
                historyColor = '#F44336'; // Red - low cooperation
            }
        } else {
            historyText = 'This is your first interaction with this partner';
            historyColor = '#666';
        }

        this.add.text(centerX, panelY + 55, historyText, {
            fontSize: '16px',
            fill: historyColor,
            fontStyle: totalInteractions > 0 ? 'bold' : 'italic'
        }).setOrigin(0.5);

        // Cumulative payoff
        this.add.text(centerX, 300, `Your total earnings: ${this.cumulativePayoff} points`, {
            fontSize: '18px',
            fill: '#333'
        }).setOrigin(0.5);

        // Warning text
        this.add.text(centerX, 340, '⚠️ Breaking a connection is permanent and cannot be undone', {
            fontSize: '16px',
            fill: '#F44336',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Vote buttons
        const buttonY = 420;
        const buttonWidth = 260;
        const buttonHeight = 70;
        const buttonSpacing = 40;

        // Continue Partnership button (green)
        this.maintainButton = this.add.rectangle(
            centerX - buttonWidth / 2 - buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x4CAF50
        ).setInteractive({ cursor: 'pointer' });
        this.maintainButton.setStrokeStyle(3, 0x45A049);

        this.maintainButtonText = this.add.text(
            centerX - buttonWidth / 2 - buttonSpacing / 2,
            buttonY,
            'Continue\nPartnership',
            {
                fontSize: '22px',
                fill: '#FFF',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5);

        // Break Connection button (red)
        this.breakButton = this.add.rectangle(
            centerX + buttonWidth / 2 + buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0xF44336
        ).setInteractive({ cursor: 'pointer' });
        this.breakButton.setStrokeStyle(3, 0xD32F2F);

        this.breakButtonText = this.add.text(
            centerX + buttonWidth / 2 + buttonSpacing / 2,
            buttonY,
            'Break\nConnection',
            {
                fontSize: '22px',
                fill: '#FFF',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5);

        // Status text (for waiting message)
        this.statusText = this.add.text(centerX, 510, '', {
            fontSize: '18px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Button hover effects
        this.maintainButton.on('pointerover', () => {
            if (!this.voteSubmitted) {
                this.maintainButton.setFillStyle(0x45A049);
            }
        });
        this.maintainButton.on('pointerout', () => {
            if (!this.voteSubmitted) {
                this.maintainButton.setFillStyle(0x4CAF50);
            }
        });

        this.breakButton.on('pointerover', () => {
            if (!this.voteSubmitted) {
                this.breakButton.setFillStyle(0xD32F2F);
            }
        });
        this.breakButton.on('pointerout', () => {
            if (!this.voteSubmitted) {
                this.breakButton.setFillStyle(0xF44336);
            }
        });

        // Button click handlers
        this.maintainButton.on('pointerdown', () => {
            if (!this.voteSubmitted) {
                this.submitVote('continue');
            }
        });

        this.breakButton.on('pointerdown', () => {
            if (!this.voteSubmitted) {
                this.showBreakConfirmation();
            }
        });

        // Create confirmation modal (hidden initially)
        this.createConfirmationModal();

        // Listen for ostracism_complete from server
        this.completeListener = (data) => {
            if (!this.scene.isActive('SceneOstracismVote')) return;
            this.handleOstracismComplete(data);
        };

        window.socket.off('ostracism_complete', this.completeListener);
        window.socket.on('ostracism_complete', this.completeListener);

        console.log('SceneOstracismVote: Ready for voting');
    }

    createConfirmationModal() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        this.confirmationModal = this.add.container(centerX, centerY);
        this.confirmationModal.setVisible(false);
        this.confirmationModal.setDepth(1000);

        // Overlay
        const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
        overlay.setOrigin(0.5);

        // Modal background
        const modalBg = this.add.rectangle(0, 0, 500, 280, 0xFFFFFF);
        modalBg.setStrokeStyle(3, 0xF44336);

        // Modal title
        const modalTitle = this.add.text(0, -100, 'Confirm Break Connection', {
            fontSize: '24px',
            fill: '#F44336',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Modal text
        const modalText = this.add.text(0, -30,
            `Are you sure you want to permanently break\nyour connection with ${this.partnerSubjectId}?\n\nThis action cannot be undone.\nYou will never be paired with this player again.`, {
            fontSize: '16px',
            fill: '#333',
            align: 'center'
        }).setOrigin(0.5);

        // Confirm button
        const confirmButton = this.add.rectangle(-100, 80, 160, 50, 0xF44336)
            .setInteractive({ cursor: 'pointer' });
        const confirmText = this.add.text(-100, 80, 'Yes, Break', {
            fontSize: '18px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Cancel button
        const cancelButton = this.add.rectangle(100, 80, 160, 50, 0x757575)
            .setInteractive({ cursor: 'pointer' });
        const cancelText = this.add.text(100, 80, 'Cancel', {
            fontSize: '18px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Button interactions
        confirmButton.on('pointerover', () => confirmButton.setFillStyle(0xD32F2F));
        confirmButton.on('pointerout', () => confirmButton.setFillStyle(0xF44336));
        confirmButton.on('pointerdown', () => this.confirmBreak());

        cancelButton.on('pointerover', () => cancelButton.setFillStyle(0x616161));
        cancelButton.on('pointerout', () => cancelButton.setFillStyle(0x757575));
        cancelButton.on('pointerdown', () => this.hideConfirmation());

        this.confirmationModal.add([
            overlay, modalBg, modalTitle, modalText,
            confirmButton, confirmText, cancelButton, cancelText
        ]);
    }

    showBreakConfirmation() {
        this.showingConfirmation = true;
        this.confirmationModal.setVisible(true);
    }

    hideConfirmation() {
        this.showingConfirmation = false;
        this.confirmationModal.setVisible(false);
    }

    confirmBreak() {
        this.hideConfirmation();
        this.submitVote('break');
    }

    submitVote(vote) {
        if (this.voteSubmitted) return;

        console.log('SceneOstracismVote: Submitting vote:', vote);
        this.voteSubmitted = true;

        // Disable buttons
        this.maintainButton.disableInteractive();
        this.maintainButton.setAlpha(0.5);
        this.breakButton.disableInteractive();
        this.breakButton.setAlpha(0.5);

        // Show waiting message
        this.statusText.setText('Vote submitted. Waiting for other players...');
        this.statusText.setStyle({ fill: '#4CAF50', fontStyle: 'italic' });

        // Emit vote to server
        window.socket.emit('ostracism_vote', {
            sessionId: window.sessionId,
            roomId: window.roomId,
            subjectId: window.subjectId,
            partnerId: this.partnerId,
            vote: vote,
            roundNumber: this.roundNumber
        });
    }

    handleOstracismComplete(data) {
        console.log('SceneOstracismVote: Ostracism complete', data);

        this.statusText.setText('All votes recorded. Proceeding...');
        this.statusText.setStyle({ fill: '#1976D2' });

        // Short delay then emit scene_complete
        this.time.delayedCall(1000, () => {
            if (!this.scene.isActive('SceneOstracismVote')) return;

            window.socket.emit('scene_complete', {
                scene: 'SceneOstracismVote',
                roundNumber: this.roundNumber,
                sessionId: window.sessionId,
                roomId: window.roomId
            });
        }, [], this);
    }

    shutdown() {
        if (this.completeListener) {
            window.socket.off('ostracism_complete', this.completeListener);
        }
    }
}
