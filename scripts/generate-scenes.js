#!/usr/bin/env node

/**
 * Scene Generation Pipeline
 * Reads content from content/experiments/ and generates Phaser scenes
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');
const { marked } = require('marked');
const { TemplateRenderer } = require('./templateRenderer');

// Registry of variables that should remain as runtime EJS variables
const RUNTIME_VARIABLES = [
    // Core page variables
    'title', 'subjectID', 'gameServerUrl',

    // Error page variables
    'errorMessage', 'error_message', 'participant_id', 'support_contact',

    // End page variables
    'totalEarning', 'bonus_for_waiting', 'completionFee', 'confirmationID',
    'exp_condition', 'indivOrGroup', 'latency',
    'success_message', 'earnings_summary', 'completion_code_section', 'completion_code',
    'base_payment', 'task_bonus', 'waiting_bonus', 'total_earnings',
    'redirect_delay', 'redirect_url',

    // Questionnaire variables
    'completed', 'totalEarningInPence', 'totalGamePayoff', 'experimentalID', 'info_share_cost',

    // Demographics
    'age', 'sex', 'country', 'q1', 'q2', 'q3', 'q4', 'q5',

    // Form and conditional variables
    'condition', 'customContent', 'formAction', 'hiddenFields', 'submitButton',
    'additionalCSS', 'additionalJS',

    // Content blocks
    'note'
];

class SceneGenerator {
    constructor(experimentName = null) {
        this.rootDir = path.join(__dirname, '..');

        // Determine experiment name from argument or env var (no default fallback)
        this.experimentName = experimentName ||
                               process.argv[2] ||
                               process.env.EXPERIMENT_NAME;

        this.outputDir = path.join(this.rootDir, 'client', 'public', 'src', 'generated');
        this.viewsDir = path.join(this.rootDir, 'client', 'views', 'generated');
        this.compiledScenesPath = path.join(this.outputDir, 'compiled_scenes.json');
        this.compiledPagesPath = path.join(this.outputDir, 'compiled_pages.json');

        // Set contentDir only if experimentName is provided
        if (this.experimentName) {
            this.contentDir = path.join(this.rootDir, 'content', 'experiments', this.experimentName);
        }

        this.config = null;
        this.sequences = null;
        this.compiledScenes = {};
        this.compiledPages = {};
    }

    async generate() {
        // Validate that experiment name was provided
        if (!this.experimentName) {
            console.error('❌ Error: No experiment name provided!');
            console.log('');
            console.log('📋 Available experiments:');

            const experimentsDir = path.join(this.rootDir, 'content', 'experiments');
            if (fs.existsSync(experimentsDir)) {
                const experiments = fs.readdirSync(experimentsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);

                if (experiments.length > 0) {
                    experiments.forEach(exp => console.log(`   • ${exp}`));
                } else {
                    console.log('   (No experiments found in content/experiments/)');
                }
            }

            console.log('');
            console.log('💡 Usage: npm run generate [experiment-name]');
            console.log('   Example: npm run generate examples/quick-test');
            process.exit(1);
        }

        console.log(`🚀 Starting scene generation for experiment: ${this.experimentName}...`);
        console.log(`📂 Reading content from: ${this.contentDir}`);

        // Verify experiment directory exists
        if (!fs.existsSync(this.contentDir)) {
            console.error(`❌ Experiment directory not found: ${this.contentDir}`);
            console.log('');
            console.log('📋 Available experiments:');

            const experimentsDir = path.join(this.rootDir, 'content', 'experiments');
            if (fs.existsSync(experimentsDir)) {
                const experiments = fs.readdirSync(experimentsDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);

                if (experiments.length > 0) {
                    experiments.forEach(exp => console.log(`   • ${exp}`));
                } else {
                    console.log('   (No experiments found in content/experiments/)');
                }
            }

            console.log('');
            console.log('💡 Usage: npm run generate [experiment-name]');
            process.exit(1);
        }

        // Check if output directory exists and has files - prompt for confirmation
        if (await this.shouldPromptForOverwrite()) {
            const confirmed = await this.promptForConfirmation();
            if (!confirmed) {
                console.log('❌ Generation cancelled by user');
                process.exit(0);
            }
        }

        try {
            // Ensure output directory exists
            this.ensureDirectoryExists(this.outputDir);
            this.ensureDirectoryExists(path.join(this.outputDir, 'scenes'));
            this.ensureDirectoryExists(this.viewsDir);

            // Load configuration
            await this.loadConfig();

            // Load sequence definition
            await this.loadSequences();
            
            // Process content files
            await this.processContent();
            
            // Process page files
            await this.processPages();
            
            // Generate scene classes
            await this.generateSceneClasses();
            
            // Generate page templates
            await this.generatePageTemplates();
            
            // Generate flow controller
            await this.generateFlowController();
            
            // Save compiled data
            this.saveCompiledScenes();
            this.saveCompiledPages();

            // Copy config.yaml and sequences to generated directory
            this.copyConfigToGenerated();
            this.copySequencesToGenerated();

            // Generate custom main-generated.js with only required scenes
            this.generateMainJs();

            // Generate consent form and questionnaire from templates
            await this.generateConsentAndQuestionnaire();

            console.log('✅ Scene and page generation completed successfully!');
            
        } catch (error) {
            console.error('❌ Scene generation failed:', error.message);
            process.exit(1);
        }
    }

    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async loadConfig() {
        const configPath = path.join(this.contentDir, 'config.yaml');
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found: ${configPath}`);
        }
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.load(configContent);
        console.log(`📋 Loaded config: ${this.config.experiment.name}`);
    }

    async loadSequences() {
        const sequencePath = path.join(this.contentDir, 'sequences', 'main.yaml');
        if (!fs.existsSync(sequencePath)) {
            throw new Error(`Sequence file not found: ${sequencePath}`);
        }

        const sequenceContent = fs.readFileSync(sequencePath, 'utf8');
        const loaded = yaml.load(sequenceContent);
        this.sequences = loaded.sequences || loaded.sequence || [];
        console.log(`📝 Loaded ${this.sequences.length} scenes from sequence`);
    }

    async processContent() {
        const instructionsDir = path.join(this.contentDir, 'instructions');
        
        if (!fs.existsSync(instructionsDir)) {
            console.warn(`Instructions directory not found: ${instructionsDir}`);
            return;
        }
        
        // Process each markdown file in instructions
        const files = fs.readdirSync(instructionsDir)
            .filter(file => file.endsWith('.md'));
            
        for (const file of files) {
            await this.processMarkdownFile(file);
        }
        
        console.log(`📄 Processed ${files.length} instruction files`);
    }

    async processPages() {
        const pagesDir = path.join(this.contentDir, 'pages');
        
        if (!fs.existsSync(pagesDir)) {
            console.warn(`Pages directory not found: ${pagesDir}`);
            return;
        }
        
        // Process each markdown file in pages
        const files = fs.readdirSync(pagesDir)
            .filter(file => file.endsWith('.md'));
            
        for (const file of files) {
            await this.processPageFile(file);
        }
        
        console.log(`📝 Processed ${files.length} page files`);
    }

    async processPageFile(filename) {
        const filePath = path.join(this.contentDir, 'pages', filename);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse front matter and content
        const parsed = matter(content);
        const pageKey = path.basename(filename, '.md');
        
        // Store in compiled pages
        this.compiledPages[pageKey] = {
            content: parsed.content,
            metadata: parsed.data || {},
            filename: filename,
            generated: new Date().toISOString()
        };
        
        console.log(`  ✓ Processed: ${filename} -> ${pageKey}`);
    }

    async processMarkdownFile(filename) {
        const filePath = path.join(this.contentDir, 'instructions', filename);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse front matter and content
        const parsed = matter(content);
        const contentKey = path.basename(filename, '.md');
        
        // Store in compiled scenes
        this.compiledScenes[contentKey] = {
            content: parsed.content,
            metadata: parsed.data || {},
            filename: filename,
            generated: new Date().toISOString()
        };
        
        console.log(`  ✓ Processed: ${filename} -> ${contentKey}`);
    }

    async generateSceneClasses() {
        // Find instruction-type scenes from sequence
        const instructionScenes = this.sequences.filter(scene =>
            scene.type === 'instruction' && scene.content
        );
        
        for (const sceneConfig of instructionScenes) {
            await this.generateSceneClass(sceneConfig);
        }
        
        console.log(`🎭 Generated ${instructionScenes.length} scene classes`);
    }

    async generatePageTemplates() {
        const pageKeys = Object.keys(this.compiledPages);
        
        for (const pageKey of pageKeys) {
            await this.generatePageTemplate(pageKey);
        }
        
        console.log(`📄 Generated ${pageKeys.length} page templates`);
    }

    async generatePageTemplate(pageKey) {
        const pageData = this.compiledPages[pageKey];
        const metadata = pageData.metadata;
        
        // First convert regular markdown to HTML (without conditionals)
        let content = pageData.content;
        
        // Convert form elements first (before markdown processing)
        content = this.processFormElements(content);
        
        // Convert to HTML with markdown
        let htmlContent = marked(content);
        
        // Now process conditionals (after HTML conversion to avoid encoding issues)
        htmlContent = this.processConditionals(htmlContent);

        // Process template variables (two-phase: build-time substitution + runtime EJS)
        htmlContent = this.processTemplateVariables(htmlContent, metadata);

        // Generate EJS template
        const ejsTemplate = this.generateEJSTemplate(pageKey, htmlContent, metadata);
        
        const outputPath = path.join(this.viewsDir, `${pageKey}.ejs`);
        fs.writeFileSync(outputPath, ejsTemplate);
        
        console.log(`  ✓ Generated: ${pageKey}.ejs`);
    }

    processFormElements(content) {
        // Convert form elements to EJS/HTML
        content = content.replace(/\{input:\s*([^,]+),\s*([^,]+),\s*"([^"]*)",?\s*(required)?\s*\}/g, 
            '<input type="$2" name="$1" placeholder="$3" $4 class="form-control" />');
        
        content = content.replace(/\{textarea:\s*([^,]+),\s*"([^"]*)",?\s*rows=(\d+),?\s*(optional)?\s*\}/g,
            '<textarea name="$1" placeholder="$2" rows="$3" class="form-control"></textarea>');
        
        // Convert select elements
        content = content.replace(/\{select:\s*([^,]+),\s*"([^"]*)",?\s*(required)?\s*\}([\s\S]*?)\{\/select\}/g, 
            (match, name, label, required, options) => {
                const optionElements = options.trim().split('\n')
                    .filter(line => line.trim().startsWith('- '))
                    .map(line => `<option value="${line.replace('- ', '').trim()}">${line.replace('- ', '').trim()}</option>`)
                    .join('\n    ');
                return `<label>${label}</label>\n<select name="${name}" ${required || ''} class="form-control">\n    ${optionElements}\n</select>`;
            });
        
        // Convert radio buttons
        content = content.replace(/\{radio:\s*([^,]+),\s*"([^"]*)",?\s*(required)?\s*\}([\s\S]*?)\{\/radio\}/g,
            (match, name, label, required, options) => {
                const radioElements = options.trim().split('\n')
                    .filter(line => line.trim().startsWith('- '))
                    .map((line, index) => {
                        const value = line.replace('- ', '').trim();
                        return `<label><input type="radio" name="${name}" value="${value}" ${required || ''}> ${value}</label>`;
                    })
                    .join('<br>\n');
                return `<fieldset>\n<legend>${label}</legend>\n${radioElements}\n</fieldset>`;
            });
        
        // Convert likert scales
        content = content.replace(/\{likert:\s*([^,]+),\s*"([^"]*)",\s*(\d+)-(\d+)\s*\}/g,
            (match, name, label, min, max) => {
                let scale = `<fieldset class="likert">\n<legend>${label}</legend>\n`;
                for (let i = parseInt(min); i <= parseInt(max); i++) {
                    scale += `<label><input type="radio" name="${name}" value="${i}"> ${i}</label>`;
                }
                scale += '\n</fieldset>';
                return scale;
            });
        
        return content;
    }

    processConditionals(content) {
        // Convert conditional blocks to EJS conditionals
        content = content.replace(/\{if\s+condition=&quot;([^&]+)&quot;\}([\s\S]*?)(?:\{else\}([\s\S]*?))?\{\/if\}/g,
            (match, condition, ifContent, elseContent) => {
                let ejsBlock = `<% if (typeof condition !== 'undefined' && condition === '${condition}') { %>\n${ifContent.trim()}`;
                if (elseContent) {
                    ejsBlock += `\n<% } else { %>\n${elseContent.trim()}`;
                }
                ejsBlock += '\n<% } %>';
                return ejsBlock;
            });
        
        return content;
    }

    processTemplateVariables(content, metadata) {
        // Phase 1: Handle includes first
        content = this.processIncludes(content);

        // Phase 2: Convert block syntax variables like {error_message}...{/error_message} FIRST
        content = content.replace(/\{([^}\/]+)\}([\s\S]*?)\{\/\1\}/g,
            (match, varName, blockContent) => {
                // Check if this is a build-time variable
                let buildTimeValue = this.getMetadataValue(metadata, varName);
                if (buildTimeValue !== undefined) {
                    // Build-time substitution: only include block if metadata value is truthy
                    return buildTimeValue ? blockContent.trim() : '';
                } else if (RUNTIME_VARIABLES.includes(varName)) {
                    // Runtime variable: convert to EJS conditional
                    return `<% if (typeof ${varName} !== 'undefined' && ${varName}) { %>\n${blockContent.trim()}\n<% } %>`;
                } else {
                    // Unknown variable: convert to safe EJS conditional with warning
                    console.warn(`⚠️  Unknown block variable: ${varName}`);
                    return `<% if (typeof ${varName} !== 'undefined' && ${varName}) { %>\n${blockContent.trim()}\n<% } %>`;
                }
            });

        // Phase 3: Convert simple template variables
        content = content.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, varName) => {
            // Check if this is a build-time variable (from frontmatter)
            let buildTimeValue = this.getMetadataValue(metadata, varName);
            if (buildTimeValue !== undefined) {
                // Build-time substitution: replace with actual value
                return buildTimeValue;
            } else if (RUNTIME_VARIABLES.includes(varName)) {
                // Runtime variable: convert to safe EJS
                return `<%= typeof ${varName} !== 'undefined' ? ${varName} : '' %>`;
            } else {
                // Unknown variable: convert to safe EJS with warning
                console.warn(`⚠️  Unknown variable: ${varName}`);
                return `<%= typeof ${varName} !== 'undefined' ? ${varName} : '' %>`;
            }
        });

        return content;
    }

    processIncludes(content) {
        // Handle include directives like {include: standard/information_sheet}
        content = content.replace(/\{include:\s*([^}]+)\}/g, (match, includePath) => {
            const includeFile = path.join(this.contentDir, 'includes', `${includePath.trim()}.md`);

            if (fs.existsSync(includeFile)) {
                try {
                    const includeContent = fs.readFileSync(includeFile, 'utf8');
                    // Parse the include file (it might have frontmatter too)
                    const parsed = matter(includeContent);
                    console.log(`  📎 Included: ${includePath}`);
                    return parsed.content;
                } catch (error) {
                    console.warn(`⚠️  Error reading include file ${includePath}: ${error.message}`);
                    return `<!-- Include not found: ${includePath} -->`;
                }
            } else {
                // Create a placeholder for missing includes
                console.warn(`⚠️  Include file not found: ${includePath}`);
                switch (includePath.trim()) {
                    case 'standard/information_sheet':
                        return '\n## Information Sheet\n\nThis experiment is conducted as part of ongoing research. Your participation is voluntary and you may withdraw at any time.\n';
                    case 'standard/contact_details':
                        return '\n## Contact Information\n\nIf you have any questions, please contact the research team at the email address provided.\n';
                    default:
                        return `<!-- Include not found: ${includePath} -->`;
                }
            }
        });

        return content;
    }

    getMetadataValue(metadata, varName) {
        if (!metadata) return undefined;

        // Direct lookup first
        if (metadata[varName] !== undefined) {
            return metadata[varName];
        }

        // Handle nested lookups for common patterns
        // e.g., waiting_rate -> payment.waiting_rate
        if (metadata.payment) {
            if (metadata.payment[varName] !== undefined) {
                return metadata.payment[varName];
            }
            // Handle nested names: waiting_rate, base, bonus_max
            switch (varName) {
                case 'waiting_rate':
                    return metadata.payment.waiting_rate;
                case 'base':
                    return metadata.payment.base;
                case 'bonus_max':
                    return metadata.payment.bonus_max;
            }
        }

        return undefined;
    }

    generateEJSTemplate(pageKey, content, metadata) {
        const title = metadata.title || 'Experiment Page';
        const pageType = metadata.type || 'page';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title || "${title}" %></title>
    <link rel="stylesheet" href="/stylesheets/style.css">
    <% if (typeof additionalCSS !== 'undefined') { %>
        <% additionalCSS.forEach(function(css) { %>
            <link rel="stylesheet" href="<%= css %>">
        <% }); %>
    <% } %>
</head>
<body class="${pageType}-page">
    <div class="container">
        ${content}
        
        <% if (typeof customContent !== 'undefined') { %>
            <%- customContent %>
        <% } %>
        
        <% if (typeof formAction !== 'undefined') { %>
        <form method="POST" action="<%= formAction %>">
            <% if (typeof hiddenFields !== 'undefined') { %>
                <% Object.keys(hiddenFields).forEach(function(key) { %>
                    <input type="hidden" name="<%= key %>" value="<%= hiddenFields[key] %>">
                <% }); %>
            <% } %>
            
            <% if (typeof submitButton !== 'undefined') { %>
                <button type="submit" class="btn btn-primary"><%= submitButton %></button>
            <% } %>
        </form>
        <% } %>
    </div>
    
    <% if (typeof additionalJS !== 'undefined') { %>
        <% additionalJS.forEach(function(js) { %>
            <script src="<%= js %>"></script>
        <% }); %>
    <% } %>
</body>
</html>`;
    }

    async generateSceneClass(sceneConfig) {
        const contentKey = path.basename(sceneConfig.content, '.md');
        // Convert to PascalCase: network-intro -> NetworkIntro, welcome -> Welcome
        const contentName = this.toPascalCase(contentKey);
        const className = `Scene${contentName}`;
        // Convert scene name to PascalCase
        const sceneName = this.toPascalCase(sceneConfig.scene);
        const sceneKey = `Scene${sceneName}`;

        const sceneCode = `/**
 * ${className} - Generated scene from ${sceneConfig.content}
 * Auto-generated by scene generation pipeline
 */

