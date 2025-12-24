/**
 * SceneNetworkUpdate - Network change summary display
 * Shows results of ostracism voting and updated network state
 * Part of Network-Embedded Dyadic Prisoner's Dilemma experiment
 */

import { PDTheme } from '../../ui/pdTheme.js';

export default class SceneNetworkUpdate extends Phaser.Scene {
    constructor() {
        super({ key: 'SceneNetworkUpdate' });
    }

    init(data) {
        console.log('SceneNetworkUpdate.init() received data:', data);

        this.roundNumber = data.roundNumber || 5;
        this.totalRounds = data.totalRounds || 30;

        // Check if network data was passed via start_scene sceneData
        if (data.edgesRemoved !== undefined || data.networkDensity !== undefined || data.playerStatus) {
            // Data was passed via start_scene - store it for use in create()
            this.pendingNetworkData = data;
        } else {
            this.pendingNetworkData = null;
        }

        this.networkData = null;
        this.countdown = 3;
        this.countdownTimer = null;
    }

    create() {
        const centerX = this.cameras.main.width / 2;

        // Set white background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        this.add.text(centerX, 60, 'Network Update', {
            fontSize: '36px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(centerX, 110, `After Round ${this.roundNumber}`, {
            fontSize: '20px',
            fill: '#555'
        }).setOrigin(0.5);

        this.statusText = this.add.text(centerX, 160, 'Updating network...', {
            fontSize: '18px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        this.summaryPanel = this.add.container(centerX, 270);
        this.summaryPanel.setVisible(false);

        const panelBg = this.add.rectangle(0, 0, 700, 300, 0xF5F5F5);
        panelBg.setStrokeStyle(2, 0xCCCCCC);

        this.changeSummaryText = this.add.text(0, -40, '', {
            fontSize: '22px',
            fill: '#333',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.isolatedPlayersText = this.add.text(0, 20, '', {
            fontSize: '16px',
            fill: PDTheme.status.isolated,
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: 650 }
        }).setOrigin(0.5);

        this.summaryPanel.add([
            panelBg,
            this.changeSummaryText,
            this.isolatedPlayersText
        ]);

        this.continueButton = this.add.rectangle(centerX, 450, 250, 50, PDTheme.buttons.action.normal);
        this.continueButton.setAlpha(0.5);

        this.continueButtonText = this.add.text(centerX, 450, 'Continue (3)', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.continueButton.on('pointerover', () => {
            if (this.continueButton.input && this.continueButton.input.enabled) {
                this.continueButton.setFillStyle(PDTheme.buttons.action.hover);
            }
        });

        this.continueButton.on('pointerout', () => {
            if (this.continueButton.input && this.continueButton.input.enabled) {
                this.continueButton.setFillStyle(PDTheme.buttons.action.normal);
            }
        });

        this.continueButton.on('pointerdown', () => {
            this.handleContinue();
        });

        this.networkListener = (data) => {
            if (!this.scene.isActive('SceneNetworkUpdate')) return;
            this.handleNetworkSummary(data);
        };

        window.socket.off('network_summary', this.networkListener);
        window.socket.on('network_summary', this.networkListener);

        // If we have pending network data from start_scene, use it immediately
        if (this.pendingNetworkData) {
            console.log('SceneNetworkUpdate: Using data from start_scene');
            this.handleNetworkSummary(this.pendingNetworkData);
        } else {
            // Fall back to waiting for socket event (legacy behavior)
            console.log('SceneNetworkUpdate: Waiting for network_summary socket event');
        }
    }

    handleNetworkSummary(data) {
        console.log('SceneNetworkUpdate: Received network summary', data);

        this.networkData = data;

        if (data.playerStatus && data.playerStatus.isIsolated) {
            this.handleIsolatedPlayer(data);
            return;
        }

        this.displayNetworkUpdate(data);
    }

    handleIsolatedPlayer(data) {
        console.log('SceneNetworkUpdate: Player became isolated');

        this.statusText.setText('⚠️ You have become isolated');
        this.statusText.setStyle({ fill: PDTheme.status.isolated, fontStyle: 'normal', fontSize: '22px' });

        this.summaryPanel.setVisible(true);

        this.changeSummaryText.setText('You will sit out the remaining rounds');
        this.changeSummaryText.setStyle({ fill: PDTheme.status.isolated });

        this.isolatedPlayersText.setText('');

        this.continueButtonText.setText('Continue');
        this.continueButton.setInteractive({ cursor: 'pointer' });
        this.continueButton.setAlpha(1);
    }

    displayNetworkUpdate(data) {
        console.log('SceneNetworkUpdate: Displaying network update');

        this.statusText.setText('Network has been updated');
        this.statusText.setStyle({ fill: PDTheme.status.active, fontStyle: 'normal' });

        this.summaryPanel.setVisible(true);

        const edgesRemoved = data.edgesRemoved || 0;
        if (edgesRemoved === 0) {
            this.changeSummaryText.setText('No connections were broken this round');
            this.changeSummaryText.setStyle({ fill: PDTheme.status.active });
        } else {
            this.changeSummaryText.setText('Someone broke their connection');
            this.changeSummaryText.setStyle({ fill: PDTheme.status.inactive });
        }

        // Show isolated player count if any (anonymous)
        const isolatedCount = data.isolatedCount || 0;
        if (isolatedCount > 0) {
            this.isolatedPlayersText.setText(
                `${isolatedCount} player${isolatedCount !== 1 ? 's' : ''} became isolated`
            );
        }

        this.startCountdown();
    }

    startCountdown() {
        console.log('SceneNetworkUpdate: Starting countdown');

        this.countdown = 3;
        this.continueButtonText.setText(`Continue (${this.countdown})`);

        this.countdownTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.countdown--;

                if (this.countdown > 0) {
                    this.continueButtonText.setText(`Continue (${this.countdown})`);
                } else {
                    this.continueButtonText.setText('Continue');
                    this.continueButton.setInteractive({ cursor: 'pointer' });
                    this.continueButton.setAlpha(1);

                    if (this.countdownTimer) {
                        this.countdownTimer.remove();
                        this.countdownTimer = null;
                    }
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    handleContinue() {
        console.log('SceneNetworkUpdate: Continue clicked');

        this.continueButton.disableInteractive();
        this.continueButton.setAlpha(0.5);
        this.continueButtonText.setText('Waiting...');

        if (this.countdownTimer) {
            this.countdownTimer.remove();
            this.countdownTimer = null;
        }

        window.socket.emit('scene_complete', {
            scene: 'SceneNetworkUpdate',
            roundNumber: this.roundNumber,
            sessionId: window.sessionId,
            roomId: window.roomId
        });
    }

    shutdown() {
        if (this.countdownTimer) {
            this.countdownTimer.remove();
            this.countdownTimer = null;
        }

        if (this.networkListener) {
            window.socket.off('network_summary', this.networkListener);
        }
    }
}
