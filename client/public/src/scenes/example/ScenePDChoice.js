// ScenePDChoice - Prisoner's Dilemma Choice Scene
// Displays two buttons: Cooperate and Defect
// Waits for player to make choice within time limit

class ScenePDChoice extends Phaser.Scene {

    constructor() {
        super({ key: 'ScenePDChoice', active: false });
        this.choiceConfirmed = false;
        this.selectedChoice = null;
    }

    preload() {
    }

    init(data) {
        console.log('ScenePDChoice.init() received data:', data);
        this.trial = data.trial || 1;
        this.totalTrials = data.totalTrials || 6;  // Default: 3 rounds × 2 turns
        this.maxChoiceTime = data.maxChoiceTime || 10000;
        this.showTimer = data.showTimer !== undefined ? data.showTimer : true;

        // Round/turn structure
        this.gameRound = data.gameRound || 1;
        this.turnWithinRound = data.turnWithinRound || 1;
        this.turnsPerRound = data.turnsPerRound || 2;
        this.totalRounds = data.totalRounds || 3;

        // Partner info (same partner for all turns in a round)
        this.partnerId = data.partnerId;
        this.partnerSubjectId = data.partnerSubjectId;
        this.showPartner = data.showPartner !== undefined ? data.showPartner : true;

        console.log('ScenePDChoice.init() - maxChoiceTime set to:', this.maxChoiceTime);
        console.log('ScenePDChoice.init() - Round', this.gameRound, 'Turn', this.turnWithinRound, 'of', this.turnsPerRound);

        // Reset choice state
        this.choiceConfirmed = false;
        this.selectedChoice = null;
    }

