/**
 * Main.js Router Middleware
 * Serves the appropriate main.js file based on experiment mode
 */

const fs = require('fs');
const path = require('path');

class MainJsRouter {
    constructor() {
        this.experimentType = process.env.EXPERIMENT_TYPE || 'example';
        this.srcDir = path.join(__dirname, '../../client/public/src');
        this.exampleMainJs = path.join(this.srcDir, 'main-example.js');
        this.generatedMainJs = path.join(this.srcDir, 'main-generated.js');
    }

    // Middleware to serve appropriate main.js
    middleware() {
        return (req, res, next) => {
            // Only intercept requests for main.js
            if (req.url === '/src/main.js') {
                let targetFile;
                
                if (this.experimentType === 'example') {
                    targetFile = this.exampleMainJs;
                    console.log('🎯 Serving example main.js');
                } else {
                    // For generated mode, serve main-generated.js (or fallback to example)
                    targetFile = fs.existsSync(this.generatedMainJs) ? this.generatedMainJs : this.exampleMainJs;
                    console.log('🎯 Serving generated main.js');
                }
                
                if (fs.existsSync(targetFile)) {
                    res.setHeader('Content-Type', 'application/javascript');
                    const content = fs.readFileSync(targetFile, 'utf8');
                    res.send(content);
                    return;
                }
            }
            
            next();
        };
    }

    getExperimentType() {
        return this.experimentType;
    }
}

module.exports = new MainJsRouter();