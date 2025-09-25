# Scene Template System Documentation

## Overview

The Scene Template System enables researchers to define experiment content and flow using Markdown and YAML files, which are automatically converted into Phaser.js scenes. This separates experiment design (researcher domain) from technical implementation (developer domain).

## Quick Start

1. **Install dependencies** (already done):
   ```bash
   npm install gray-matter marked js-yaml ajv ajv-formats
   ```

2. **Generate scenes from content**:
   ```bash
   npm run scenes:generate
   ```

3. **Start development with auto-regeneration**:
   ```bash
   npm run dev  # Now includes automatic scene watching
   ```

## Directory Structure

```
content/experiments/default/
├── config.yaml              # Experiment configuration
├── sequences/
│   └── main.yaml            # Experiment flow definition
└── instructions/
    ├── welcome.md           # Welcome screen content
    ├── instruction.md       # Main instructions
    ├── tutorial.md          # Tutorial content
    ├── before_understanding_test.md
    └── understanding_test.md
```

Generated files:
```
client/public/src/generated/
├── compiled_scenes.json     # Compiled content data
├── ExperimentFlow.js       # Flow controller
├── SceneIntegration.js     # Integration helper
└── scenes/
    ├── Generatedwelcome.js
    ├── Generatedinstruction.js
    └── ...
```

## For Researchers: Editing Content

### 1. Instruction Scenes (Markdown Files)

Edit files in `content/experiments/default/instructions/`:

#### Front Matter (YAML header)
```yaml
---
scene_type: instruction
navigation: linear
buttons:
  next: "Next"
  back: "Back"
styles:
  backgroundColor: "rgba(51,51,51,0.1)"
  width: "700px"
  height: "400px"
  fontSize: "25px"
---
```

#### Content (Markdown)
- Use `# Title` for headings
- Use `**bold**` and `*italic*` for emphasis
- Use `---` to separate pages
- Use conditional content blocks:

```markdown
{if condition="group"}
Text shown only in group condition
{else}
Text shown only in individual condition
{/if}

{if taskType="static"}
Text for static task
{else}
Text for dynamic task
{/if}
```

### 2. Experiment Flow (YAML)

Edit `content/experiments/default/sequences/main.yaml`:

```yaml
sequence:
  - scene: "welcome"
    type: "instruction"
    content: "welcome.md"
    next: "instruction"
    
  - scene: "instruction"
    type: "instruction" 
    content: "instruction.md"
    next: "tutorial_practice"
    
  - scene: "tutorial_practice"
    type: "game"          # Complex scene - keep as Phaser
    next: "understanding_test"
```

Scene types:
- `instruction`: Markdown-based content scene
- `quiz`: Interactive quiz (with markdown content)
- `game`: Complex Phaser scene (existing code)
- `waiting`: Multiplayer synchronization

### 3. Configuration

Edit `content/experiments/default/config.yaml`:

```yaml
experiment:
  name: "Your Experiment Name"
  
game:
  horizon: 76              # Total trials
  total_game_rounds: 4     # Number of rounds
  k_armed_bandit: 3        # Number of options
  max_choice_time: 10000   # Time limit (ms)
```

## Available Conditions

The system supports conditional content based on:

- **condition**: `"group"` or `"individual"` (based on `indivOrGroup` variable)
- **taskType**: `"static"` or `"dynamic"`

## For Developers: Integration

### Adding to Existing Phaser App

1. **Import the integration system**:
   ```javascript
   import sceneIntegration from './src/generated/SceneIntegration.js';
   ```

2. **Initialize before creating game**:
   ```javascript
   async function initGame() {
       await sceneIntegration.init();
       
       const generatedScenes = sceneIntegration.getGeneratedScenes();
       
       const config = {
           // ... your existing config
           scene: [...existingScenes, ...generatedScenes]
       };
       
       const game = new Phaser.Game(config);
       
       // Optional: Use experiment flow controller
       const flow = sceneIntegration.createExperimentFlow(game);
       flow.start();
   }
   ```

3. **Preload compiled scenes in any scene that needs them**:
   ```javascript
   preload() {
       sceneIntegration.preloadCompiledScenes(this);
   }
   ```

### Generated Scene Structure

Each markdown file generates a Phaser scene class:

```javascript
class Generatedwelcome extends SceneTemplate {
    constructor() {
        super({
            key: 'Generatedwelcome',
            contentKey: 'welcome',
            nextScene: 'instruction'
        });
    }
}
```

### Scene Template Features

- Automatic markdown rendering
- Conditional content processing
- Navigation buttons
- Responsive styling
- Integration with existing experiment variables

## Build Process

1. **Manual generation**:
   ```bash
   npm run scenes:generate
   ```

2. **Watch mode** (auto-regenerates on content changes):
   ```bash
   npm run scenes:watch
   ```

3. **Development** (includes scene watching):
   ```bash
   npm run dev
   ```

## Testing

Open `client/public/test-scenes.html` in a browser to test the scene template system in isolation.

## Migration Strategy

1. **Start with simple scenes**: Convert text-heavy instruction scenes first
2. **Keep complex scenes**: Leave game mechanics, tutorials, and multiplayer coordination as Phaser scenes
3. **Gradual conversion**: Migrate one scene at a time, testing thoroughly
4. **Preserve functionality**: All socket.io events and experiment state management remains unchanged

## Benefits

### For Researchers
- Edit experiment content without JavaScript knowledge
- Easy A/B testing via conditional content
- Version control friendly (plain text files)
- Real-time preview during development

### For Developers  
- Clear separation of content and code
- Automated scene generation
- Reusable template system
- Easier maintenance and updates

## Troubleshooting

### Scenes not updating
- Run `npm run scenes:generate` manually
- Check console for generation errors
- Verify YAML syntax is valid

### Content not displaying correctly
- Check browser console for JavaScript errors
- Verify conditional syntax in markdown
- Ensure global variables (indivOrGroup, taskType) are set

### Integration issues
- Ensure `sceneIntegration.init()` is called before creating Phaser game
- Check that compiled_scenes.json is accessible via HTTP
- Verify all required global variables exist

## Advanced Features

### Custom Scene Logic

Add custom behavior to generated scenes:

```javascript
// In generated scene file
create() {
    super.create();
    
    // Add custom logic here
    this.myCustomFunction();
}

myCustomFunction() {
    // Custom scene behavior
}
```

### Custom Styling

Override styles in markdown front matter:

```yaml
---
styles:
  backgroundColor: "#f0f0f0"
  borderRadius: "10px"
  fontSize: "18px"
  padding: "30px"
---
```

### Quiz Scenes

Create interactive quizzes:

```yaml
---
scene_type: quiz
pass_threshold: 4
retry_allowed: true
correct_answers:
  group_static: [3, 0, 1, 1]
---
```

This system provides a powerful, flexible foundation for creating content-driven experiments while preserving all existing functionality.