import SceneTemplate from '../../scenes/SceneTemplate.js';

class ${className} extends SceneTemplate {
    constructor() {
        super({
            key: '${sceneKey}',
            contentKey: '${contentKey}',
            sceneName: '${sceneConfig.scene}',
            nextScene: '${sceneConfig.next || ''}',
            sceneData: ${JSON.stringify(sceneConfig, null, 8)}
        });
    }

    create() {
        super.create();

        // Add any custom logic for this scene here
        console.log('${className} created');
    }
}

export default ${className};
`;

        const outputPath = path.join(this.outputDir, 'scenes', `${className}.js`);
        fs.writeFileSync(outputPath, sceneCode);

        console.log(`  ✓ Generated: ${className}.js`);
    }

    async generateFlowController() {
        const flowCode = `/**
 * ExperimentFlow - Controls scene transitions based on sequence definition
 * Auto-generated by scene generation pipeline
 */

class ExperimentFlow {
    constructor(game) {
        this.game = game;
        this.sequence = ${JSON.stringify(this.sequences, null, 8)};
        this.currentSceneIndex = 0;
        this.sceneHistory = [];
        this.preloadComplete = false;
    }

    toPascalCase(str) {
        // Capitalize first letter and any letter after underscore or hyphen
        // Remove hyphens/underscores: pd-instructions -> PdInstructions
        return str
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    start() {
        // Start with preload scene to load all assets
        console.log('ExperimentFlow: Starting asset preload');
        this.game.scene.start('ScenePreload');
    }

    onPreloadComplete() {
        // Called by ScenePreload when assets are loaded
        this.preloadComplete = true;
        console.log('ExperimentFlow: Preload complete, starting first scene');

        // Start the actual first scene
        const firstScene = this.sequence[0];
        this.startScene(firstScene);
    }

    startScene(sceneConfig, sceneData = {}) {
        console.log('ExperimentFlow: Starting scene:', sceneConfig.scene);

        // Store in history
        this.sceneHistory.push(sceneConfig.scene);

        // Check for explicit redirect
        if (sceneConfig.redirect) {
            console.log('ExperimentFlow: Redirecting to:', sceneConfig.redirect);
            window.location.href = sceneConfig.redirect;
            return;
        }

        // Determine which Phaser scene to start
        let sceneKey;

        // Priority 1: Explicit scene field in YAML (user override)
        if (sceneConfig.scene && sceneConfig.type !== 'instruction') {
            sceneKey = sceneConfig.scene;
        }
        // Priority 2: Auto-generated instruction scenes
        else if (sceneConfig.type === 'instruction') {
            // Convert to PascalCase: pd-instructions -> ScenePdInstructions
            const sceneName = this.toPascalCase(sceneConfig.scene);
            sceneKey = \`Scene\${sceneName}\`;
        }
        // Fallback: use scene name as-is
        else {
            sceneKey = sceneConfig.scene;
        }

        console.log(\`Starting Phaser scene: \${sceneKey}\`);

        // ROBUST: Stop all currently active scenes before starting new one
        // This ensures clean transitions even if scenes don't stop themselves
        this.game.scene.scenes.forEach(scene => {
            if (scene.scene.isActive() && scene.scene.key !== sceneKey) {
                console.log(\`Stopping scene: \${scene.scene.key}\`);
                this.game.scene.stop(scene.scene.key);
            }
        });

        // Start the scene with combined data
        // Merge sceneConfig and sceneData for backward compatibility
        const initData = {
            sceneConfig: sceneConfig,
            flow: this,
            ...sceneData  // Spread sceneData so scene.init() receives it directly
        };

        this.game.scene.start(sceneKey, initData);
    }

    next(currentSceneKey) {
        // Find current scene config
        const currentScene = this.sequence.find(scene => {
            // Match by scene name or generated scene key
            if (scene.scene === currentSceneKey) return true;
            if (scene.type === 'instruction') {
                const sceneName = this.toPascalCase(scene.scene);
                return \`Scene\${sceneName}\` === currentSceneKey;
            }
            return false;
        });

        if (!currentScene) {
            console.error('Current scene not found in sequence:', currentSceneKey);
            return;
        }

        // Get next scene identifier from current scene's next field
        const nextSceneId = currentScene.next;
        if (!nextSceneId) {
            console.log('Experiment completed!');
            return;
        }

        // Find the next scene config by matching scene identifier
        const nextScene = this.sequence.find(s => s.scene === nextSceneId);
        if (nextScene) {
            this.startScene(nextScene);
        } else {
            console.error('Next scene not found:', nextSceneId);
        }
    }
}

export default ExperimentFlow;
`;

        const outputPath = path.join(this.outputDir, 'ExperimentFlow.js');
        fs.writeFileSync(outputPath, flowCode);
        
        console.log('📊 Generated: ExperimentFlow.js');
    }

    saveCompiledScenes() {
        // Add metadata
        const compiledData = {
            generated: new Date().toISOString(),
            config: this.config,
            sequences: this.sequences,
            scenes: this.compiledScenes
        };
        
        fs.writeFileSync(this.compiledScenesPath, JSON.stringify(compiledData, null, 2));
        console.log('💾 Saved compiled scenes data');
    }

    saveCompiledPages() {
        // Add metadata
        const compiledData = {
            generated: new Date().toISOString(),
            config: this.config,
            pages: this.compiledPages
        };
        
        fs.writeFileSync(this.compiledPagesPath, JSON.stringify(compiledData, null, 2));
        console.log('💾 Saved compiled pages data');
    }

    /**
     * Copy config.yaml to generated directory
     */
    copyConfigToGenerated() {
        const sourceConfig = path.join(this.contentDir, 'config.yaml');
        const destConfig = path.join(this.outputDir, 'config.yaml');

        if (!fs.existsSync(sourceConfig)) {
            console.warn('⚠️  Warning: config.yaml not found in experiment directory');
            return;
        }

        try {
            fs.copyFileSync(sourceConfig, destConfig);
            console.log('📋 Copied config.yaml to generated directory');
        } catch (error) {
            console.error('❌ Failed to copy config.yaml:', error.message);
        }
    }

    copySequencesToGenerated() {
        const sourceSequencesDir = path.join(this.contentDir, 'sequences');
        const destSequencesDir = path.join(this.outputDir, 'sequences');

        if (!fs.existsSync(sourceSequencesDir)) {
            console.warn('⚠️  Warning: sequences directory not found in experiment directory');
            return;
        }

        try {
            // Create sequences directory if it doesn't exist
            if (!fs.existsSync(destSequencesDir)) {
                fs.mkdirSync(destSequencesDir, { recursive: true });
            }

            // Copy main.yaml
            const sourceMainYaml = path.join(sourceSequencesDir, 'main.yaml');
            const destMainYaml = path.join(destSequencesDir, 'main.yaml');

            if (fs.existsSync(sourceMainYaml)) {
                fs.copyFileSync(sourceMainYaml, destMainYaml);
                console.log('📋 Copied sequences/main.yaml to generated directory');
            } else {
                console.warn('⚠️  Warning: sequences/main.yaml not found');
            }
        } catch (error) {
            console.error('❌ Failed to copy sequences:', error.message);
        }
    }

    toPascalCase(str) {
        // Capitalize first letter and any letter after underscore or hyphen
        // Remove hyphens/underscores and capitalize following letter
        // network-intro -> NetworkIntro, my_scene -> MyScene
        return str
            .split(/[-_]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }

    /**
     * Check if we should prompt for overwrite confirmation
     * Returns true if output directory exists and contains files
     */
    async shouldPromptForOverwrite() {
        // Check if output directory exists
        if (!fs.existsSync(this.outputDir)) {
            return false;
        }

        // Check if it has any files (excluding .gitkeep)
        try {
            const files = fs.readdirSync(this.outputDir);
            const hasFiles = files.some(f => f !== '.gitkeep' && f !== '.DS_Store');
            return hasFiles;
        } catch (err) {
            return false;
        }
    }

    /**
     * Analyze sequence and determine which example scenes are needed
     * @returns {Array} List of required example scene names
     */
    getRequiredExampleScenes() {
        if (!this.sequences || !Array.isArray(this.sequences)) {
            return ['ScenePreload']; // Always include preload scene
        }

        const requiredScenes = new Set();

        // Always include ScenePreload first
        requiredScenes.add('ScenePreload');

        this.sequences.forEach(sceneConfig => {
            // Skip instruction type as they're auto-generated
            if (sceneConfig.type === 'instruction') {
                return;
            }

            // Skip if it's a redirect (completion pages, etc.)
            if (sceneConfig.redirect) {
                return;
            }

            // Add the scene name (which should be the Phaser scene class name)
            if (sceneConfig.scene) {
                requiredScenes.add(sceneConfig.scene);
            }
        });

        return Array.from(requiredScenes);
    }

    /**
     * Generate main-generated.js file with dynamic imports
     */
    generateMainJs() {
        const requiredScenes = this.getRequiredExampleScenes();
        const generatedSceneKeys = Object.keys(this.compiledScenes);

        // Build import statements for example scenes
        const exampleImports = requiredScenes.map(sceneName =>
            `import ${sceneName} from './scenes/example/${sceneName}.js';`
        ).join('\n');

        // Build scene array entries for example scenes
        const exampleScenesList = requiredScenes.map(name => `        ${name},`).join('\n');

        const mainJsContent = `/*
Template-generated experiment main.js
Auto-generated by scene generation pipeline - DO NOT EDIT MANUALLY
Only loads scenes needed for this specific experiment
Generated: ${new Date().toISOString()}
*/

'use strict';

// ==== Import Generated Components =============================
import ExperimentFlow from './generated/ExperimentFlow.js';

// ==== Import Required Example Scenes (${requiredScenes.length} total) =========================
${exampleImports}

// NOTE: Global variables from global_values.js are loaded via script tag in game.ejs
// They are available as window globals, not ES6 module exports

// Load generated scenes and compiled data
async function loadTemplateSystem() {
    try {
        const response = await fetch('/src/generated/compiled_scenes.json');
        const data = await response.json();
        window.compiledScenesData = data;

        const generatedSceneImports = [];
        if (data.scenes) {
            // Helper function to convert to PascalCase
            const toPascalCase = (str) => str.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

            for (const sceneKey of Object.keys(data.scenes)) {
                const scenePath = \`./generated/scenes/Scene\${toPascalCase(sceneKey)}.js\`;
                try {
                    const module = await import(scenePath);
                    generatedSceneImports.push(module.default);
                    console.log(\`✓ Loaded generated scene: \${sceneKey}\`);
                } catch (error) {
                    console.warn(\`Failed to load scene \${scenePath}:\`, error);
                }
            }
        }

        return { scenesData: data, generatedSceneImports };
    } catch (error) {
        console.error('Failed to load template system:', error);
        return { scenesData: null, generatedSceneImports: [] };
    }
}

// Wait for socket to be available before initializing experiment
// This handles the race condition between ES6 module loading and global_values.js script
function waitForSocket(callback, maxAttempts = 50, attempt = 0) {
    if (window.socket) {
        console.log('✅ Socket available, initializing experiment');
        callback();
    } else if (attempt < maxAttempts) {
        console.log(\`⏳ Waiting for socket... (attempt \${attempt + 1}/\${maxAttempts})\`);
        setTimeout(() => waitForSocket(callback, maxAttempts, attempt + 1), 100);
    } else {
        console.error('❌ Socket failed to initialize after', maxAttempts, 'attempts');
        console.error('⚠️  Server-controlled flow will not work without socket connection');
        callback(); // Proceed anyway but flow will be broken
    }
}

// Initialize experiment
loadTemplateSystem().then(({ scenesData, generatedSceneImports }) => {
    waitForSocket(() => {
    // Combine generated scenes with required example scenes
    const allScenes = [
        ...generatedSceneImports,
${exampleScenesList}
    ];

    const configWidth = 800;
    const configHeight = 600;

    let config = {
        type: Phaser.AUTO,
        width: configWidth,
        height: configHeight,
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 300 },
                debug: false
            }
        },
        parent: 'phaser-game-main',
        scale: {
            _mode: Phaser.Scale.FIT,
            parent: 'phaser-game-main',
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: configWidth,
            height: configHeight
        },
        dom: {
            createContainer: true
        },
        scene: allScenes
    };

    let game = new Phaser.Game(config);

    if (scenesData) {
        game.cache.json.add('compiled_scenes', scenesData.scenes);
        console.log('📊 Added compiled scenes to game cache');
    }

    const experimentFlow = new ExperimentFlow(game);
    window.experimentFlow = experimentFlow;

    console.log('🎮 Dynamic experiment loaded:', generatedSceneImports.length, 'generated +', ${requiredScenes.length}, 'example scenes');
    console.log('📋 Example scenes:', ${JSON.stringify(requiredScenes)});

    // ===== Server-Controlled Flow Socket Listeners =====
    // Listen for server instructions to start specific scenes
    if (window.socket) {
        // Initialize experiment parameters (global variables for SceneMain)
        window.socket.on('init_experiment_params', (params) => {
            console.log('Initializing experiment parameters:', params);

            // Set global variables needed by game scenes (declared in global_values.js)
            numOptions = params.numOptions;
            maxChoiceStageTime = params.maxChoiceStageTime;
            indivOrGroup = params.indivOrGroup;
            exp_condition = params.exp_condition;
            prob_means = params.prob_means;
            horizon = params.horizon;

            // Calculate positions based on number of options
            const calculated_space = params.numOptions === 2 ? 350 : 185;
            const calculated_position = params.numOptions === 2 ? 225 : 122.5;

            space_between_boxes = calculated_space;
            option1_positionX = calculated_position;
            optionOrder = params.optionOrder || Array.from({length: params.numOptions}, (_, i) => i);

            console.log('Parameters initialized - numOptions:', numOptions, 'prob_means:', prob_means, 'horizon:', horizon);
        });

        // Server tells client which scene to start next
        window.socket.on('start_scene', (data) => {
            console.log('🎬 Server instructed to start scene:', data.scene);
            const sceneConfig = data.sceneConfig;
            const sceneData = data.sceneData;

            if (sceneConfig) {
                experimentFlow.startScene(sceneConfig, sceneData);
            } else {
                console.error('No scene config provided by server');
            }
        });

        // Server redirects to a page (e.g., completion)
        window.socket.on('redirect', (data) => {
            console.log('🔀 Server instructed redirect to:', data.url);
            window.location.href = data.url;
        });

        // Experiment completed
        window.socket.on('experiment_complete', (data) => {
            console.log('✅ Experiment complete:', data.message);
            // Could show a completion message or automatically redirect
        });

        console.log('📡 Server-controlled flow listeners registered');
    } else {
        console.warn('⚠️  Socket not available - server-controlled flow disabled');
    }

        // Start experiment flow
        experimentFlow.start();
    });
});
`;

        const outputPath = path.join(this.rootDir, 'client', 'public', 'src', 'main-generated.js');
        fs.writeFileSync(outputPath, mainJsContent);
        console.log('📝 Generated main-generated.js with', requiredScenes.length, 'required example scenes');
    }

    /**
     * Generate consent form and questionnaire from templates
     */
    async generateConsentAndQuestionnaire() {
        try {
            console.log('');
            console.log('📋 Generating consent form and questionnaire...');

            const renderer = new TemplateRenderer(this.config, this.contentDir);
            const results = await renderer.renderAll();

            if (results.consent) {
                console.log('  ✓ Generated consent form');
                await this.copyConsentToViews(results.consent);
            }
            if (results.questionnaire) {
                console.log('  ✓ Generated questionnaire');
                await this.copyQuestionnaireToViews(results.questionnaire);
            }
            if (results.debrief) {
                console.log('  ✓ Generated debrief page');
            }

            if (!results.consent && !results.questionnaire && !results.debrief) {
                console.log('  ⚠ No consent/questionnaire config found - skipping');
            }

        } catch (error) {
            console.warn('⚠️  Could not generate consent/questionnaire:', error.message);
            console.warn('   This is optional - continuing with scene generation');
        }
    }

    /**
     * Copy generated consent.html to client/views/generated/index.ejs
     */
    async copyConsentToViews(consentPath) {
        try {
            const content = fs.readFileSync(consentPath, 'utf8');
            const destPath = path.join(this.viewsDir, 'index.ejs');
            fs.writeFileSync(destPath, content, 'utf8');
            console.log('  ✓ Copied consent form to views/generated/index.ejs');
        } catch (error) {
            console.warn('  ⚠ Could not copy consent to views:', error.message);
        }
    }

    /**
     * Copy generated questionnaire.html to client/views/generated/questionnaire.ejs
     */
    async copyQuestionnaireToViews(questionnairePath) {
        try {
            const content = fs.readFileSync(questionnairePath, 'utf8');
            const destPath = path.join(this.viewsDir, 'questionnaire.ejs');
            fs.writeFileSync(destPath, content, 'utf8');
            console.log('  ✓ Copied questionnaire to views/generated/questionnaire.ejs');
        } catch (error) {
            console.warn('  ⚠ Could not copy questionnaire to views:', error.message);
        }
    }

    /**
     * Prompt user for confirmation to overwrite existing files
     * Returns true if user confirms (y/Y), false otherwise
     */
    async promptForConfirmation() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise((resolve) => {
            console.log('');
            console.log('⚠️  WARNING: Generated files already exist in client/public/src/generated/');
            console.log('⚠️  This will overwrite existing generated files.');
            console.log('⚠️  Make sure your source files in content/experiments/ are up to date.');
            console.log('');
            rl.question('Overwrite existing files? (y/N): ', (answer) => {
                rl.close();
                const confirmed = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
                if (confirmed) {
                    console.log('✅ Proceeding with generation...');
                    console.log('');
                }
                resolve(confirmed);
            });
        });
    }
}

// Run if called directly
if (require.main === module) {
    // Parse command line arguments
    const experimentName = process.argv[2];

    if (experimentName && (experimentName === '--help' || experimentName === '-h')) {
        console.log(`
Usage: node generate-scenes.js [experiment-name]

Examples:
  node generate-scenes.js                    # Generate from 'default' experiment
  node generate-scenes.js my-experiment      # Generate from 'my-experiment'
  node generate-scenes.js 2-armed-individual # Generate from '2-armed-individual'

Environment variable:
  EXPERIMENT_NAME=my-experiment node generate-scenes.js
        `);
        process.exit(0);
    }

    const generator = new SceneGenerator(experimentName);
    generator.generate();
}

module.exports = SceneGenerator;