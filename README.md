# Collective Experiment Platform

[![Node.js](https://img.shields.io/badge/Node.js-v22.15.0-blue.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.9-green.svg)](https://www.mongodb.com/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Create online collective behavior experiments using simple **Markdown** and **YAML** files. No coding required! The system generates interactive web-based experiments with real-time multiplayer functionality.

## ✨ Key Features

- **Easy to Get Started** - Write experiments in Markdown and YAML
- **Real-Time Multiplayer** - Automatic group formation and coordination
- **Conditional Content** - Dynamic text based on experimental conditions
- **Auto-Generation** - From content files to running experiments
- **Phaser Integration** - Combines simple content with complex game mechanics

## 🚀 Quick Start

```bash
# 1. Clone and setup (5 minutes)
git clone https://github.com/cognaclab/collective-experiment-template.git
cd collective-experiment-template
npm install
cp .env.example .env
npm run docker:up

# 2. Try the working example
npm run example
# Visit: http://localhost:8000/?subjectID=test1

# 3. Generate and run a quick test
npm run generate examples/quick-test
npm run experiment
# Visit: http://localhost:8000/?subjectID=test2
```

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **[Getting Started](./GETTING-STARTED.md)** | First-time setup and basic usage |
| **[Experiment Creation Guide](./EXPERIMENT-CREATION-GUIDE.md)** | Build custom experiments |
| **[Examples](./content/experiments/examples/)** | Ready-to-use experiment templates |
| **[Troubleshooting](./TROUBLESHOOTING.md)** | Common issues and solutions |
| **[Deployment](./DEPLOYMENT.md)** | Deploy for real data collection |

## 🎮 Core Commands

```bash
# Running experiments
npm run example                      # Run the default collective reward experiment
npm run generate examples/quick-test # Generate scenes from YAML/Markdown
npm run experiment                   # Run last generated experiment (with auto-reload)

# Content management
npm run generate:clean               # Clear all generated files
npm run generate:watch [name]        # Auto-regenerate when content files change

# Database
npm run docker:up                    # Start MongoDB
npm run docker:down                  # Stop MongoDB
npm run docker:shell                 # Access MongoDB shell
```

## 🧪 What's Included

- **Default Experiment**: Multi-armed bandit task with group coordination
- **Simple Examples**: Quick test, individual task, group task
- **Template System**: Markdown → Interactive experiment
- **Real-time Backend**: Node.js + Socket.IO + MongoDB
- **Complete Deployment**: Production-ready with PM2 and Docker

---

**Contributors**: Wataru Toyokawa, \[...\], Michael Crosscombe
**License**: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)


