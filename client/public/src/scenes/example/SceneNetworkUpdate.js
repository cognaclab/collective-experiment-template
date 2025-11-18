/**
 * SceneNetworkUpdate - Network change summary display
 * Shows results of ostracism voting and updated network state
 * Part of Network-Embedded Dyadic Prisoner's Dilemma experiment
 */

export default class SceneNetworkUpdate extends Phaser.Scene {
    constructor() {
        super({ key: 'SceneNetworkUpdate' });
    }

    init(data) {
        this.roundNumber = data.roundNumber || 5;
        this.totalRounds = data.totalRounds || 30;

        this.networkData = null;
        this.countdown = 3;
        this.countdownTimer = null;
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

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

        this.changeSummaryText = this.add.text(0, -120, '', {
            fontSize: '20px',
            fill: '#333',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.networkStatsText = this.add.text(0, -70, '', {
            fontSize: '16px',
            fill: '#555',
            align: 'center'
        }).setOrigin(0.5);

        this.playerStatusText = this.add.text(0, -20, '', {
            fontSize: '18px',
            fill: '#2196F3',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        this.availablePartnersText = this.add.text(0, 30, '', {
            fontSize: '16px',
            fill: '#333',
            align: 'center',
            wordWrap: { width: 650 }
        }).setOrigin(0.5);

        this.removedConnectionsText = this.add.text(0, 85, '', {
            fontSize: '16px',
            fill: '#F44336',
            align: 'center',
            wordWrap: { width: 650 }
        }).setOrigin(0.5);

        this.isolatedPlayersText = this.add.text(0, 125, '', {
            fontSize: '16px',
            fill: '#FF9800',
            fontStyle: 'italic',
            align: 'center',
            wordWrap: { width: 650 }
        }).setOrigin(0.5);

        this.summaryPanel.add([
            panelBg,
            this.changeSummaryText,
            this.networkStatsText,
            this.playerStatusText,
            this.availablePartnersText,
            this.removedConnectionsText,
            this.isolatedPlayersText
        ]);

        const densityBarWidth = 400;
        const densityBarX = centerX - densityBarWidth / 2;
        const densityBarY = 420;

        this.add.text(centerX, 395, 'Network Density:', {
            fontSize: '16px',
            fill: '#555'
        }).setOrigin(0.5);

        this.add.graphics()
            .fillStyle(0xE0E0E0, 1)
            .fillRect(densityBarX, densityBarY, densityBarWidth, 20);

        this.densityBar = this.add.graphics();
        this.densityBar.setVisible(false);

        this.densityText = this.add.text(centerX, densityBarY + 10, '', {
            fontSize: '14px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.densityText.setVisible(false);

        this.continueButton = this.add.rectangle(centerX, 500, 250, 50, 0x2196F3);
        this.continueButton.setAlpha(0.5);

        this.continueButtonText = this.add.text(centerX, 500, 'Continue (3)', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.continueButton.on('pointerover', () => {
            if (this.continueButton.input && this.continueButton.input.enabled) {
                this.continueButton.setFillStyle(0x1976D2);
            }
        });

        this.continueButton.on('pointerout', () => {
            if (this.continueButton.input && this.continueButton.input.enabled) {
                this.continueButton.setFillStyle(0x2196F3);
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

        console.log('SceneNetworkUpdate: Waiting for network summary');
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
        this.statusText.setStyle({ fill: '#F44336', fontStyle: 'normal', fontSize: '22px' });

        this.summaryPanel.setVisible(true);

        this.changeSummaryText.setText('No remaining connections');
        this.changeSummaryText.setStyle({ fill: '#F44336' });

        this.playerStatusText.setText('You will sit out the remaining rounds');
        this.playerStatusText.setStyle({ fill: '#F44336' });

        this.networkStatsText.setText('');
        this.availablePartnersText.setText('');
        this.removedConnectionsText.setText('');
        this.isolatedPlayersText.setText('');

        this.continueButtonText.setText('Continue');
        this.continueButton.setInteractive({ cursor: 'pointer' });
        this.continueButton.setAlpha(1);
    }

    displayNetworkUpdate(data) {
        console.log('SceneNetworkUpdate: Displaying network update');

        this.statusText.setText('Network has been updated');
        this.statusText.setStyle({ fill: '#4CAF50', fontStyle: 'normal' });

        this.summaryPanel.setVisible(true);

        const edgesRemoved = data.edgesRemoved || 0;
        if (edgesRemoved === 0) {
            this.changeSummaryText.setText('No connections were broken this round');
            this.changeSummaryText.setStyle({ fill: '#4CAF50' });
        } else {
            this.changeSummaryText.setText(
                `${edgesRemoved} connection${edgesRemoved !== 1 ? 's were' : ' was'} broken`
            );
            this.changeSummaryText.setStyle({ fill: '#FF9800' });
        }

        const totalEdges = data.totalEdgesRemaining || 0;
        const density = data.networkDensity || 0;
        const densityPercent = Math.round(density * 100);

        this.networkStatsText.setText(
            `${totalEdges} total connection${totalEdges !== 1 ? 's' : ''} remaining across network\n` +
            `Network density: ${densityPercent}%`
        );

        if (data.playerStatus) {
            const connections = data.playerStatus.currentConnections || 0;
            this.playerStatusText.setText(
                `You have ${connections} active connection${connections !== 1 ? 's' : ''}`
            );

            if (data.playerStatus.availablePartners && data.playerStatus.availablePartners.length > 0) {
                const partners = data.playerStatus.availablePartners
                    .map(p => p.subjectId || `Player ${p.number || '?'}`)
                    .join(', ');
                this.availablePartnersText.setText(`Can be paired with: ${partners}`);
            } else if (connections > 0) {
                this.availablePartnersText.setText('Partner list available in next round');
            }
        }

        if (data.removedConnections && data.removedConnections.length > 0) {
            const removed = data.removedConnections
                .map(p => p.subjectId || `Player ${p.number || '?'}`)
                .join(', ');
            this.removedConnectionsText.setText(`Lost connection${data.removedConnections.length !== 1 ? 's' : ''} with: ${removed}`);
        }

        if (data.isolatedPlayers && data.isolatedPlayers.length > 0) {
            const isolated = data.isolatedPlayers
                .map(p => p.subjectId || `Player ${p.number || '?'}`)
                .join(', ');
            this.isolatedPlayersText.setText(
                `${isolated} became isolated and will sit out remaining rounds`
            );
        }

        this.densityBar.setVisible(true);
        this.densityText.setVisible(true);

        const densityBarWidth = 400;
        const densityBarX = this.cameras.main.width / 2 - densityBarWidth / 2;
        const densityBarY = 420;

        const densityColor = density >= 0.7 ? 0x4CAF50 : density >= 0.4 ? 0xFF9800 : 0xF44336;

        this.densityBar.clear();
        this.densityBar.fillStyle(densityColor, 1);
        this.densityBar.fillRect(densityBarX, densityBarY, densityBarWidth * density, 20);

        this.densityText.setText(`${densityPercent}%`);

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
