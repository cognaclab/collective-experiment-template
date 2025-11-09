// ScenePDResults - Show both players' choices and payoffs
// Displays what each player chose and how many points they earned

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

        // Data from server (passed via start_scene event)
        this.myChoice = data.myChoice;
        this.partnerChoice = data.partnerChoice;
        this.myPayoff = data.myPayoff;
        this.partnerPayoff = data.partnerPayoff;
        this.totalPoints = data.totalPoints || 0;
        this.wasMiss = data.wasMiss || false;
        this.wasTimeout = data.wasTimeout || false;
    }

    create() {
        console.log('ScenePDResults.create() - trial:', this.trial);
        console.log('My choice:', this.myChoice, 'Partner choice:', this.partnerChoice);
        console.log('My payoff:', this.myPayoff, 'Partner payoff:', this.partnerPayoff);

        // Background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        // Title
        const title = this.add.text(400, 60, `Round ${this.trial} Results`, {
            fontSize: '36px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Choice labels
        const choiceLabels = ['Cooperate', 'Defect'];
        const choiceColors = [0x4CAF50, 0xF44336];

        let yPos = 150;

        // Handle miss/timeout cases
        if (this.wasMiss || this.wasTimeout) {
            const missText = this.add.text(400, 200,
                this.wasMiss ? 'You did not make a choice in time!' : 'You took too long to decide!',
                { fontSize: '24px', fill: '#FF5722', fontStyle: 'bold' }
            ).setOrigin(0.5);

            yPos += 60;
        }

        // Display both players' choices
        if (this.showBothChoices) {
            const leftX = 250;
            const rightX = 550;
            const choiceY = yPos + 80;

            // You section (left)
            this.add.text(leftX, yPos, 'You', {
                fontSize: '28px',
                fill: '#333',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            if (this.myChoice !== null && this.myChoice !== undefined) {
                const myChoiceBox = this.add.rectangle(leftX, choiceY, 160, 80, choiceColors[this.myChoice]);
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
            this.add.text(rightX, yPos, 'Your Partner', {
                fontSize: '28px',
                fill: '#333',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            if (this.partnerChoice !== null && this.partnerChoice !== undefined) {
                const partnerChoiceBox = this.add.rectangle(rightX, choiceY, 160, 80, choiceColors[this.partnerChoice]);
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
                fill: '#1976D2',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Total points accumulated
            const totalY = payoffDetailsY + 60;
            this.add.text(400, totalY, `Your Total: ${this.totalPoints} points`, {
                fontSize: '28px',
                fill: '#4CAF50',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // Continue button
        const buttonY = 500;
        const continueButton = this.add.rectangle(400, buttonY, 200, 60, 0x2196F3)
            .setInteractive({ cursor: 'pointer' });

        const continueText = this.add.text(400, buttonY, 'Continue', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Button hover effect
        continueButton.on('pointerover', () => {
            continueButton.setFillStyle(0x1976D2);
        });

        continueButton.on('pointerout', () => {
            continueButton.setFillStyle(0x2196F3);
        });

        // Button click - emit scene complete
        continueButton.on('pointerdown', () => {
            console.log('Results viewed, emitting scene_complete');

            socket.emit('scene_complete', {
                sessionId: sessionId,
                roomId: roomId,
                subjectId: subjectId,
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
