/**
 * Experiment Mode Middleware
 * Handles routing between example and generated experiments
 */

const fs = require('fs');
const path = require('path');

class ExperimentModeHandler {
    constructor() {
        this.experimentType = process.env.EXPERIMENT_TYPE || 'example';
        this.baseViewsDir = path.join(__dirname, '../../client/views');
        this.exampleViewsDir = path.join(this.baseViewsDir, 'example');
        this.generatedViewsDir = path.join(this.baseViewsDir, 'generated');

        // Load compiled pages data if in generated mode
        this.compiledPages = {};
        if (this.experimentType === 'generated') {
            this.loadCompiledPages();
        }
    }

    loadCompiledPages() {
        try {
            const compiledPagesPath = path.join(__dirname, '../../client/public/src/generated/compiled_pages.json');
            if (fs.existsSync(compiledPagesPath)) {
                const data = fs.readFileSync(compiledPagesPath, 'utf8');
                const parsed = JSON.parse(data);
                this.compiledPages = parsed.pages || {};
                console.log(`📚 Loaded ${Object.keys(this.compiledPages).length} compiled pages`);
            }
        } catch (error) {
            console.warn('Failed to load compiled pages:', error.message);
        }
    }

    // Middleware to override res.render for experiment mode switching
    middleware() {
        return (req, res, next) => {
            // Store original render method
            const originalRender = res.render;

            // Override render method
            res.render = (view, locals, callback) => {
                // Add environment variables to locals for all templates
                locals = locals || {};
                locals.APP_URL = process.env.APP_URL || 'http://localhost:8000';
                locals.GAME_SERVER_URL = process.env.GAME_SERVER_URL || 'http://localhost:8181';

                let targetViewsDir;
                let viewPath;
                
                if (this.experimentType === 'generated') {
                    // Check for generated template first
                    viewPath = path.join(this.generatedViewsDir, `${view}.ejs`);
                    if (fs.existsSync(viewPath)) {
                        targetViewsDir = this.generatedViewsDir;
                        console.log(`📄 Using generated template: ${view}.ejs`);

                        // Add compiled page data to locals
                        if (this.compiledPages[view]) {
                            locals = locals || {};
                            locals.pageData = this.compiledPages[view];
                            locals.metadata = this.compiledPages[view].metadata;
                        }
                    } else {
                        // Fallback to example template
                        targetViewsDir = this.exampleViewsDir;
                        console.log(`📄 Fallback to example template: ${view}.ejs`);
                    }
                } else {
                    // Use example templates
                    targetViewsDir = this.exampleViewsDir;
                    console.log(`📄 Using example template: ${view}.ejs`);
                }
                
                // Temporarily update views directory
                const originalViewsDir = req.app.get('views');
                req.app.set('views', targetViewsDir);
                
                // Call original render with proper callback handling
                originalRender.call(res, view, locals, (err, html) => {
                    // Restore original views directory
                    req.app.set('views', originalViewsDir);

                    if (err) {
                        console.error(`❌ Template render error for ${view}:`, err.message);
                        console.error('Full error:', err);
                    }

                    if (!html && !err) {
                        console.error(`❌ No HTML generated for view: ${view}`);
                    }

                    if (html) {
                        console.log(`✅ Template ${view} rendered successfully (${html.length} bytes)`);
                    }

                    if (callback) {
                        // If a callback was provided, call it
                        callback(err, html);
                    } else {
                        // If no callback, send the response (normal Express behavior)
                        if (err) {
                            return next(err);
                        }
                        console.log(`📤 Sending HTML response for ${view}`);
                        res.type('html');  // Explicitly set Content-Type to text/html
                        res.send(html);
                    }
                });
            };

            next();
        };
    }

    // Method to get current experiment type
    getExperimentType() {
        return this.experimentType;
    }

    // Method to check if using generated mode
    isGeneratedMode() {
        return this.experimentType === 'generated';
    }

    // Method to get compiled page data
    getCompiledPage(pageKey) {
        return this.compiledPages[pageKey] || null;
    }
}

module.exports = new ExperimentModeHandler();