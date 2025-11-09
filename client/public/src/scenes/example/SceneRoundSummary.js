// SceneFinalSummary - Final summary screen showing all trials and final payment
// Displays trial history, total points, and payment information

class SceneFinalSummary extends Phaser.Scene {

    constructor() {
        super({ key: 'SceneFinalSummary', active: false });
    }

    preload() {
    }

    init(data) {
        console.log('SceneFinalSummary.init() received data:', data);

        this.trialHistory = data.trialHistory || [];
        this.totalPoints = data.totalPoints || 0;
        this.finalPayment = data.finalPayment || '£0.00';
        this.totalTrials = data.totalTrials || 3;
    }

    create() {
        console.log('SceneFinalSummary.create()');
        console.log('Trial history:', this.trialHistory);
        console.log('Total points:', this.totalPoints);
        console.log('Final payment:', this.finalPayment);

        // Background
        this.cameras.main.setBackgroundColor('#FFFFFF');

        // Title
        const title = this.add.text(400, 40, 'Experiment Complete!', {
            fontSize: '36px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Subtitle
        const subtitle = this.add.text(400, 85, 'Here is a summary of your performance', {
            fontSize: '20px',
            fill: '#666'
        }).setOrigin(0.5);

        // Trial history table
        const tableY = 130;
        const rowHeight = 35;
        const colWidths = [80, 120, 120, 100];
        const tableX = 400 - (colWidths.reduce((a, b) => a + b, 0) / 2);

        // Table headers
        const headers = ['Round', 'Your Choice', 'Partner Choice', 'Your Points'];
        const headerStyle = { fontSize: '16px', fill: '#333', fontStyle: 'bold' };

        let currentX = tableX;
        headers.forEach((header, i) => {
            const headerBg = this.add.rectangle(
                currentX + colWidths[i] / 2,
                tableY + rowHeight / 2,
                colWidths[i] - 5,
                rowHeight - 5,
                0xE0E0E0
            );

            this.add.text(
                currentX + colWidths[i] / 2,
                tableY + rowHeight / 2,
                header,
                headerStyle
            ).setOrigin(0.5);

            currentX += colWidths[i];
        });

        // Choice labels
        const choiceLabels = ['Cooperate', 'Defect', 'No choice'];
        const choiceColors = { 0: '#4CAF50', 1: '#F44336', null: '#999' };

        // Table rows
        const rowStyle = { fontSize: '16px', fill: '#333' };
        this.trialHistory.forEach((trial, index) => {
            const rowY = tableY + (index + 1) * rowHeight;
            currentX = tableX;

            // Row background (alternating colors)
            const rowBg = this.add.rectangle(
                400,
                rowY + rowHeight / 2,
                colWidths.reduce((a, b) => a + b, 0),
                rowHeight - 5,
                index % 2 === 0 ? 0xF5F5F5 : 0xFFFFFF
            );

            // Round number
            this.add.text(
                currentX + colWidths[0] / 2,
                rowY + rowHeight / 2,
                `${trial.trial}`,
                rowStyle
            ).setOrigin(0.5);
            currentX += colWidths[0];

            // Your choice
            const myChoiceLabel = trial.myChoice !== null && trial.myChoice !== undefined
                ? choiceLabels[trial.myChoice]
                : choiceLabels[2];
            const myChoiceColor = choiceColors[trial.myChoice] || choiceColors[null];

            this.add.text(
                currentX + colWidths[1] / 2,
                rowY + rowHeight / 2,
                myChoiceLabel,
                { ...rowStyle, fill: myChoiceColor, fontStyle: 'bold' }
            ).setOrigin(0.5);
            currentX += colWidths[1];

            // Partner choice
            const partnerChoiceLabel = trial.partnerChoice !== null && trial.partnerChoice !== undefined
                ? choiceLabels[trial.partnerChoice]
                : choiceLabels[2];
            const partnerChoiceColor = choiceColors[trial.partnerChoice] || choiceColors[null];

            this.add.text(
                currentX + colWidths[2] / 2,
                rowY + rowHeight / 2,
                partnerChoiceLabel,
                { ...rowStyle, fill: partnerChoiceColor, fontStyle: 'bold' }
            ).setOrigin(0.5);
            currentX += colWidths[2];

            // Your points
            this.add.text(
                currentX + colWidths[3] / 2,
                rowY + rowHeight / 2,
                `${trial.myPayoff || 0}`,
                { ...rowStyle, fill: '#1976D2', fontStyle: 'bold' }
            ).setOrigin(0.5);
        });

        // Summary section
        const summaryY = tableY + (this.trialHistory.length + 1) * rowHeight + 40;

        // Divider line
        const divider = this.add.graphics();
        divider.lineStyle(2, 0xCCCCCC, 1);
        divider.lineBetween(200, summaryY - 20, 600, summaryY - 20);

        // Total points
        this.add.text(400, summaryY, `Total Points Earned: ${this.totalPoints}`, {
            fontSize: '28px',
            fill: '#4CAF50',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Final payment
        this.add.text(400, summaryY + 45, `Final Payment: ${this.finalPayment}`, {
            fontSize: '26px',
            fill: '#1976D2',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Thank you message
        this.add.text(400, summaryY + 90, 'Thank you for participating!', {
            fontSize: '20px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Continue button
        const buttonY = 530;
        const continueButton = this.add.rectangle(400, buttonY, 250, 60, 0x4CAF50)
            .setInteractive({ cursor: 'pointer' });

        const continueText = this.add.text(400, buttonY, 'Continue to Survey', {
            fontSize: '22px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Button hover effect
        continueButton.on('pointerover', () => {
            continueButton.setFillStyle(0x45a049);
        });

        continueButton.on('pointerout', () => {
            continueButton.setFillStyle(0x4CAF50);
        });

        // Button click - emit scene complete
        continueButton.on('pointerdown', () => {
            console.log('Final summary viewed, emitting scene_complete');

            window.socket.emit('scene_complete', {
                sessionId: window.sessionId,
                roomId: window.roomId,
                subjectId: window.subjectId,
                scene: 'SceneFinalSummary'
            });

            // Disable button to prevent double-clicks
            continueButton.disableInteractive();
            continueText.setText('Waiting...');
        });
    }
}

export default SceneFinalSummary;
