/**
 * ScenePDPairing - Displays partner assignment before each PD round
 * Shows partner info, cooperation history, and network status
 * Part of Network-Embedded Dyadic Prisoner's Dilemma experiment
 *
 * Two-phase support: In transparent phase, displays partner's MFQ scores
 */

import { PDTheme } from '../../ui/pdTheme.js';
import { createMFQDisplay } from '../../ui/mfqScoreDisplay.js';

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

        // Two-phase experiment data
        this.currentPhaseName = data.currentPhaseName || 'blind';
        this.showMFQScores = data.showMFQScores || false;
        this.partnerMFQScores = data.partnerMFQScores || null;
        this.mfqDisplayConfig = data.mfqDisplayConfig || null;

        this.pairingData = null;
        this.isIsolated = false;
        this.isUnpaired = false;
    }

    create() {
        this.cameras.main.setBackgroundColor('#FFFFFF');

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

        this.statusText = this.add.text(centerX, 180, 'Waiting for partner assignment...', {
            fontSize: '20px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        this.partnerPanel = this.add.container(centerX, centerY);
        this.partnerPanel.setVisible(false);

        const panelBg = this.add.rectangle(0, 20, 600, 250, 0xF5F5F5);
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

        this.partnerPanel.add([
            panelBg,
            this.partnerNameText,
            this.historyText,
            this.networkStatusText
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

        this.continueButtonText.setText('Skip Round');

        this.time.delayedCall(2000, () => {
            if (!this.scene.isActive('ScenePDPairing')) return;
            this.handleContinue();
        }, [], this);
    }

    displayPartnerInfo(data) {
        console.log('ScenePDPairing: Displaying partner info');
        console.log('ScenePDPairing: avatarId =', this.avatarId, ', partnerAvatarId =', this.partnerAvatarId);
        console.log('ScenePDPairing: data.partnerAvatarId =', data?.partnerAvatarId);

        this.statusText.setText('Partner assigned!');
        this.statusText.setStyle({ fill: PDTheme.text.info, fontStyle: 'normal' });

        this.partnerPanel.setVisible(true);

        // Display both avatars side by side inside the panel
        const avatarY = -30;
        const avatarSpacing = 100;
        const avatarScale = 0.12;

        // Player's own avatar (left side) - "You"
        if (this.avatarId && this.textures.exists(`avatar_${this.avatarId}`)) {
            const myAvatar = this.add.image(-avatarSpacing, avatarY, `avatar_${this.avatarId}`);
            myAvatar.setScale(avatarScale);
            this.partnerPanel.add(myAvatar);

            const myLabel = this.add.text(-avatarSpacing, avatarY + 50, 'You', {
                fontSize: '16px',
                fill: '#333',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.partnerPanel.add(myLabel);
        }

        // Partner's avatar (right side)
        const partnerAvatar = this.partnerAvatarId || data.partnerAvatarId;
        if (partnerAvatar && this.textures.exists(`avatar_${partnerAvatar}`)) {
            const partnerAvatarImg = this.add.image(avatarSpacing, avatarY, `avatar_${partnerAvatar}`);
            partnerAvatarImg.setScale(avatarScale);
            this.partnerPanel.add(partnerAvatarImg);

            const partnerLabel = this.add.text(avatarSpacing, avatarY + 50, 'Partner', {
                fontSize: '16px',
                fill: '#333',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.partnerPanel.add(partnerLabel);

            // Show MFQ scores in transparent phase
            if (this.showMFQScores && this.partnerMFQScores) {
                console.log('ScenePDPairing: Displaying MFQ scores for partner');
                const mfqDisplay = createMFQDisplay(
                    this,
                    avatarSpacing - 50,
                    avatarY + 75,
                    this.partnerMFQScores,
                    this.mfqDisplayConfig
                );
                if (mfqDisplay) {
                    this.partnerPanel.add(mfqDisplay);
                }
            }
        }

        // Arrow or connector between avatars
        if (this.avatarId && partnerAvatar) {
            const connector = this.add.text(0, avatarY, '↔', {
                fontSize: '24px',
                fill: '#999'
            }).setOrigin(0.5);
            this.partnerPanel.add(connector);
        }

        // Position text below avatars
        this.partnerNameText.setY(90);

        // Show "Your partner for this round" without revealing player names
        this.partnerNameText.setText('Your partner for this round');

        this.continueButton.setInteractive({ cursor: 'pointer' });
        this.continueButton.setAlpha(1);
    }

    handleContinue() {
        console.log('ScenePDPairing: Continue clicked');

        this.continueButton.disableInteractive();
        this.continueButton.setAlpha(0.5);
        this.continueButtonText.setText('Waiting...');

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
