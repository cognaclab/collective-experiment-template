# Template System for Collective Behavior Experiments

A Markdown-driven template system that allows researchers to create behavioral experiments using simple content files instead of writing JavaScript code.

## Quick Start (5 minutes)

### Prerequisites
- Node.js installed
- MongoDB running (for data collection)

### 1. Install and Setup
```bash
npm install
```

### 2. Run Template Mode
```bash
npm run dev        # Template-generated experiment
# OR
npm run example    # Original hardcoded experiment
```

### 3. Access Experiment
Open: `http://localhost:8000?subjectID=TEST123`

## Architecture Overview

The system operates in two modes:

### Template Mode (`npm run dev`)
- **Content**: Markdown files in `content/experiments/default/`
- **Scenes**: Generated from Markdown → JavaScript classes
- **Pages**: Generated from Markdown → EJS templates
- **Configuration**: YAML files for experiment parameters

### Example Mode (`npm run example`) 
- **Content**: Hardcoded JavaScript files in `client/public/src/scenes/example/`
- **Pages**: Static EJS templates in `client/views/example/`
- **Configuration**: Hardcoded in JavaScript

## Directory Structure

```
├── content/experiments/default/          # Template system content
│   ├── config.yaml                      # Experiment configuration
│   ├── sequences/main.yaml              # Scene flow definition
│   ├── instructions/                    # Markdown instruction scenes
│   │   ├── welcome.md
│   │   ├── instruction.md
│   │   └── tutorial.md
│   └── pages/                          # Markdown web pages
│       ├── index.md                    # Welcome page
│       ├── questionnaire.md            # Post-experiment survey
│       └── endPage.md                  # Completion page
│
├── client/views/
│   ├── example/                        # Original experiment templates
│   └── generated/                      # Auto-generated templates
│
├── client/public/src/scenes/
│   ├── example/                        # Original experiment scenes
│   ├── generated/                      # Auto-generated scenes
│   └── SceneTemplate.js               # Base class for generated scenes
│
└── scripts/generate-scenes.js          # Template generation pipeline
```

## Creating Your First Template Experiment

### 1. Configure Basic Parameters

Edit `content/experiments/default/config.yaml`:
```yaml
experiment:
  name: "My Bandit Task"
  
game:
  numOptions: 3                    # Number of arms/options
  maxGroupSize: 5                  # Group size (1 = individual)
  horizon: 20                      # Number of trials
  maxChoiceStageTime: 10000       # Time limit per choice (ms)
```

### 2. Define Experiment Flow

Edit `content/experiments/default/sequences/main.yaml`:
```yaml
sequence:
  - scene: welcome
    type: instruction
    content: welcome.md
    next: instruction
    
  - scene: instruction  
    type: instruction
    content: instruction.md
    next: waiting_room
    
  - scene: waiting_room
    type: waiting
    next: questionnaire
    
  - scene: questionnaire
    type: questionnaire
    next: end
```

### 3. Write Content in Markdown

Create `content/experiments/default/instructions/welcome.md`:
```markdown
---
title: "Welcome"
navigation: button
---

# Welcome to the Experiment

{if condition="group"}
You will be playing with **other participants** in a group task.
{else}  
You will be playing **individually**.
{/if}

Please click Continue when ready.
```

### 4. Generate and Run
```bash
npm run dev
```

The system automatically:
- Generates JavaScript scene classes from Markdown
- Creates EJS templates from page Markdown
- Sets up experiment flow based on YAML sequence
- Starts servers with live reloading

## Extended Markdown Syntax

### Conditional Content
```markdown
{if condition="group"}
Group-specific instructions here
{else}
Individual instructions here  
{/if}
```

### Form Elements
```markdown
{input: age, number, "What is your age?", required}

{select: gender, "Gender?", required}
- Male
- Female
- Other
{/select}

{radio: experience, "Previous experience?"}
- None
- Some  
- Extensive
{/radio}

{likert: satisfaction, "How satisfied are you?", 1-7}

{textarea: comments, "Additional comments?", rows=4}
```

### Variables
```markdown
Your participant ID is: {{subjectID}}
Current trial: {{currentTrial}}
```

