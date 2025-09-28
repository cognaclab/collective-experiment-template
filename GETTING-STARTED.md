# Getting Started Guide

Welcome to the Collective Experiment Platform! This guide will help you set up your development environment and create your first experiment.

## Prerequisites

Before you begin, make sure you have these installed on your system:

- **Node.js v22+** - [Download here](https://nodejs.org)
- **npm** (comes with Node.js)
- **Docker** (for MongoDB) - [Download here](https://www.docker.com/get-started)
- **Git** - [Download here](https://git-scm.com)

## Initial Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/cognaclab/collective-experiment-template.git
cd collective-experiment-template

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# The default settings work for local development
# You can edit .env later if needed
```

### 3. Start MongoDB Database

```bash
# Start MongoDB using Docker
npm run docker:up

# Verify it's running (should show container info)
docker ps
```

## Your First Run

### Try the Example Experiment

```bash
# Start the example experiment
npm run example

# Open your browser and visit:
# http://localhost:8000/?subjectID=test1
```

**What you should see:**
- A consent form with clickable agreement buttons
- After agreeing, you'll be redirected to the experiment
- The system will wait for other participants or start individually

### Understanding the Interface

1. **Consent Page** - Participants must agree to terms
2. **Waiting Room** - System tries to form groups
3. **Tutorial** - Interactive game tutorial
4. **Main Task** - The bandit decision-making game
5. **Survey** - Post-experiment questionnaire

## Creating Your Own Experiment

### Step 1: Copy the Template

```bash
# Create a new experiment directory
cp -r content/experiments/examples/quick-test content/experiments/my-experiment

# Your experiment files are now in:
# content/experiments/my-experiment/
```

### Step 2: Edit Your Content

Navigate to your experiment directory and edit these key files:

```
my-experiment/
├── config.yaml          # Main experiment configuration
├── sequences/
│   └── main.yaml        # Define experiment flow
├── instructions/
│   └── welcome.md       # Welcome/consent page
└── pages/
    └── questionnaire.md # Post-experiment survey
```

**Quick changes to try:**
1. Open `instructions/welcome.md`
2. Change the welcome message
3. Edit the payment information

### Step 3: Generate and Test

```bash
# Generate templates from your experiment
npm run generate my-experiment

# Run your generated experiment
npm run experiment

# Visit: http://localhost:8000/?subjectID=test2
```

## 🔧 Development Workflow

### Making Changes

```bash
# 1. Edit your content files in content/experiments/my-experiment/

# 2. Regenerate templates
npm run generate my-experiment

# 3. Restart the experiment server
# (Kill with Ctrl+C, then run again)
npm run experiment
```

### Auto-Regeneration

For faster development, use the watch mode:

```bash
# Start auto-regeneration (in one terminal)
npm run generate:watch

# Start experiment server (in another terminal)
npm run experiment
```

Now your templates will automatically regenerate when you edit content files!

## Testing with Multiple Participants

### Simulate Multiple Users

Open multiple browser tabs/windows with different subjectIDs:
- `http://localhost:8000/?subjectID=participant1`
- `http://localhost:8000/?subjectID=participant2`
- `http://localhost:8000/?subjectID=participant3`

### Check Your Data

```bash
# View MongoDB data using Docker
npm run docker:shell

# In the MongoDB shell:
use collective_bandit_dev
db.behaviouraldatas.find().pretty()
```

## Common Commands Reference

```bash
# Running experiments
npm run example          # Original working example
npm run experiment       # Your generated experiment

# Content management
npm run generate [name]  # Generate from experiment content
npm run generate:clean   # Clear generated files
npm run generate:watch   # Auto-regenerate on changes

# Database
npm run docker:up        # Start MongoDB
npm run docker:down      # Stop MongoDB
npm run docker:shell     # Access MongoDB shell

# Development servers (advanced)
npm run dev:web:example     # Just the web server (example mode)
npm run dev:web:generated   # Just the web server (generated mode)
npm run dev:game           # Just the game server (socket.io)
```

## Troubleshooting

### "Cannot connect to database"
```bash
# Check if MongoDB is running
docker ps

# If not running, start it
npm run docker:up
```

### "Port already in use"
```bash
# Kill processes on ports 8000 and 8181
npx kill-port 8000 8181

# Or change ports in your .env file
```

### "Module not found" errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### "No consent buttons appear"
- Check browser console for JavaScript errors
- Ensure you're using the example experiment first: `npm run example`
- Try a different browser or incognito mode

### "Experiment doesn't start after consent"
- Check that both web server (port 8000) and game server (port 8181) are running
- Look at server logs for error messages
- Verify MongoDB is accessible

## Next Steps

Once you have the basic setup working:

1. **Read the Content Guide** - Learn how to write experiment content
2. **Study the Configuration** - Understand config.yaml options
3. **Explore Examples** - Look at other experiments in `content/experiments/`
4. **Customize Gameplay** - Learn about the Phaser game engine integration

## Getting Help

- **Check the logs** - Server logs show detailed error information
- **Browser console** - Check for JavaScript errors (F12 → Console)
- **GitHub Issues** - Report bugs and ask questions
- **Lab colleagues** - Share your .env and experiment files for help

Happy experimenting! 🎉