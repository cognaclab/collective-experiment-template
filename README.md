# Collective Experiment Platform

[![Node.js](https://img.shields.io/badge/Node.js-v22.15.0-blue.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.9-green.svg)](https://www.mongodb.com/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

Create online collective behavior experiments using simple **Markdown** and **YAML** files. No coding required! The system generates interactive web-based experiments with real-time multiplayer functionality.

## ✨ Key Features

- 🚫 **No Coding Required** - Write experiments in Markdown and YAML
- 👥 **Real-Time Multiplayer** - Automatic group formation and coordination
- 🔄 **Conditional Content** - Dynamic text based on experimental conditions
- ⚡ **Auto-Generation** - From content files to running experiments
- 🎮 **Phaser Integration** - Combines simple content with complex game mechanics

## 🚀 Quick Start

```bash
# 1. Setup (5 minutes)
npm install
cp .env.example .env
npm run docker:up

# 2. Try the working example
npm run example
# Visit: http://localhost:8000/?subjectID=test1

# 3. Create your own experiment
cp -r content/experiments/examples/quick-test content/experiments/my-study
npm run generate my-study
npm run experiment
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
npm run example          # Working example experiment
npm run experiment       # Generated experiment

# Content management
npm run generate [name]  # Generate from experiment content
npm run generate:watch   # Auto-regenerate on changes

# Development
npm run docker:up        # Start MongoDB
npm run docker:down      # Stop MongoDB
```

## 🧪 What's Included

- **Default Experiment**: Multi-armed bandit task with group coordination
- **Simple Examples**: Quick test, individual task, group task
- **Template System**: Markdown → Interactive experiment
- **Real-time Backend**: Node.js + Socket.IO + MongoDB
- **Complete Deployment**: Production-ready with PM2 and Docker

## 🎯 Perfect For

- **Researchers** studying collective behavior, social learning, group decision-making
- **Students** learning experimental design and web development
- **Labs** needing reproducible, scalable online experiments

---

**Contributors**: Wataru Toyokawa, \[...\], Michael Crosscombe
**License**: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)


