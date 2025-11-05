// ScenePDChoice - Prisoner's Dilemma Choice Scene
// Displays two buttons: Cooperate and Defect
// Waits for player to make choice within time limit

class ScenePDChoice extends Phaser.Scene {

    constructor() {
        super({ key: 'ScenePDChoice', active: false });
        this.choiceMade = false;
        this.selectedChoice = null;
    }

    preload() {
    }

    init(data) {
        this.trial = data.trial || 1;
        this.totalTrials = data.totalTrials || 3;
        this.maxChoiceTime = data.maxChoiceTime || 10000;
        this.showTimer = data.showTimer !== undefined ? data.showTimer : true;

        // Reset choice state
        this.choiceMade = false;
        this.selectedChoice = null;
    }

    create() {
        console.log('ScenePDChoice.create() - trial:', this.trial, 'totalTrials:', this.totalTrials);

        // Background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        // Title
        const titleText = `Round ${this.trial} of ${this.totalTrials}`;
        const title = this.add.text(400, 80, titleText, {
            fontSize: '32px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions
        const instructions = this.add.text(400, 150, 'Make your choice:', {
            fontSize: '24px',
            fill: '#333'
        }).setOrigin(0.5);

        // Choice buttons
        const buttonY = 300;
        const buttonSpacing = 220;
        const buttonWidth = 180;
        const buttonHeight = 100;

        // Cooperate button (left)
        const cooperateButton = this.add.rectangle(
            400 - buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0x4CAF50
        ).setInteractive({ cursor: 'pointer' });

        const cooperateText = this.add.text(
            400 - buttonSpacing / 2,
            buttonY,
            'Cooperate',
            { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }
        ).setOrigin(0.5);

        // Defect button (right)
        const defectButton = this.add.rectangle(
            400 + buttonSpacing / 2,
            buttonY,
            buttonWidth,
            buttonHeight,
            0xF44336
        ).setInteractive({ cursor: 'pointer' });

        const defectText = this.add.text(
            400 + buttonSpacing / 2,
            buttonY,
            'Defect',
            { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' }
        ).setOrigin(0.5);

        // Timer bar (if enabled)
        let timerBox, timerBar, timerText;
        if (this.showTimer) {
            timerBox = this.add.graphics();
            timerBox.fillStyle(0x000000, 0.3);
            timerBox.fillRect(250, 450, 300, 30);

            timerBar = this.add.graphics();

            timerText = this.add.text(400, 500, 'Time remaining: 10s', {
                fontSize: '18px',
                fill: '#666'
            }).setOrigin(0.5);
        }

        // Waiting message (shown after choice)
        const waitingText = this.add.text(400, 520, 'Waiting for your partner...', {
            fontSize: '20px',
            fill: '#FF9800',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        waitingText.visible = false;

        // Timestamp for reaction time
        const timeCreated = new Date();

        // Handle choice selection
        const handleChoice = (choiceId, choiceName, button, otherButton) => {
            if (this.choiceMade) return;

            this.choiceMade = true;
            this.selectedChoice = choiceId;

            // Visual feedback
            button.setFillStyle(choiceId === 0 ? 0x45a049 : 0xe53935);
            otherButton.setAlpha(0.3);
            otherButton.disableInteractive();

            // Calculate reaction time
            const reactionTime = new Date() - timeCreated;

            // Show waiting message
            waitingText.visible = true;
            instructions.setText(`You chose: ${choiceName}`);

            // Emit choice to server
            socket.emit('choiceMade', {
                sessionId: sessionId,
                roomId: roomId,
                subjectId: subjectId,
                trial: this.trial,
                optionId: choiceId,
                screenPosition: choiceId,
                reactionTime: reactionTime,
                timestamp: new Date().toISOString()
            });

            console.log('Choice made:', choiceName, 'RT:', reactionTime, 'ms');
        };

        // Button click handlers
        cooperateButton.on('pointerdown', () => {
            handleChoice(0, 'Cooperate', cooperateButton, defectButton);
        });

        defectButton.on('pointerdown', () => {
            handleChoice(1, 'Defect', defectButton, cooperateButton);
        });

        // Hover effects
        cooperateButton.on('pointerover', () => {
            if (!this.choiceMade) cooperateButton.setFillStyle(0x45a049);
        });
        cooperateButton.on('pointerout', () => {
            if (!this.choiceMade) cooperateButton.setFillStyle(0x4CAF50);
        });

        defectButton.on('pointerover', () => {
            if (!this.choiceMade) defectButton.setFillStyle(0xe53935);
        });
        defectButton.on('pointerout', () => {
            if (!this.choiceMade) defectButton.setFillStyle(0xF44336);
        });

        // Timer countdown
        if (this.showTimer) {
            const startTime = this.time.now;
            this.timerEvent = this.time.addEvent({
                delay: 100,
                callback: () => {
                    const elapsed = this.time.now - startTime;
                    const remaining = Math.max(0, this.maxChoiceTime - elapsed);
                    const progress = remaining / this.maxChoiceTime;

                    // Update bar
                    timerBar.clear();
                    timerBar.fillStyle(progress > 0.3 ? 0x00a5ff : 0xff5a00, 1);
                    timerBar.fillRect(255, 455, 290 * progress, 20);

                    // Update text
                    const secondsRemaining = Math.ceil(remaining / 1000);
                    timerText.setText(`Time remaining: ${secondsRemaining}s`);

                    // Timeout
                    if (remaining === 0 && !this.choiceMade) {
                        this.timerEvent.remove();
                        this.handleTimeout();
                    }
                },
                loop: true
            });
        } else {
            // Fallback timeout without visual timer
            this.time.delayedCall(this.maxChoiceTime, () => {
                if (!this.choiceMade) {
                    this.handleTimeout();
                }
            });
        }

        // Listen for server response (handled by main.js socket listener)
        // Scene transition will be triggered by 'start_scene' event
    }

    handleTimeout() {
        console.log('Choice timeout - no selection made');

        // Emit timeout event
        socket.emit('choiceMade', {
            sessionId: sessionId,
            roomId: roomId,
            subjectId: subjectId,
            trial: this.trial,
            optionId: null,
            screenPosition: null,
            reactionTime: this.maxChoiceTime,
            timestamp: new Date().toISOString(),
            wasTimeout: true
        });
    }

    shutdown() {
        // Clean up timer
        if (this.timerEvent) {
            this.timerEvent.remove();
        }
    }
}

export default ScenePDChoice;
