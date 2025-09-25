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
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        this.contentDir = path.join(this.rootDir, 'content', 'experiments', 'default');
        this.outputDir = path.join(this.rootDir, 'client', 'public', 'src', 'generated');
        this.viewsDir = path.join(this.rootDir, 'client', 'views', 'generated');
        this.compiledScenesPath = path.join(this.outputDir, 'compiled_scenes.json');
        this.compiledPagesPath = path.join(this.outputDir, 'compiled_pages.json');
        
        this.config = null;
        this.sequences = null;
        this.compiledScenes = {};
        this.compiledPages = {};
    }

    async generate() {
        console.log('🚀 Starting scene generation...');
        
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
        this.sequences = yaml.load(sequenceContent);
        console.log(`📝 Loaded ${this.sequences.sequence.length} scenes from sequence`);
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
        const instructionScenes = this.sequences.sequence.filter(scene => 
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
        const className = this.toPascalCase(`Generated${contentKey}`);
        const sceneKey = `Generated${sceneConfig.scene}`;
        
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
        this.sequence = ${JSON.stringify(this.sequences.sequence, null, 8)};
        this.currentSceneIndex = 0;
        this.sceneHistory = [];
    }

    start() {
        const firstScene = this.sequence[0];
        this.startScene(firstScene);
    }

    startScene(sceneConfig) {
        console.log('ExperimentFlow: Starting scene:', sceneConfig.scene);
        
        // Store in history
        this.sceneHistory.push(sceneConfig.scene);
        
        // Determine scene key based on type
        let sceneKey;
        if (sceneConfig.type === 'instruction') {
            sceneKey = \`Generated\${sceneConfig.scene}\`;
        } else {
            // For complex scenes, use existing Phaser scene names
            sceneKey = this.mapToExistingScene(sceneConfig);
        }
        
        // Start the scene
        this.game.scene.start(sceneKey, {
            sceneConfig: sceneConfig,
            flow: this
        });
    }

    next(currentSceneKey) {
        // Find current scene in sequence
        const currentIndex = this.sequence.findIndex(scene => 
            scene.scene === currentSceneKey || 
            \`Generated\${scene.scene}\` === currentSceneKey
        );
        
        if (currentIndex < 0) {
            console.error('Current scene not found in sequence:', currentSceneKey);
            return;
        }
        
        const nextIndex = currentIndex + 1;
        if (nextIndex < this.sequence.length) {
            const nextScene = this.sequence[nextIndex];
            this.startScene(nextScene);
        } else {
            console.log('Experiment completed!');
        }
    }

    mapToExistingScene(sceneConfig) {
        // Map sequence scene names to existing Phaser scene keys
        const sceneMap = {
            'tutorial_practice': 'SceneTutorial',
            'waiting_room': 'SceneWaitingRoom',
            'game_round_1': 'SceneMain',
            'game_round_2': 'SceneMain',
            'questionnaire': 'SceneGoToQuestionnaire'
        };
        
        return sceneMap[sceneConfig.scene] || sceneConfig.scene;
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

    toPascalCase(str) {
        return str.replace(/(?:^|_)(.)/g, (_, char) => char.toUpperCase());
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new SceneGenerator();
    generator.generate();
}

module.exports = SceneGenerator;