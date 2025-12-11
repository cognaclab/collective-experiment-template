/**
 * Centralized theme for Networked Prisoner's Dilemma experiment
 * Import this file in PD scenes instead of hardcoding colors
 */

export const PDTheme = {
    // Choice buttons - SAME grey for both Cooperate and Defect
    // This removes moral color associations
    buttons: {
        choice: {
            normal: 0x757575,      // Medium grey
            hover: 0x616161,       // Darker grey on hover
            selected: 0x424242,    // Even darker when selected
            disabled: 0x9E9E9E,    // Light grey when disabled
        },
        // UI buttons (Continue, Confirm, etc.) - indigo accent
        action: {
            normal: 0x5C6BC0,      // Indigo
            hover: 0x3F51B5,       // Darker indigo
            disabled: 0x9FA8DA,    // Light indigo
        },
        // Navigation buttons (Next, Back) in instruction scenes - uses sprite tint
        navigation: {
            hoverTint: 0x909090,   // Light grey tint on hover (56% grey)
        },
    },

    // Text colors
    text: {
        primary: '#000000',       // Black - main text
        secondary: '#555555',     // Dark grey - supporting text
        muted: '#666666',         // Medium grey - subtle text
        info: '#5C6BC0',          // Indigo - informational highlights
        waiting: '#5C6BC0',       // Indigo - waiting states (same as info)
        error: '#455A64',         // Blue-grey - errors (not red)
    },

    // Progress/timer bars
    bars: {
        progress: 0x5C6BC0,       // Indigo - normal progress
        warning: 0xFF9800,        // Orange - low time warning
        background: 0x000000,     // Black with alpha for bar background
    },

    // Choice indicators in results screen
    results: {
        choiceBox: 0x757575,      // Same grey for both choices
        highlight: 0x424242,      // Darker grey for emphasis
    },

    // Network/status colors
    status: {
        active: '#5C6BC0',        // Indigo - active connections
        inactive: '#78909C',      // Blue-grey - inactive
        isolated: '#78909C',      // Blue-grey - isolated players
    }
};

// Export individual color groups for convenience
export const { buttons, text, bars, results, status } = PDTheme;