## Configuration Reference

### config.yaml Structure
```yaml
experiment:
  name: string              # Experiment name
  description: string       # Description
  
game:
  numOptions: number        # Number of choice options (2-4)
  maxGroupSize: number      # Max participants per group (1=individual)
  minGroupSize: number      # Min participants to start
  horizon: number           # Number of trials/rounds
  maxChoiceStageTime: number # Choice time limit (milliseconds)
  maxWaitingTime: number    # Max waiting time for group formation
  
conditions:
  indivOrGroup: auto        # "auto", "individual", or "group"
  taskType: static          # "static" or "dynamic"
  exp_condition: default    # Condition identifier
```

### sequences/main.yaml Structure  
```yaml
sequence:
  - scene: string          # Unique scene identifier
    type: string           # "instruction", "game", "waiting", "questionnaire"
    content: string        # Markdown filename (for instruction type)
    next: string           # Next scene identifier
    trials: number         # Number of trials (for game type)
    environment: string    # Environment type (for game type)
```

## Scene Types

### Instruction Scenes
- **Type**: `instruction`
- **Content**: Markdown files in `instructions/`
- **Features**: Conditional content, basic interactivity
- **Generated**: Phaser.js scene classes

### Game Scenes  
- **Type**: `game`
- **Content**: Uses existing complex JavaScript scenes
- **Features**: Full bandit task logic, real-time multiplayer
- **Generated**: Uses example scenes (SceneMain, etc.)

### Waiting Scenes
- **Type**: `waiting` 
- **Content**: Uses existing waiting room logic
- **Features**: Group formation, reconnection handling
- **Generated**: Uses example scenes (SceneWaitingRoom)

### Questionnaire
- **Type**: `questionnaire`
- **Content**: Markdown files in `pages/`
- **Features**: Extended form syntax, data collection
- **Generated**: EJS templates

## Example Experiments

### 2-Armed Individual Bandit
```yaml
# config.yaml
experiment:
  name: "2-Armed Individual Bandit"
game:
  numOptions: 2
  maxGroupSize: 1
  horizon: 50
```

### 3-Armed Group Task
```yaml  
# config.yaml
experiment:
  name: "3-Armed Group Task"
game:
  numOptions: 3
  maxGroupSize: 5
  horizon: 30
```

## Troubleshooting

### Common Issues

**Generated scenes not loading**
- Check import paths in generated scene files
- Ensure SceneTemplate.js is accessible
- Verify compiled_scenes.json is generated

**Template not updating**  
- Template watcher should auto-regenerate on file changes
- Manually run: `npm run template:generate`
- Check console for generation errors

**Experiment mode not switching**
- Verify EXPERIMENT_MODE environment variable
- Check middleware logs in server console
- Ensure generated templates exist

### Debug Mode
```bash
# View generation output
npm run template:generate

# Check which templates are loaded
# Look for: "📚 Loaded X compiled pages" in server logs

# Verify experiment mode
echo $EXPERIMENT_MODE
```

## Data Collection

Generated experiments collect the same data as example experiments:
- MongoDB database storage
- CSV export capability  
- Real-time logging via Winston
- Socket.io event tracking

Data schemas remain identical between modes.

## Deployment

### Development
```bash
npm run dev          # Template mode with live reload
npm run example      # Example mode with live reload
```

### Production
```bash
# Set environment
export NODE_ENV=production
export EXPERIMENT_MODE=generated

# Start servers
npm start
```

## Advanced Usage

### Custom Scene Logic
Extend generated scenes by modifying the SceneTemplate base class or creating hybrid scenes that combine template content with custom JavaScript.

### Custom Form Elements
Add new form elements by extending the `processExtendedMarkdown` function in the scene generator.

### Multi-Experiment Setup
Create multiple experiment directories under `content/experiments/` and switch between them via configuration.

---

For more detailed tutorials and examples, see:
- [Step-by-Step Tutorial](TUTORIAL.md)
- [Extended Markdown Reference](MARKDOWN-REFERENCE.md)
- [Configuration Guide](CONFIG-REFERENCE.md)