    create() {
        console.log('ScenePDChoice.create() - trial:', this.trial, 'totalTrials:', this.totalTrials);

        // Background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        // Title - conditional based on experiment type
        let titleText;
        if (this.turnsPerRound > 1) {
            // Networked PD with turn structure
            titleText = `Round ${this.gameRound} - Turn ${this.turnWithinRound} of ${this.turnsPerRound}`;
        } else {
            // Simple PD without turns
            titleText = `Trial ${this.trial} of ${this.totalTrials}`;
        }
        const title = this.add.text(400, 60, titleText, {
            fontSize: '32px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Show partner info if available (only for networked PD)
        if (this.turnsPerRound > 1 && this.showPartner && this.partnerSubjectId) {
            this.add.text(400, 100, `Playing with: ${this.partnerSubjectId}`, {
                fontSize: '20px',
                fill: '#2196F3',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // Show remaining turns info (only for networked PD with turns)
        if (this.turnsPerRound > 1) {
            const turnsRemaining = this.turnsPerRound - this.turnWithinRound;
            if (turnsRemaining > 0) {
                this.add.text(400, 130, `${turnsRemaining} turn${turnsRemaining !== 1 ? 's' : ''} remaining with this partner`, {
                    fontSize: '16px',
                    fill: '#666',
                    fontStyle: 'italic'
                }).setOrigin(0.5);
            }
        }

        // Instructions
        const instructions = this.add.text(400, 170, 'Make your choice:', {
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

            const initialSeconds = Math.ceil(this.maxChoiceTime / 1000);
            timerText = this.add.text(400, 500, `Time remaining: ${initialSeconds}s`, {
                fontSize: '18px',
                fill: '#666'
            }).setOrigin(0.5);
        }

        // Confirmation button (shown after selection, hidden initially)
        const confirmButton = this.add.rectangle(400, 400, 200, 60, 0x2196F3)
            .setInteractive({ cursor: 'pointer' })
            .setVisible(false);

        const confirmText = this.add.text(400, 400, 'Click to Confirm', {
            fontSize: '20px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5).setVisible(false);

        // Waiting message (shown after confirmation)
        const waitingText = this.add.text(400, 520, 'Waiting for other players...', {
            fontSize: '20px',
            fill: '#FF9800',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        waitingText.visible = false;

        // Timestamp for reaction time
        const timeCreated = new Date();
        let selectionTime = null;

        // Step 1: Handle choice selection (allows changing selection before confirmation)
        const selectChoice = (choiceId, choiceName, button, otherButton) => {
            // Allow changing selection - reset both buttons to normal state first
            if (this.selectedChoice !== null) {
                cooperateButton.setFillStyle(0x4CAF50);
                defectButton.setFillStyle(0xF44336);
                cooperateButton.setAlpha(1);
                defectButton.setAlpha(1);
            }

            this.selectedChoice = choiceId;
            selectionTime = new Date();

            // Visual feedback - highlight selected button
            button.setFillStyle(choiceId === 0 ? 0x45a049 : 0xe53935);
            otherButton.setAlpha(0.5);

            // Update instructions
            instructions.setText(`You selected: ${choiceName}`);

            // Show confirmation button
            confirmButton.setVisible(true);
            confirmText.setVisible(true);

            console.log('Choice selected:', choiceName);
        };

        // Step 2: Handle confirmation (second click or confirm button)
        const confirmChoice = () => {
            if (this.choiceConfirmed || this.selectedChoice === null) return;

            this.choiceConfirmed = true;

            const choiceName = this.selectedChoice === 0 ? 'Cooperate' : 'Defect';

            // Disable all interactive elements
            cooperateButton.disableInteractive();
            defectButton.disableInteractive();
            confirmButton.disableInteractive();
            confirmButton.setVisible(false);
            confirmText.setVisible(false);

            // Calculate reaction time from initial scene load
            const reactionTime = new Date() - timeCreated;

            // Stop choice timer
            if (this.timerEvent) {
                this.timerEvent.remove();
                this.timerEvent = null;
            }

            // Show waiting message (no countdown - server will notify when all ready)
            waitingText.visible = true;
            instructions.setText(`You chose: ${choiceName}`);

            if (this.showTimer) {
                timerText.setVisible(false);
                timerBar.clear();
            }

            // Detect experiment type and emit appropriate event
            // Check for networked_pd taskType or group mode (indivOrGroup=1 is group)
            const isNetworkedPD = window.taskType === 'networked_pd' || (indivOrGroup === 1 && window.taskType !== 'prisoners_dilemma');
            const eventName = isNetworkedPD ? 'networked_pd_choice' : 'choice made';

            const eventData = {
                sessionId: window.sessionId,
                roomId: window.roomId,
                subjectId: window.subjectId,
                roundNumber: this.trial,
                choice: this.selectedChoice,
                reactionTime: reactionTime,
                timestamp: new Date().toISOString(),
                hadClickedBeforeTimeout: true,
                timedOut: false
            };

            if (!isNetworkedPD) {
                eventData.num_choice = this.selectedChoice;
                eventData.chosenOptionLocation = this.selectedChoice;
                eventData.thisTrial = this.trial;
                eventData.individual_payoff = 0;
                eventData.prob_means = [];
            }

            window.socket.emit(eventName, eventData);

            console.log('Choice confirmed:', choiceName, 'RT:', reactionTime, 'ms');
        };

        // Button click handlers - selection (first click)
        cooperateButton.on('pointerdown', () => {
            selectChoice(0, 'Cooperate', cooperateButton, defectButton);
        });

        defectButton.on('pointerdown', () => {
            selectChoice(1, 'Defect', defectButton, cooperateButton);
        });

        // Confirmation button click handler
        confirmButton.on('pointerdown', () => {
            confirmChoice();
        });

        // Hover effects for choice buttons
        cooperateButton.on('pointerover', () => {
            if (this.selectedChoice === null) cooperateButton.setFillStyle(0x45a049);
        });
        cooperateButton.on('pointerout', () => {
            if (this.selectedChoice === null) cooperateButton.setFillStyle(0x4CAF50);
        });

        defectButton.on('pointerover', () => {
            if (this.selectedChoice === null) defectButton.setFillStyle(0xe53935);
        });
        defectButton.on('pointerout', () => {
            if (this.selectedChoice === null) defectButton.setFillStyle(0xF44336);
        });

        // Hover effects for confirm button
        confirmButton.on('pointerover', () => {
            confirmButton.setFillStyle(0x1976D2);
        });
        confirmButton.on('pointerout', () => {
            confirmButton.setFillStyle(0x2196F3);
        });

        // Timer countdown
        if (this.showTimer) {
            this.timeLeft = Math.ceil(this.maxChoiceTime / 1000);

            this.timerEvent = this.time.addEvent({
                delay: 1000,
                callback: () => {
                    // Guard to prevent negative countdown
                    if (this.timeLeft > 0) {
                        this.timeLeft--;
                    }

                    const secondsRemaining = Math.max(0, this.timeLeft);
                    timerText.setText(`Time remaining: ${secondsRemaining}s`);

                    // Update progress bar
                    const progress = this.timeLeft / Math.ceil(this.maxChoiceTime / 1000);
                    timerBar.clear();
                    timerBar.fillStyle(progress > 0.3 ? 0x00a5ff : 0xff5a00, 1);
                    timerBar.fillRect(255, 455, 290 * progress, 20);

                    // Timeout
                    if (this.timeLeft <= 0 && !this.choiceConfirmed) {
                        this.timerEvent.remove();
                        this.handleTimeout();
                    }
                },
                callbackScope: this,
                loop: true
            });
        } else {
            // Fallback timeout without visual timer
            this.time.delayedCall(this.maxChoiceTime, () => {
                if (!this.choiceConfirmed) {
                    this.handleTimeout();
                }
            }, [], this);
        }

        // Listen for all players confirming their choices
        window.socket.on('all_choices_confirmed', (data) => {
            console.log('All players confirmed choices, showing 3s countdown');

            // Check if scene is still active and objects exist
            if (!this.scene.isActive() || !waitingText || !waitingText.active) {
                console.log('Scene no longer active or objects destroyed, skipping countdown');
                return;
            }

            // Update message
            waitingText.setText('All choices confirmed!');
            instructions.setText('Proceeding to results...');

            // Show 3-second countdown
            let countdownSeconds = 3;
            if (this.showTimer && timerText && timerText.active) {
                timerText.setText(`Ending in ${countdownSeconds}s`);
                timerBar.clear();
                timerBar.fillStyle(0x4CAF50, 1); // Green for success
                timerBar.fillRect(255, 455, 290, 20);

                this.endingTimerEvent = this.time.addEvent({
                    delay: 1000,
                    callback: () => {
                        // Check if scene and objects still exist before updating
                        if (!this.scene.isActive() || !timerText || !timerText.active) {
                            if (this.endingTimerEvent) {
                                this.endingTimerEvent.remove();
                                this.endingTimerEvent = null;
                            }
                            return;
                        }

                        countdownSeconds--;
                        if (countdownSeconds > 0) {
                            timerText.setText(`Ending in ${countdownSeconds}s`);
                            const progress = countdownSeconds / 3;
                            timerBar.clear();
                            timerBar.fillStyle(0x4CAF50, 1);
                            timerBar.fillRect(255, 455, 290 * progress, 20);
                        } else {
                            timerText.setText('Transitioning...');
                            timerBar.clear();
                        }
                    },
                    callbackScope: this,
                    repeat: 2
                });
            }
        });

        // Listen for pd_result from networked PD handler
        // This stores the result but does NOT trigger transition - we wait for all_pairs_complete
        window.socket.on('pd_result', (data) => {
            console.log('Received pd_result:', data);

            // Store result data for ScenePDResults to access
            window.lastPDResult = data;

            // Check if scene is still active
            if (!this.scene.isActive()) {
                console.log('Scene no longer active, skipping pd_result handling');
                return;
            }

            // Update UI to show result received, waiting for all pairs
            if (waitingText && waitingText.active) {
                waitingText.setText('Results received! Waiting for all players...');
            }
        });

        // Listen for all pairs completing - this triggers the synchronized transition
        window.socket.on('all_pairs_complete', (data) => {
            console.log('All pairs complete, transitioning to results:', data);

            // Store result for ScenePDResults (may override pd_result data with server-confirmed data)
            if (data.resultData) {
                window.lastPDResult = data.resultData;
            }

            // Check if scene is still active
            if (!this.scene.isActive()) {
                console.log('Scene no longer active, skipping all_pairs_complete handling');
                return;
            }

            // Update UI
            if (waitingText && waitingText.active) {
                waitingText.setText('All players ready! Transitioning...');
            }
            if (instructions && instructions.active) {
                instructions.setText('Proceeding to results...');
            }

            // NOW emit scene_complete to trigger synchronized server transition
            window.socket.emit('scene_complete', {
                scene: 'ScenePDChoice',
                roundNumber: data.roundNumber || this.trial,
                sessionId: window.sessionId,
                roomId: window.roomId
            });

            console.log('Emitted scene_complete for ScenePDChoice (synchronized)');
        });
    }

    handleTimeout() {
        console.log('Choice timeout - no selection made');

        // Detect experiment type and emit appropriate event
        // Check for networked_pd taskType or group mode (indivOrGroup=1 is group)
        const isNetworkedPD = window.taskType === 'networked_pd' || (indivOrGroup === 1 && window.taskType !== 'prisoners_dilemma');
        const eventName = isNetworkedPD ? 'networked_pd_choice' : 'choice made';

        const eventData = {
            sessionId: window.sessionId,
            roomId: window.roomId,
            subjectId: window.subjectId,
            roundNumber: this.trial,
            choice: null,
            reactionTime: this.maxChoiceTime,
            timestamp: new Date().toISOString(),
            hadClickedBeforeTimeout: false,
            timedOut: true
        };

        if (!isNetworkedPD) {
            eventData.num_choice = null;
            eventData.chosenOptionLocation = null;
            eventData.thisTrial = this.trial;
            eventData.individual_payoff = 0;
            eventData.prob_means = [];
        }

        window.socket.emit(eventName, eventData);
    }

    shutdown() {
        // Clean up timers
        if (this.timerEvent) {
            this.timerEvent.remove();
        }
        if (this.endingTimerEvent) {
            this.endingTimerEvent.remove();
        }

        // Remove socket listeners to prevent memory leaks
        if (window.socket) {
            window.socket.off('all_choices_confirmed');
            window.socket.off('pd_result');
            window.socket.off('all_pairs_complete');
        }
    }
}

export default ScenePDChoice;
