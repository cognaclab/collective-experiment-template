/**
 * ScenePhaseTransition - Transition screen between experiment phases
 * Shows brief explanation of the next phase and visual example of MFQ scores
 * Used when transitioning from blind to transparent condition
 */

import { PDTheme } from '../../ui/pdTheme.js';

export default class ScenePhaseTransition extends Phaser.Scene {
    constructor() {
        super({ key: 'ScenePhaseTransition' });
    }

    init(data) {
        console.log('ScenePhaseTransition.init() received data:', data);

        this.completedPhaseName = data.completedPhaseName || 'Part 1';
        this.completedPhaseIndex = data.completedPhaseIndex || 0;
        this.nextPhaseName = data.nextPhaseName || 'Part 2';
        this.nextPhaseIndex = data.nextPhaseIndex || 1;
        this.showMFQScoresInNextPhase = data.showMFQScoresInNextPhase || false;
        this.phasePoints = data.phasePoints || 0;
        this.avatarId = data.avatarId || null;
        this.mfqDisplayConfig = data.mfqDisplayConfig || null;
        this.totalPhases = data.totalPhases || 2;
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        this.cameras.main.setBackgroundColor('#FFFFFF');

        let yPosition = 60;

        // Phase completion header
        this.add.text(centerX, yPosition, `${this.completedPhaseName} Complete!`, {
            fontSize: '32px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        yPosition += 50;

        // Points earned in completed phase
        this.add.text(centerX, yPosition, `You earned ${this.phasePoints} points`, {
            fontSize: '22px',
            fill: PDTheme.text.info
        }).setOrigin(0.5);

        yPosition += 60;

        // Divider
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xCCCCCC, 1);
        graphics.lineBetween(centerX - 250, yPosition, centerX + 250, yPosition);

        yPosition += 40;

        // Next phase introduction
        this.add.text(centerX, yPosition, `Starting ${this.nextPhaseName}`, {
            fontSize: '28px',
            fill: '#000',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        yPosition += 45;

        // Explanation text based on whether MFQ scores will be shown
        if (this.showMFQScoresInNextPhase) {
            // Transparent phase explanation
            const explanationText = 'In this part, you will see information about\nyour partner\'s moral values.';
            this.add.text(centerX, yPosition, explanationText, {
                fontSize: '20px',
                fill: '#333',
                align: 'center',
                lineSpacing: 8
            }).setOrigin(0.5);

            yPosition += 100;

            // Visual example of MFQ bars
            this.createMFQExample(centerX, yPosition);

            yPosition += 100;

            // Additional note
            this.add.text(centerX, yPosition, 'These values are based on a questionnaire\nyour partner completed earlier.', {
                fontSize: '16px',
                fill: '#666',
                align: 'center',
                fontStyle: 'italic',
                lineSpacing: 6
            }).setOrigin(0.5);

            yPosition += 60;
        } else {
            // Generic next phase text
            this.add.text(centerX, yPosition, 'The game will continue with the same rules.\nAll network connections have been reset.', {
                fontSize: '20px',
                fill: '#333',
                align: 'center',
                lineSpacing: 8
            }).setOrigin(0.5);

            yPosition += 80;
        }

        // Continue button
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonY = Math.max(yPosition + 20, centerY + 200);

        this.continueButton = this.add.rectangle(centerX, buttonY, buttonWidth, buttonHeight, PDTheme.buttons.action.normal);
        this.continueButton.setInteractive({ cursor: 'pointer' });

        this.continueButtonText = this.add.text(centerX, buttonY, 'Continue', {
            fontSize: '24px',
            fill: '#FFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.continueButton.on('pointerover', () => {
            this.continueButton.setFillStyle(PDTheme.buttons.action.hover);
        });

        this.continueButton.on('pointerout', () => {
            this.continueButton.setFillStyle(PDTheme.buttons.action.normal);
        });

        this.continueButton.on('pointerdown', () => {
            this.handleContinue();
        });
    }

    createMFQExample(centerX, yPosition) {
        // Create a visual example showing what MFQ score bars look like
        const examplePanel = this.add.container(centerX, yPosition);

        // Panel background
        const panelBg = this.add.rectangle(0, 0, 350, 100, 0xF5F5F5);
        panelBg.setStrokeStyle(1, 0xCCCCCC);
        examplePanel.add(panelBg);

        // Get enabled categories from config, or use defaults
        let categories = [
            { id: 'harm', label: 'Care', enabled: true },
            { id: 'fairness', label: 'Fairness', enabled: true },
            { id: 'loyalty', label: 'Loyalty', enabled: true }
        ];

        if (this.mfqDisplayConfig) {
            categories = this.mfqDisplayConfig.filter(c => c.enabled);
        }

        // Draw example MFQ bars
        const barStartY = -25;
        const barSpacing = 28;
        const barStartX = -140;
        const barWidth = 80;
        const barHeight = 16;
        const labelWidth = 70;

        // Example levels for demonstration
        const exampleLevels = ['high', 'medium', 'low'];

        categories.slice(0, 3).forEach((category, idx) => {
            const y = barStartY + idx * barSpacing;

            // Category label
            const label = this.add.text(barStartX, y, category.label + ':', {
                fontSize: '14px',
                fill: '#333'
            }).setOrigin(0, 0.5);
            examplePanel.add(label);

            // Draw 3-segment bar
            const segmentWidth = barWidth / 3;
            const level = exampleLevels[idx % 3];
            const filledSegments = level === 'high' ? 3 : (level === 'medium' ? 2 : 1);

            for (let seg = 0; seg < 3; seg++) {
                const segX = barStartX + labelWidth + seg * (segmentWidth + 2);
                const isFilled = seg < filledSegments;

                const segment = this.add.rectangle(
                    segX + segmentWidth / 2,
                    y,
                    segmentWidth,
                    barHeight,
                    isFilled ? 0x666666 : 0xE0E0E0
                );
                segment.setStrokeStyle(1, 0x999999);
                examplePanel.add(segment);
            }

            // Level text
            const levelText = this.add.text(barStartX + labelWidth + barWidth + 20, y, level, {
                fontSize: '12px',
                fill: '#666',
                fontStyle: 'italic'
            }).setOrigin(0, 0.5);
            examplePanel.add(levelText);
        });
    }

    handleContinue() {
        console.log('ScenePhaseTransition: Continue clicked');

        this.continueButton.disableInteractive();
        this.continueButton.setAlpha(0.5);
        this.continueButtonText.setText('Waiting...');

        window.socket.emit('scene_complete', {
            scene: 'ScenePhaseTransition',
            sessionId: window.sessionId,
            roomId: window.roomId,
            phaseIndex: this.nextPhaseIndex
        });
    }

    shutdown() {
        // Cleanup if needed
    }
}
