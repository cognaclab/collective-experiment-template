// SceneFinalSummary - Experiment summary screen showing per-round totals
// Displays round-by-round point totals and final payment for the player

class SceneFinalSummary extends Phaser.Scene {

    constructor() {
        super({ key: 'SceneFinalSummary', active: false });
    }

    preload() {
    }

    init(data) {
        console.log('SceneFinalSummary.init() received data:', data);

        this.roundBreakdown = data.roundBreakdown || [];
        this.totalPoints = data.totalPoints || 0;
        this.finalPayment = data.finalPayment || '£0.00';
        this.totalRounds = data.totalRounds || 1;
    }

    create() {
        console.log('SceneFinalSummary.create()');
        console.log('Round breakdown:', this.roundBreakdown);
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
        const subtitle = this.add.text(400, 85, 'Here is your overall performance', {
            fontSize: '20px',
            fill: '#666'
        }).setOrigin(0.5);

        // Round breakdown table
        const tableY = 130;
        const rowHeight = 40;
        const colWidths = [150, 150];
        const tableX = 400 - (colWidths.reduce((a, b) => a + b, 0) / 2);

        // Table headers
        const headers = ['Round', 'Total Points'];
        const headerStyle = { fontSize: '18px', fill: '#333', fontStyle: 'bold' };

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

        // Table rows - one per round
        const rowStyle = { fontSize: '18px', fill: '#333' };
        this.roundBreakdown.forEach((roundData, index) => {
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
                `Round ${roundData.round}`,
                rowStyle
            ).setOrigin(0.5);
            currentX += colWidths[0];

            // Round points
            this.add.text(
                currentX + colWidths[1] / 2,
                rowY + rowHeight / 2,
                `${roundData.points}`,
                { ...rowStyle, fill: '#1976D2', fontStyle: 'bold' }
            ).setOrigin(0.5);
        });

        // Summary section
        const summaryY = tableY + (this.roundBreakdown.length + 1) * rowHeight + 50;

        // Divider line
        const divider = this.add.graphics();
        divider.lineStyle(3, 0xCCCCCC, 1);
        divider.lineBetween(200, summaryY - 25, 600, summaryY - 25);

        // Total points across all rounds
        this.add.text(400, summaryY, `Total Points: ${this.totalPoints}`, {
            fontSize: '32px',
            fill: '#4CAF50',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Final payment - ONLY show player's own payment
        this.add.text(400, summaryY + 50, `Final Payment: ${this.finalPayment}`, {
            fontSize: '28px',
            fill: '#1976D2',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Thank you message
        this.add.text(400, summaryY + 100, 'Thank you for your participation!', {
            fontSize: '22px',
            fill: '#666',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // Continue button
        const buttonY = 530;
        const continueButton = this.add.rectangle(400, buttonY, 250, 60, 0x4CAF50)
            .setInteractive({ cursor: 'pointer' });

        const continueText = this.add.text(400, buttonY, 'Continue to Questionnaire', {
            fontSize: '20px',
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
