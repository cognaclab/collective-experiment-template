/**
 * ScenePDPairing - Displays partner assignment before each PD round
 * Shows partner info, cooperation history, and network status
 * Part of Network-Embedded Dyadic Prisoner's Dilemma experiment
 */

import { PDTheme } from '../../ui/pdTheme.js';

export default class ScenePDPairing extends Phaser.Scene {
    constructor() {
        super({ key: 'ScenePDPairing' });
    }

    init(data) {
        this.roundNumber = data.roundNumber || 1;
        this.totalRounds = data.totalRounds || 3;

        // Round/turn structure info
        this.turnsPerRound = data.turnsPerRound || data.pairingData?.turnsPerRound || 2;

        // Server-provided pairing data (new server-initiated flow)
        this.serverPairingData = data.pairingData || null;

        // Avatar IDs from server
        this.avatarId = data.avatarId || null;
        this.partnerAvatarId = data.partnerAvatarId || null;

        this.pairingData = null;
        this.isIsolated = false;
        this.isUnpaired = false;
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        this.add.text(centerX, 80, 'Partner Assignment', {
            fontSize: '36px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.roundText = this.add.text(centerX, 130, `Round ${this.roundNumber} of ${this.totalRounds}`, {
            fontSize: '24px',
            fill: '#555'
        }).setOrigin(0.5);

        // Show turns per round info
        this.turnsText = this.add.text(centerX, 158, `You will play ${this.turnsPerRound} turns with your partner`, {
            fontSize: '18px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        const progressBarWidth = 400;
        const progress = this.roundNumber / this.totalRounds;

        this.add.graphics()
            .fillStyle(0xE0E0E0, 1)
            .fillRect(centerX - progressBarWidth / 2, 170, progressBarWidth, 10);

        this.add.graphics()
            .fillStyle(PDTheme.bars.progress, 1)
            .fillRect(centerX - progressBarWidth / 2, 170, progressBarWidth * progress, 10);

        this.statusText = this.add.text(centerX, 240, 'Waiting for partner assignment...', {
            fontSize: '20px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        this.partnerPanel = this.add.container(centerX, centerY);
        this.partnerPanel.setVisible(false);

        const panelBg = this.add.rectangle(0, 0, 600, 300, 0xF5F5F5);
        panelBg.setStrokeStyle(2, 0xCCCCCC);

        this.partnerNameText = this.add.text(0, -110, '', {
            fontSize: '28px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.historyText = this.add.text(0, -50, '', {
            fontSize: '18px',
            fill: '#333',
            align: 'center'
        }).setOrigin(0.5);

        this.networkStatusText = this.add.text(0, 30, '', {
            fontSize: '18px',
            fill: PDTheme.text.info,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.availablePartnersText = this.add.text(0, 70, '', {
            fontSize: '16px',
            fill: '#555',
            align: 'center',
            wordWrap: { width: 550 }
        }).setOrigin(0.5);

        this.partnerPanel.add([
            panelBg,
            this.partnerNameText,
            this.historyText,
            this.networkStatusText,
            this.availablePartnersText
        ]);

        this.continueButton = this.add.rectangle(centerX, centerY + 220, 200, 50, PDTheme.buttons.action.normal)
            .setInteractive({ cursor: 'pointer' })
            .setAlpha(0.5);

        this.continueButtonText = this.add.text(centerX, centerY + 220, 'Continue', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.continueButton.disableInteractive();

        this.continueButton.on('pointerover', () => {
            this.continueButton.setFillStyle(PDTheme.buttons.action.hover);
        });

        this.continueButton.on('pointerout', () => {
            this.continueButton.setFillStyle(PDTheme.buttons.action.normal);
        });

        this.continueButton.on('pointerdown', () => {
            this.handleContinue();
        });

        // Check if server provided pairing data directly (new server-initiated flow)
        if (this.serverPairingData) {
            console.log('ScenePDPairing: Using server-provided pairing data', this.serverPairingData);
            this.handlePairingAssigned(this.serverPairingData);
        } else {
            // Fallback: request pairing from server (legacy client-initiated flow)
            console.log('ScenePDPairing: No server pairing data, requesting from server');

            this.pairingListener = (data) => {
                if (!this.scene.isActive('ScenePDPairing')) return;
                this.handlePairingAssigned(data);
            };

            window.socket.off('pairing_assigned', this.pairingListener);
            window.socket.on('pairing_assigned', this.pairingListener);

            window.socket.emit('pairing_start', {
                sessionId: window.sessionId,
                roomId: window.roomId,
                roundNumber: this.roundNumber
            });

            console.log('ScenePDPairing: Requested pairing for round', this.roundNumber);
        }
    }

    handlePairingAssigned(data) {
        console.log('ScenePDPairing: Received pairing assignment', data);

        this.pairingData = data;

        if (data.isIsolated) {
            this.handleIsolatedPlayer();
            return;
        }

        if (data.isUnpaired) {
            this.handleUnpairedPlayer();
            return;
        }

        this.displayPartnerInfo(data);
    }

    handleIsolatedPlayer() {
        console.log('ScenePDPairing: Player is isolated');
        this.isIsolated = true;

        this.statusText.setText('You have no remaining connections');

        this.partnerPanel.setVisible(true);
        this.partnerNameText.setText('⚠️ Isolated');
        this.partnerNameText.setStyle({ fill: PDTheme.status.isolated });

        this.historyText.setText('You will sit out this round.');

        this.networkStatusText.setText('No active connections remaining');
        this.networkStatusText.setStyle({ fill: PDTheme.status.isolated });

        this.availablePartnersText.setText('');

        this.continueButtonText.setText('Skip Round');

        this.time.delayedCall(2000, () => {
            if (!this.scene.isActive('ScenePDPairing')) return;
            this.handleContinue();
        }, [], this);
    }

    handleUnpairedPlayer() {
        console.log('ScenePDPairing: Player is unpaired this round');
        this.isUnpaired = true;

        this.statusText.setText('Not paired this round');

        this.partnerPanel.setVisible(true);
        this.partnerNameText.setText('⏸️ Waiting');
        this.partnerNameText.setStyle({ fill: PDTheme.text.waiting });

        this.historyText.setText('Odd number of connected players.\nYou will sit out this round.');

        if (this.pairingData.networkStatus) {
            const connections = this.pairingData.networkStatus.totalConnections || 0;
            this.networkStatusText.setText(`You have ${connections} connection${connections !== 1 ? 's' : ''}`);
        }

        this.availablePartnersText.setText('');

        this.continueButtonText.setText('Skip Round');

        this.time.delayedCall(2000, () => {
            if (!this.scene.isActive('ScenePDPairing')) return;
            this.handleContinue();
        }, [], this);
    }

    displayPartnerInfo(data) {
        console.log('ScenePDPairing: Displaying partner info');

        this.statusText.setText('Partner assigned!');
        this.statusText.setStyle({ fill: PDTheme.text.info, fontStyle: 'normal' });

        this.partnerPanel.setVisible(true);

        // Display partner's avatar if available
        const partnerAvatar = this.partnerAvatarId || data.partnerAvatarId;
        if (partnerAvatar && this.textures.exists(`avatar_${partnerAvatar}`)) {
            const avatarImage = this.add.image(0, -60, `avatar_${partnerAvatar}`);
            avatarImage.setScale(0.15);
            this.partnerPanel.add(avatarImage);
            // Move partner name below avatar
            this.partnerNameText.setY(0);
        }

        const partnerLabel = data.partnerSubjectId || `Player ${data.partnerNumber || '?'}`;
        this.partnerNameText.setText(`Paired with ${partnerLabel}`);

        if (data.timesPlayedWithPartner === 0) {
            this.historyText.setText('This is your first time playing with this partner');
        } else {
            const history = data.cooperationHistory || {};
            // Server sends player2Cooperated (times the partner cooperated with viewing player)
            const cooperations = history.player2Cooperated || 0;
            const total = data.timesPlayedWithPartner || 1;
            const rate = Math.round((cooperations / total) * 100);

            this.historyText.setText(
                `You've played with this partner ${total} time${total !== 1 ? 's' : ''} before\n` +
                `Partner cooperated: ${cooperations}/${total} times (${rate}%)`
            );

            // Use neutral grey tones instead of green/red moral colors
            const color = '#555555';
            this.historyText.setStyle({ fill: color });
        }

        if (data.networkStatus) {
            const connections = data.networkStatus.totalConnections || 0;
            this.networkStatusText.setText(
                `You have ${connections} active connection${connections !== 1 ? 's' : ''} remaining`
            );

            if (data.networkStatus.availablePartners && data.networkStatus.availablePartners.length > 0) {
                const partners = data.networkStatus.availablePartners
                    .map(p => p.subjectId || `Player ${p.number || '?'}`)
                    .join(', ');
                this.availablePartnersText.setText(`Can be paired with: ${partners}`);
            }
        }

        this.continueButton.setInteractive({ cursor: 'pointer' });
        this.continueButton.setAlpha(1);
    }

    handleContinue() {
        console.log('ScenePDPairing: Continue clicked');

        this.continueButton.disableInteractive();
        this.continueButton.setAlpha(0.5);

        window.socket.emit('scene_complete', {
            scene: 'ScenePDPairing',
            roundNumber: this.roundNumber,
            sessionId: window.sessionId,
            roomId: window.roomId,
            isIsolated: this.isIsolated,
            isUnpaired: this.isUnpaired
        });
    }

    shutdown() {
        if (this.pairingListener) {
            window.socket.off('pairing_assigned', this.pairingListener);
        }
    }
}
