/**
 * SceneOstracismVote - Connection maintenance voting interface
 * Allows players to vote to maintain or break connection with their partner
 * Occurs every 5 rounds in Network-Embedded Dyadic Prisoner's Dilemma
 */

import { PDTheme } from '../../ui/pdTheme.js';

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

        // Avatar IDs from server
        this.avatarId = data.avatarId || null;
        this.partnerAvatarId = data.partnerAvatarId || null;

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

        // Display avatars below the subtitle
        const avatarY = 160;
        const avatarScale = 0.10;
        const avatarSpacing = 80;

        // Player's avatar (left) - "You"
        if (this.avatarId && this.textures.exists(`avatar_${this.avatarId}`)) {
            const myAvatar = this.add.image(centerX - avatarSpacing, avatarY, `avatar_${this.avatarId}`);
            myAvatar.setScale(avatarScale);
        }

        // Connector between avatars (relationship being decided)
        this.add.text(centerX, avatarY, '?', {
            fontSize: '28px',
            fill: '#999',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Partner's avatar (right)
        if (this.partnerAvatarId && this.textures.exists(`avatar_${this.partnerAvatarId}`)) {
            const partnerAvatar = this.add.image(centerX + avatarSpacing, avatarY, `avatar_${this.partnerAvatarId}`);
            partnerAvatar.setScale(avatarScale);
        }

        // Cooperation history summary - the key info for this decision
        const totalInteractions = this.cooperationStats.totalInteractions;
        const partnerCooperations = this.cooperationStats.partnerCooperations;
        const cooperationRate = this.cooperationStats.cooperationRate;

        let historyText = '';
        if (totalInteractions > 0) {
            historyText = `Over ${totalInteractions} round${totalInteractions !== 1 ? 's' : ''} together, ` +
                `partner cooperated ${partnerCooperations}/${totalInteractions} times (${cooperationRate}%)`;
        } else {
            historyText = 'This is your first interaction with this partner';
        }

        this.add.text(centerX, 230, historyText, {
            fontSize: '18px',
            fill: '#333',
            fontStyle: totalInteractions > 0 ? 'bold' : 'italic'
        }).setOrigin(0.5);

        // Cumulative payoff
        this.add.text(centerX, 275, `Your total earnings: ${this.cumulativePayoff} points`, {
            fontSize: '20px',
            fill: '#333'
        }).setOrigin(0.5);

        // Warning text
        this.add.text(centerX, 320, '⚠️ Breaking a connection is permanent and cannot be undone', {
            fontSize: '16px',
            fill: PDTheme.text.error,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Vote buttons
        const buttonY = 400;
        const buttonWidth = 260;
        const buttonHeight = 70;
        const buttonSpacing = 40;

        // Continue Partnership button - same grey as break button (neutral)
        this.maintainButton = this.add.rectangle(
            centerX - buttonWidth / 2 - buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            PDTheme.buttons.choice.normal
        ).setInteractive({ cursor: 'pointer' });
        this.maintainButton.setStrokeStyle(3, PDTheme.buttons.choice.hover);

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

        // Break Connection button - same grey as continue button (neutral)
        this.breakButton = this.add.rectangle(
            centerX + buttonWidth / 2 + buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            PDTheme.buttons.choice.normal
        ).setInteractive({ cursor: 'pointer' });
        this.breakButton.setStrokeStyle(3, PDTheme.buttons.choice.hover);

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
        this.statusText = this.add.text(centerX, 490, '', {
            fontSize: '18px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Button hover effects - same grey for both buttons
        this.maintainButton.on('pointerover', () => {
            if (!this.voteSubmitted) {
                this.maintainButton.setFillStyle(PDTheme.buttons.choice.hover);
            }
        });
        this.maintainButton.on('pointerout', () => {
            if (!this.voteSubmitted) {
                this.maintainButton.setFillStyle(PDTheme.buttons.choice.normal);
            }
        });

        this.breakButton.on('pointerover', () => {
            if (!this.voteSubmitted) {
                this.breakButton.setFillStyle(PDTheme.buttons.choice.hover);
            }
        });
        this.breakButton.on('pointerout', () => {
            if (!this.voteSubmitted) {
                this.breakButton.setFillStyle(PDTheme.buttons.choice.normal);
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

        // Modal background - using neutral grey stroke instead of red
        const modalBg = this.add.rectangle(0, 0, 500, 280, 0xFFFFFF);
        modalBg.setStrokeStyle(3, 0x607D8B);

        // Modal title
        const modalTitle = this.add.text(0, -100, 'Confirm Break Connection', {
            fontSize: '24px',
            fill: PDTheme.text.error,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Modal text
        const modalText = this.add.text(0, -30,
            `Are you sure you want to permanently break\nyour connection with ${this.partnerSubjectId}?\n\nThis action cannot be undone.\nYou will never be paired with this player again.`, {
            fontSize: '16px',
            fill: '#333',
            align: 'center'
        }).setOrigin(0.5);

        // Confirm button - same grey as other choice buttons
        const confirmButton = this.add.rectangle(-100, 80, 160, 50, PDTheme.buttons.choice.normal)
            .setInteractive({ cursor: 'pointer' });
        const confirmText = this.add.text(-100, 80, 'Yes, Break', {
            fontSize: '18px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Cancel button - action button style
        const cancelButton = this.add.rectangle(100, 80, 160, 50, PDTheme.buttons.action.normal)
            .setInteractive({ cursor: 'pointer' });
        const cancelText = this.add.text(100, 80, 'Cancel', {
            fontSize: '18px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Button interactions
        confirmButton.on('pointerover', () => confirmButton.setFillStyle(PDTheme.buttons.choice.hover));
        confirmButton.on('pointerout', () => confirmButton.setFillStyle(PDTheme.buttons.choice.normal));
        confirmButton.on('pointerdown', () => this.confirmBreak());

        cancelButton.on('pointerover', () => cancelButton.setFillStyle(PDTheme.buttons.action.hover));
        cancelButton.on('pointerout', () => cancelButton.setFillStyle(PDTheme.buttons.action.normal));
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
        this.statusText.setStyle({ fill: PDTheme.text.info, fontStyle: 'italic' });

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
        this.statusText.setStyle({ fill: PDTheme.text.info });

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
