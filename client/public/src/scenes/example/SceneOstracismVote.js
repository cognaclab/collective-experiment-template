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
        this.roundNumber = data.roundNumber || 5;
        this.totalRounds = data.totalRounds || 30;

        this.ostracismData = null;
        this.voteSubmitted = false;
        this.showingConfirmation = false;
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        this.add.text(centerX, 60, 'Connection Decision', {
            fontSize: '36px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(centerX, 110, `Round ${this.roundNumber}`, {
            fontSize: '20px',
            fill: '#555'
        }).setOrigin(0.5);

        this.statusText = this.add.text(centerX, 160, 'Waiting for round results...', {
            fontSize: '18px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        this.outcomePanel = this.add.container(centerX, 270);
        this.outcomePanel.setVisible(false);

        const outcomeBg = this.add.rectangle(0, 0, 700, 180, 0xF5F5F5);
        outcomeBg.setStrokeStyle(2, 0xCCCCCC);

        this.partnerNameText = this.add.text(0, -70, '', {
            fontSize: '24px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.outcomeText = this.add.text(0, -30, '', {
            fontSize: '18px',
            fill: '#333',
            align: 'center'
        }).setOrigin(0.5);

        this.payoffText = this.add.text(0, 10, '', {
            fontSize: '18px',
            fill: '#333',
            align: 'center'
        }).setOrigin(0.5);

        this.historyText = this.add.text(0, 60, '', {
            fontSize: '16px',
            fill: '#555',
            align: 'center'
        }).setOrigin(0.5);

        this.outcomePanel.add([
            outcomeBg,
            this.partnerNameText,
            this.outcomeText,
            this.payoffText,
            this.historyText
        ]);

        this.warningText = this.add.text(centerX, 380, '⚠️ Breaking a connection is permanent and cannot be undone', {
            fontSize: '16px',
            fill: '#F44336',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);
        this.warningText.setVisible(false);

        const buttonY = 460;
        const buttonWidth = 260;
        const buttonHeight = 60;
        const buttonSpacing = 40;

        this.maintainButton = this.add.rectangle(
            centerX - buttonWidth / 2 - buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x4CAF50
        );
        this.maintainButton.setStrokeStyle(3, 0x45A049);
        this.maintainButton.setAlpha(0.5);

        this.maintainButtonText = this.add.text(
            centerX - buttonWidth / 2 - buttonSpacing / 2,
            buttonY,
            'Continue\nPartnership',
            {
                fontSize: '20px',
                fill: '#FFF',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5);

        this.breakButton = this.add.rectangle(
            centerX + buttonWidth / 2 + buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0xF44336
        );
        this.breakButton.setStrokeStyle(3, 0xD32F2F);
        this.breakButton.setAlpha(0.5);

        this.breakButtonText = this.add.text(
            centerX + buttonWidth / 2 + buttonSpacing / 2,
            buttonY,
            'Break\nConnection',
            {
                fontSize: '20px',
                fill: '#FFF',
                fontStyle: 'bold',
                align: 'center'
            }
        ).setOrigin(0.5);

        this.maintainButton.on('pointerover', () => {
            if (this.maintainButton.input && this.maintainButton.input.enabled) {
                this.maintainButton.setFillStyle(0x45A049);
            }
        });

        this.maintainButton.on('pointerout', () => {
            if (this.maintainButton.input && this.maintainButton.input.enabled) {
                this.maintainButton.setFillStyle(0x4CAF50);
            }
        });

        this.maintainButton.on('pointerdown', () => {
            this.handleVote('maintain');
        });

        this.breakButton.on('pointerover', () => {
            if (this.breakButton.input && this.breakButton.input.enabled) {
                this.breakButton.setFillStyle(0xD32F2F);
            }
        });

        this.breakButton.on('pointerout', () => {
            if (this.breakButton.input && this.breakButton.input.enabled) {
                this.breakButton.setFillStyle(0xF44336);
            }
        });

        this.breakButton.on('pointerdown', () => {
            this.handleVote('break');
        });

        this.confirmationModal = this.add.container(centerX, centerY);
        this.confirmationModal.setVisible(false);

        const overlay = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.7);
        overlay.setOrigin(0.5);

        const modalBg = this.add.rectangle(0, 0, 500, 300, 0xFFFFFF);
        modalBg.setStrokeStyle(3, 0xF44336);

        const modalTitle = this.add.text(0, -100, 'Confirm Break Connection', {
            fontSize: '24px',
            fill: '#F44336',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.confirmationText = this.add.text(0, -30, '', {
            fontSize: '18px',
            fill: '#333',
            align: 'center',
            wordWrap: { width: 450 }
        }).setOrigin(0.5);

        const confirmYesButton = this.add.rectangle(-120, 80, 200, 50, 0xF44336)
            .setInteractive({ cursor: 'pointer' });

        const confirmYesText = this.add.text(-120, 80, 'Yes, Break', {
            fontSize: '20px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const confirmNoButton = this.add.rectangle(120, 80, 200, 50, 0x757575)
            .setInteractive({ cursor: 'pointer' });

        const confirmNoText = this.add.text(120, 80, 'Cancel', {
            fontSize: '20px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        confirmYesButton.on('pointerover', () => confirmYesButton.setFillStyle(0xD32F2F));
        confirmYesButton.on('pointerout', () => confirmYesButton.setFillStyle(0xF44336));
        confirmYesButton.on('pointerdown', () => this.confirmBreak());

        confirmNoButton.on('pointerover', () => confirmNoButton.setFillStyle(0x616161));
        confirmNoButton.on('pointerout', () => confirmNoButton.setFillStyle(0x757575));
        confirmNoButton.on('pointerdown', () => this.cancelConfirmation());

        this.confirmationModal.add([
            overlay,
            modalBg,
            modalTitle,
            this.confirmationText,
            confirmYesButton,
            confirmYesText,
            confirmNoButton,
            confirmNoText
        ]);

        this.ostracismListener = (data) => {
            if (!this.scene.isActive('SceneOstracismVote')) return;
            this.handleOstracismPrompt(data);
        };

        this.completeListener = (data) => {
            if (!this.scene.isActive('SceneOstracismVote')) return;
            this.handleOstracismComplete(data);
        };

        window.socket.off('ostracism_prompt', this.ostracismListener);
        window.socket.on('ostracism_prompt', this.ostracismListener);

        window.socket.off('ostracism_complete', this.completeListener);
        window.socket.on('ostracism_complete', this.completeListener);

        console.log('SceneOstracismVote: Waiting for ostracism prompt');
    }

    handleOstracismPrompt(data) {
        console.log('SceneOstracismVote: Received ostracism prompt', data);

        this.ostracismData = data;

        this.statusText.setText('Review your interaction with your partner');
        this.statusText.setStyle({ fontStyle: 'normal' });

        this.outcomePanel.setVisible(true);

        const partnerLabel = data.partnerSubjectId || `Player ${data.partnerNumber || '?'}`;
        this.partnerNameText.setText(`You played with ${partnerLabel}`);

        const choiceLabels = ['Cooperate', 'Defect'];
        const playerChoice = choiceLabels[data.roundOutcome.playerChoice] || 'Unknown';
        const partnerChoice = choiceLabels[data.roundOutcome.partnerChoice] || 'Unknown';

        const playerColor = data.roundOutcome.playerChoice === 0 ? '#4CAF50' : '#F44336';
        const partnerColor = data.roundOutcome.partnerChoice === 0 ? '#4CAF50' : '#F44336';

        this.outcomeText.setText(
            `You chose: ${playerChoice}  |  Partner chose: ${partnerChoice}`
        );

        this.payoffText.setText(
            `You earned: ${data.roundOutcome.playerPayoff} points  |  ` +
            `Partner earned: ${data.roundOutcome.partnerPayoff} points`
        );

        if (data.cooperationHistory) {
            const cooperations = data.cooperationHistory.cooperations || 0;
            const total = data.cooperationHistory.totalInteractions || 1;
            const rate = Math.round((cooperations / total) * 100);

            this.historyText.setText(
                `Over ${total} round${total !== 1 ? 's' : ''} with this partner, ` +
                `they cooperated ${cooperations}/${total} times (${rate}%)`
            );

            const historyColor = rate >= 70 ? '#4CAF50' : rate >= 40 ? '#FF9800' : '#F44336';
            this.historyText.setStyle({ fill: historyColor });
        }

        this.warningText.setVisible(true);

        this.maintainButton.setInteractive({ cursor: 'pointer' });
        this.maintainButton.setAlpha(1);

        this.breakButton.setInteractive({ cursor: 'pointer' });
        this.breakButton.setAlpha(1);
    }

    handleVote(vote) {
        if (this.voteSubmitted) return;

        console.log('SceneOstracismVote: Vote selected:', vote);

        if (vote === 'break') {
            this.showConfirmation();
        } else {
            this.submitVote(vote);
        }
    }

    showConfirmation() {
        console.log('SceneOstracismVote: Showing break confirmation');

        this.showingConfirmation = true;

        const partnerLabel = this.ostracismData.partnerSubjectId ||
            `Player ${this.ostracismData.partnerNumber || '?'}`;

        this.confirmationText.setText(
            `Are you sure you want to permanently break your connection with ${partnerLabel}?\n\n` +
            `This action cannot be undone. You will never be paired with this player again.`
        );

        this.confirmationModal.setVisible(true);
        this.confirmationModal.setDepth(1000);
    }

    confirmBreak() {
        console.log('SceneOstracismVote: Break confirmed');

        this.confirmationModal.setVisible(false);
        this.showingConfirmation = false;

        this.submitVote('break');
    }

    cancelConfirmation() {
        console.log('SceneOstracismVote: Break cancelled');

        this.confirmationModal.setVisible(false);
        this.showingConfirmation = false;
    }

    submitVote(vote) {
        if (this.voteSubmitted) return;

        console.log('SceneOstracismVote: Submitting vote:', vote);

        this.voteSubmitted = true;

        this.maintainButton.disableInteractive();
        this.maintainButton.setAlpha(0.5);

        this.breakButton.disableInteractive();
        this.breakButton.setAlpha(0.5);

        this.statusText.setText('Vote submitted. Waiting for other players...');
        this.statusText.setStyle({ fill: '#4CAF50', fontStyle: 'italic' });

        window.socket.emit('ostracism_vote', {
            sessionId: window.sessionId,
            roomId: window.roomId,
            partnerId: this.ostracismData.partnerId,
            partnerSubjectId: this.ostracismData.partnerSubjectId,
            vote: vote,
            roundNumber: this.roundNumber
        });
    }

    handleOstracismComplete(data) {
        console.log('SceneOstracismVote: Ostracism complete', data);

        this.statusText.setText('All votes recorded');

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
        if (this.ostracismListener) {
            window.socket.off('ostracism_prompt', this.ostracismListener);
        }
        if (this.completeListener) {
            window.socket.off('ostracism_complete', this.completeListener);
        }
    }
}
