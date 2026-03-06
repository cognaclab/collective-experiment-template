/**
 * MFQ Score Display Component
 * Reusable Phaser component to render MFQ (Moral Foundations Questionnaire) scores
 * as 3-level bars next to partner avatars
 *
 * Usage:
 *   import { createMFQDisplay } from '../ui/mfqScoreDisplay.js';
 *
 *   // In scene create():
 *   const mfqDisplay = createMFQDisplay(this, x, y, mfqScores, displayConfig);
 *
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position for the display
 * @param {number} y - Y position for the display
 * @param {Object} mfqScores - MFQ scores object { scores: {...}, levels: {...} }
 * @param {Array} displayConfig - Array of { id, label, enabled } for each category
 * @returns {Phaser.GameObjects.Container} - Container with all MFQ display elements
 */

export function createMFQDisplay(scene, x, y, mfqScores, displayConfig) {
    if (!mfqScores || !mfqScores.levels) {
        console.warn('MFQ display: No scores provided');
        return null;
    }

    // Filter to only enabled categories
    const enabledCategories = displayConfig
        ? displayConfig.filter(c => c.enabled)
        : getDefaultCategories();

    if (enabledCategories.length === 0) {
        console.warn('MFQ display: No enabled categories');
        return null;
    }

    const container = scene.add.container(x, y);

    // Layout settings
    const barSpacing = 22;
    const labelWidth = 65;
    const barWidth = 60;
    const barHeight = 14;
    const segmentWidth = barWidth / 3;
    const startY = 0;

    // Colors for filled vs empty segments
    const filledColor = 0x555555;
    const emptyColor = 0xE0E0E0;
    const borderColor = 0x999999;

    enabledCategories.forEach((category, idx) => {
        const yOffset = startY + idx * barSpacing;
        const level = mfqScores.levels[category.id];

        if (!level) {
            console.warn(`MFQ display: Missing level for category ${category.id}`);
            return;
        }

        // Category label
        const label = scene.add.text(0, yOffset, category.label + ':', {
            fontSize: '12px',
            fill: '#333'
        }).setOrigin(0, 0.5);
        container.add(label);

        // Draw 3-segment bar
        const filledSegments = level === 'high' ? 3 : (level === 'medium' ? 2 : 1);

        for (let seg = 0; seg < 3; seg++) {
            const segX = labelWidth + seg * (segmentWidth + 2);
            const isFilled = seg < filledSegments;

            const segment = scene.add.rectangle(
                segX + segmentWidth / 2,
                yOffset,
                segmentWidth,
                barHeight,
                isFilled ? filledColor : emptyColor
            );
            segment.setStrokeStyle(1, borderColor);
            container.add(segment);
        }
    });

    return container;
}

/**
 * Create a compact MFQ display (horizontal layout)
 * Suitable for displaying next to avatars in tight spaces
 */
export function createCompactMFQDisplay(scene, x, y, mfqScores, displayConfig) {
    if (!mfqScores || !mfqScores.levels) {
        return null;
    }

    const enabledCategories = displayConfig
        ? displayConfig.filter(c => c.enabled)
        : getDefaultCategories();

    if (enabledCategories.length === 0) {
        return null;
    }

    const container = scene.add.container(x, y);

    // Compact layout: smaller bars
    const barSpacing = 18;
    const labelWidth = 65;
    const barWidth = 45;
    const barHeight = 10;
    const segmentWidth = barWidth / 3;

    const filledColor = 0x555555;
    const emptyColor = 0xDDDDDD;
    const borderColor = 0xAAAAAA;

    enabledCategories.forEach((category, idx) => {
        const yOffset = idx * barSpacing;
        const level = mfqScores.levels[category.id];

        if (!level) return;

        const label = scene.add.text(0, yOffset, category.label, {
            fontSize: '10px',
            fill: '#444'
        }).setOrigin(0, 0.5);
        container.add(label);

        // Draw segments
        const filledSegments = level === 'high' ? 3 : (level === 'medium' ? 2 : 1);

        for (let seg = 0; seg < 3; seg++) {
            const segX = labelWidth + seg * (segmentWidth + 1);
            const isFilled = seg < filledSegments;

            const segment = scene.add.rectangle(
                segX + segmentWidth / 2,
                yOffset,
                segmentWidth,
                barHeight,
                isFilled ? filledColor : emptyColor
            );
            segment.setStrokeStyle(1, borderColor);
            container.add(segment);
        }
    });

    return container;
}

/**
 * Create MFQ display with a title header
 */
export function createMFQDisplayWithHeader(scene, x, y, mfqScores, displayConfig, title = "Partner's Values") {
    if (!mfqScores || !mfqScores.levels) {
        return null;
    }

    const container = scene.add.container(x, y);

    // Add title
    const titleText = scene.add.text(0, 0, title, {
        fontSize: '14px',
        fill: '#333',
        fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    container.add(titleText);

    // Create the main MFQ display below title
    const mfqContainer = createMFQDisplay(scene, 0, 25, mfqScores, displayConfig);
    if (mfqContainer) {
        // Center the MFQ bars below the title
        const enabledCount = (displayConfig || getDefaultCategories()).filter(c => c.enabled).length;
        mfqContainer.setX(-50); // Offset to center approximately
        container.add(mfqContainer);
    }

    return container;
}

/**
 * Default MFQ categories if none provided
 */
function getDefaultCategories() {
    return [
        { id: 'harm', label: 'Care', enabled: true },
        { id: 'fairness', label: 'Fairness', enabled: true },
        { id: 'loyalty', label: 'Loyalty', enabled: true },
        { id: 'authority', label: 'Authority', enabled: false },
        { id: 'purity', label: 'Purity', enabled: false }
    ];
}

export default {
    createMFQDisplay,
    createCompactMFQDisplay,
    createMFQDisplayWithHeader
};
