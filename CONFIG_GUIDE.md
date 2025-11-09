# Configuration System Guide

## Overview

This project uses a **config-driven architecture** where experiments are defined in YAML files. Researchers can create and switch between experiments without modifying JavaScript code.

## Architecture

```
content/experiments/my-experiment/     ← SOURCE (version control)
    ├── config.yaml                    ← Experiment settings
    └── scenes/*.md                    ← Scene content

              ↓ npm run generate

client/public/src/generated/           ← GENERATED (gitignored)
    ├── config.yaml                    ← Copied from source
    ├── scenes/                        ← Generated Phaser scenes
    └── ExperimentFlow.js              ← Flow controller

              ↓ npm run experiment

Server Runtime                         ← ACTIVE
    └── Reads client/public/src/generated/config.yaml
    └── Serves generated scenes
```

---

## Quick Start

```bash
# 1. Generate experiment
npm run generate examples/quick-test

# 2. Run server
npm run experiment
# This automatically sets EXPERIMENT_TYPE=generated

# 3. Open browser
http://localhost:8181?subjectID=test
```

**Note**: You don't need to set `EXPERIMENT_TYPE` in `.env` - the `npm run experiment` command handles it automatically.

---

See full documentation in the file for more details on workflow, config reference, and best practices.
