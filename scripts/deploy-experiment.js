#!/usr/bin/env node

/**
 * Deployment Script
 * Copies generated experiment files to the deployed directory
 *
 * This script:
 * 1. Copies client/public/src/generated/* to deployed/client/src/
 * 2. Copies client/views/generated/* to deployed/client/views/
 * 3. Copies the compiled config to deployed/config.yaml
 * 4. Creates a deployment manifest with metadata
 *
 * Usage: npm run deploy
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

class ExperimentDeployer {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
        this.generatedSrcDir = path.join(this.rootDir, 'client', 'public', 'src', 'generated');
        this.generatedViewsDir = path.join(this.rootDir, 'client', 'views', 'generated');
        this.deployedDir = path.join(this.rootDir, 'deployed');
        this.deployedSrcDir = path.join(this.deployedDir, 'client', 'src');
        this.deployedViewsDir = path.join(this.deployedDir, 'client', 'views');
    }

    async deploy() {
        console.log('🚀 Starting experiment deployment...\n');

        try {
            // Validate that generated files exist
            this.validateGeneratedFiles();

            // Create deployed directory structure
            this.createDeployedStructure();

            // Copy generated files to deployed
            this.copyGeneratedFiles();

            // Copy config file
            this.copyConfig();

            // Create deployment manifest
            this.createManifest();

            console.log('\n✅ Deployment completed successfully!');
            console.log(`📁 Deployed to: ${this.deployedDir}`);
            console.log('\n💡 To run the deployed experiment:');
            console.log('   npm run experiment\n');

        } catch (error) {
            console.error('\n❌ Deployment failed:', error.message);
            process.exit(1);
        }
    }

    validateGeneratedFiles() {
        console.log('📋 Validating generated files...');

        if (!fs.existsSync(this.generatedSrcDir)) {
            throw new Error(`Generated source directory not found: ${this.generatedSrcDir}\nPlease run 'npm run generate <experiment-name>' first.`);
        }

        const compiledScenesPath = path.join(this.generatedSrcDir, 'compiled_scenes.json');
        if (!fs.existsSync(compiledScenesPath)) {
            throw new Error(`Compiled scenes not found: ${compiledScenesPath}\nPlease run 'npm run generate <experiment-name>' first.`);
        }

        console.log('   ✓ Generated files validated\n');
    }

    createDeployedStructure() {
        console.log('📁 Creating deployed directory structure...');

        const dirs = [
            this.deployedDir,
            path.join(this.deployedDir, 'client'),
            this.deployedSrcDir,
            path.join(this.deployedSrcDir, 'scenes'),
            this.deployedViewsDir
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`   ✓ Created: ${path.relative(this.rootDir, dir)}`);
            }
        }
        console.log('');
    }

    copyGeneratedFiles() {
        console.log('📦 Copying generated files to deployed directory...');

        // Copy source files
        this.copyDirectory(this.generatedSrcDir, this.deployedSrcDir, 'client/src');

        // Copy view files
        if (fs.existsSync(this.generatedViewsDir)) {
            this.copyDirectory(this.generatedViewsDir, this.deployedViewsDir, 'client/views');
        }

        console.log('');
    }

    copyDirectory(src, dest, label) {
        const files = fs.readdirSync(src, { withFileTypes: true });
        let fileCount = 0;

        for (const file of files) {
            const srcPath = path.join(src, file.name);
            const destPath = path.join(dest, file.name);

            if (file.isDirectory()) {
                // Recursively copy directories
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                }
                this.copyDirectory(srcPath, destPath, `${label}/${file.name}`);
            } else {
                // Copy file
                fs.copyFileSync(srcPath, destPath);
                fileCount++;
            }
        }

        if (fileCount > 0) {
            console.log(`   ✓ Copied ${fileCount} file(s) to ${label}`);
        }
    }

    copyConfig() {
        console.log('⚙️  Copying experiment configuration...');

        const compiledScenesPath = path.join(this.generatedSrcDir, 'compiled_scenes.json');
        const compiledScenes = JSON.parse(fs.readFileSync(compiledScenesPath, 'utf8'));

        if (!compiledScenes.config) {
            throw new Error('Compiled scenes file does not contain config');
        }

        const config = compiledScenes.config;
        const configYaml = yaml.dump(config);

        const deployedConfigPath = path.join(this.deployedDir, 'config.yaml');
        fs.writeFileSync(deployedConfigPath, configYaml, 'utf8');

        console.log(`   ✓ Config saved to: ${path.relative(this.rootDir, deployedConfigPath)}`);
        console.log('');
    }

    createManifest() {
        console.log('📄 Creating deployment manifest...');

        const compiledScenesPath = path.join(this.generatedSrcDir, 'compiled_scenes.json');
        const compiledScenes = JSON.parse(fs.readFileSync(compiledScenesPath, 'utf8'));

        const manifest = {
            deployed_at: new Date().toISOString(),
            experiment: compiledScenes.config.experiment,
            config: {
                mode: compiledScenes.config.conditions.indivOrGroup,
                horizon: compiledScenes.config.game.horizon,
                k_armed_bandit: compiledScenes.config.game.k_armed_bandit,
                group_size: `${compiledScenes.config.groups.min_group_size}-${compiledScenes.config.groups.max_group_size}`
            },
            generated_from: compiledScenes.generated,
            scenes: Object.keys(compiledScenes.scenes || {}),
            sequences: compiledScenes.sequences?.sequence?.length || 0
        };

        const manifestPath = path.join(this.deployedDir, 'manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

        console.log(`   ✓ Manifest created: ${path.relative(this.rootDir, manifestPath)}`);
        console.log('\n📊 Deployment Summary:');
        console.log(`   • Experiment: ${manifest.experiment.name}`);
        console.log(`   • Mode: ${manifest.config.mode}`);
        console.log(`   • Trials: ${manifest.config.horizon}`);
        console.log(`   • Options: ${manifest.config.k_armed_bandit}-armed bandit`);
        console.log(`   • Scenes: ${manifest.scenes.length}`);
        console.log(`   • Sequences: ${manifest.sequences}`);
    }
}

// Run deployment
if (require.main === module) {
    const deployer = new ExperimentDeployer();
    deployer.deploy().catch(error => {
        console.error('Deployment error:', error);
        process.exit(1);
    });
}

module.exports = ExperimentDeployer;
