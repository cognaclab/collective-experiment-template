/**
 * SceneTemplate - Base class for content-driven scenes
 * Renders Markdown content from the content/experiments/ directory
 */

class SceneTemplate extends Phaser.Scene {
    constructor(config) {
        super({ key: config.key, active: false });
        this.contentKey = config.contentKey;
        this.sceneData = config.sceneData;
        this.nextScene = config.nextScene;
        this.onComplete = config.onComplete;
    }

    init(data) {
        // Store data passed from previous scene
        this.passedData = data || {};
        
        // Merge with any existing scene data
        this.gameData = { ...this.sceneData, ...this.passedData };
        
        // Extract common experiment variables
        this.indivOrGroup = this.gameData.indivOrGroup || indivOrGroup;
        this.taskType = this.gameData.taskType || taskType;
        this.exp_condition = this.gameData.exp_condition || exp_condition;
    }

    preload() {
        // Content should already be loaded by the scene generator
    }

    create() {
        // Set background
        this.cameras.main.setBackgroundColor('#FFFFFF');
        
        // Get compiled content for this scene
        const sceneContent = this.cache.json.get('compiled_scenes') || window.compiledScenesData?.scenes || {};
        const contentData = sceneContent[this.contentKey];
        
        if (!contentData) {
            console.error(`No content found for scene: ${this.contentKey}`);
            return;
        }
        
        // Process conditional content
        const processedContent = this.processConditionalContent(contentData.content);
        
        // Create content container
        this.createContentDisplay(processedContent, contentData.metadata);
        
        // Add navigation if specified
        if (contentData.metadata.navigation !== 'none') {
            this.createNavigation(contentData.metadata);
        }
    }

    processConditionalContent(content) {
        let processed = content;
        
        // Process {if condition="group"} blocks
        processed = this.processConditionalBlocks(processed, 'condition', 
            this.indivOrGroup === 1 ? 'group' : 'individual');
            
        // Process {if taskType="static"} blocks  
        processed = this.processConditionalBlocks(processed, 'taskType', this.taskType);
        
        return processed;
    }

    processConditionalBlocks(content, attribute, value) {
        // Handle {if attribute="value"} ... {else} ... {/if} blocks
        const ifPattern = new RegExp(`\\{if\\s+${attribute}="([^"]+)"\\}([\\s\\S]*?)(?:\\{else\\}([\\s\\S]*?))?\\{\\/${attribute}\\}`, 'g');
        
        return content.replace(ifPattern, (match, conditionValue, ifContent, elseContent) => {
            if (conditionValue === value) {
                return ifContent.trim();
            } else if (elseContent) {
                return elseContent.trim();
            } else {
                return '';
            }
        });
    }

    createContentDisplay(content, metadata) {
        // Convert markdown to HTML using global marked function
        const marked = window.marked || this.basicMarkdown;
        const htmlContent = marked(content);
        
        // Create styling based on metadata or defaults
        const style = this.buildContentStyle(metadata);
        
        // Create DOM element
        let contentDiv = document.createElement('div');
        contentDiv.style.cssText = style;
        contentDiv.innerHTML = htmlContent;
        
        // Add to scene
        const centerX = configWidth / 2;
        const centerY = configHeight / 2 - 50; // Leave room for navigation

        this.contentElement = this.add.dom(centerX, centerY, contentDiv);
    }

    buildContentStyle(metadata) {
        const defaults = {
            backgroundColor: 'rgba(51,51,51,0.1)',
            width: '700px',
            height: '400px',
            fontSize: '20px',
            fontFamily: 'Arial',
            padding: '20px',
            borderRadius: '5px',
            overflow: 'auto',
            textAlign: 'left'
        };

        // Override with metadata styles if present
        const styles = { ...defaults, ...(metadata.styles || {}) };

        return Object.entries(styles)
            .map(([key, value]) => `${this.camelToKebab(key)}: ${value}`)
            .join('; ');
    }

    camelToKebab(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    createNavigation(metadata) {
        const navigation = metadata.navigation || 'linear';
        
        if (navigation === 'none') return;
        
        // Create button container
        const buttonY = configHeight - 100;
        
        // Next button (always present unless specified otherwise)
        if (!metadata.hideNext) {
            this.createNavigationButton(
                configWidth - 150, buttonY,
                metadata.buttons?.next || 'Next',
                () => this.handleNext()
            );
        }
        
        // Back button (for linear navigation)
        if (navigation === 'linear' && !metadata.hideBack) {
            this.createNavigationButton(
                150, buttonY,
                metadata.buttons?.back || 'Back', 
                () => this.handleBack(),
                false // Not enabled by default
            );
        }
    }

    createNavigationButton(x, y, text, onClick, enabled = true) {
        const container = this.add.container(x, y);
        
        const button = this.add.sprite(0, 0, 'button')
            .setDisplaySize(200, 50)
            .setInteractive({ cursor: 'pointer' });
            
        const buttonText = this.add.text(0, 0, text, { 
            fontSize: '24px', 
            fill: '#000' 
        }).setOrigin(0.5, 0.5);
        
        container.add([button, buttonText]);
        
        if (enabled) {
            button.on('pointerdown', onClick);
            button.on('pointerover', () => button.setTint(0x4c4c4c));
            button.on('pointerout', () => button.clearTint());
        } else {
            button.setAlpha(0.5);
            buttonText.setAlpha(0.5);
        }
        
        return container;
    }

    handleNext() {
        if (this.onComplete) {
            this.onComplete.call(this);
        } else if (window.socket && window.experimentFlow) {
            // Use contentKey (YAML scene identifier) instead of scene.key (Phaser scene name)
            // e.g., "welcome" instead of "SceneWelcome"
            const sceneIdentifier = this.contentKey || this.scene.key;

            // Clean shutdown of this scene before transitioning
            this.scene.stop();

            // Server-controlled flow: Notify server that scene is complete
            // Server will coordinate with all players and tell us which scene to start next
            window.socket.emit('scene_complete', {
                scene: sceneIdentifier,
                sequence: window.experimentFlow.sequence
            });
        } else {
            console.warn('Socket or ExperimentFlow not available');
        }
    }

    handleBack() {
        // Implementation depends on how we want to handle back navigation
        // For now, just log
        console.log('Back navigation not implemented');
    }

    basicMarkdown(text) {
        // Basic markdown parser fallback
        return text
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/---/g, '<hr>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[hlu])/gm, '<p>')
            .replace(/(?!<\/[hlu]>)$/gm, '</p>')
            .replace(/<p><\/p>/g, '');
    }

    update() {
        // Override in subclasses if needed
    }
}

export default SceneTemplate;