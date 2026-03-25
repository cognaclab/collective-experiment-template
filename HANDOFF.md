# Collective Experiment Template — Handoff Guide

This document explains how to use the template system to create new online behavioral experiments.

## What This Repo Is

A generic, config-driven platform for running online behavioral experiments using Phaser (game engine), Socket.IO (real-time multiplayer), and MongoDB (data logging). Researchers define experiments in YAML configuration files, and the system generates interactive Phaser scenes, manages multiplayer coordination, and logs trial-level data.

## Relationship to Forks

This template was cleaned after the `moral-foundations-experiment` fork added experiment-specific code (NEDPD, MFQ integration, ostracism mechanics). Future experiments should **fork from this clean template** rather than from any experiment-specific fork.

| Repo | Purpose |
|------|---------|
| **collective-experiment-template** (this repo) | Generic experiment platform |
| [moral-foundations-experiment](https://github.com/cognaclab/moral-foundations-experiment) | NEDPD experiment fork (8-player PD with moral foundations) |
| [moral-foundations-questionnaire](https://github.com/cognaclab/moral-foundations-questionnaire) | MFQ questionnaire system |

## Supported Experiment Types

Out of the box, the template supports:

1. **Individual multi-armed bandit tasks** — see `content/experiments/examples/quick-test/`
2. **2-player matrix games / Prisoner's Dilemma** — see `content/experiments/examples/prisoners-dilemma/`
3. **Any multiplayer coordination experiment** — the Strategy pattern handles individual vs group modes

### Reward System Types

The `RewardCalculator` (`server/utils/RewardCalculator.js`) supports:
- `payoff_matrix` — N-player strategic games (PD, coordination, public goods)
- `probabilistic` — Multi-armed bandit with probability distributions
- `deterministic` — Fixed rewards per choice
- `function` — Custom JavaScript reward functions

## How to Create a New Experiment

### Step 1: Copy an example

```bash
cp -r content/experiments/examples/quick-test content/experiments/my-experiment
```

### Step 2: Edit your experiment files

```
my-experiment/
  config.yaml          # Game parameters, reward system, payment, groups
  sequences/
    main.yaml          # Scene flow (what happens in what order)
  instructions/
    welcome.md         # Instruction pages (Markdown with variables)
  pages/
    questionnaire.md   # Post-experiment survey
    consent.html       # Consent form (optional, auto-generated if absent)
```

### Step 3: Configure `config.yaml`

Key sections:
- `experiment` — name, description, author
- `game` — trials per round, number of options, timeouts
- `groups` — min/max group size
- `conditions` — individual/group mode, task type
- `reward_system` — payoff type and parameters
- `payment` — flat fee, completion bonus, points-to-currency conversion

### Step 4: Define scene flow in `sequences/main.yaml`

```yaml
sequence:
  - scene: "welcome"
    type: "instruction"
    content: "welcome.md"
    next: "main_game"

  - scene: "main_game"
    type: "game"
    next: "questionnaire"

  - scene: "questionnaire"
    type: "questionnaire"
    next: "end"

  - scene: "end"
    type: "completion"
    redirect: "/endPage"
```

### Step 5: Generate and test

```bash
npm run generate my-experiment
npm run experiment
# Visit: http://localhost:8000/?subjectID=test1
```

## How to Extend with Custom Scene Types

1. **Create a scene template** in `client/public/src/scenes/templates/MyScene.js`
2. **Add a scene type handler** in `server/socket/handleSceneComplete.js` — add a case for your new scene type in the scene routing logic
3. **Register new socket events** in `server/servers/gameServer.js` if your scene needs custom server-side handlers
4. **Add the scene** to your `sequences/main.yaml`

## Optional Utilities

These files exist in the template but are **not imported by default**. They're available for experiments that need network or pairing functionality.

### NetworkGraph.js (`server/utils/NetworkGraph.js`)

Adjacency matrix management for network experiments:
- Initialize with topologies: `complete`, `empty`, `random`
- Edge operations: `hasEdge()`, `removeEdge()`, `addEdge()`
- Network metrics: degree, density, connected components, isolated players
- Edge history tracking with metadata

To use: import in `roomFactory.js` and initialize in the room creation function.

### PairingManager.js (`server/utils/PairingManager.js`)

Dynamic partner pairing for paired-interaction experiments:
- Strategies: `random_valid`, `round_robin`, `preferential_attachment`
- Recent partner avoidance (configurable repeat limit)
- Isolation handling modes: `sit_out`, `dummy_opponent`, `force_reentry`
- Full pairing history tracking

To use: import in `roomFactory.js`, pass the NetworkGraph instance to the constructor.

## Architecture Overview

See `AGENTS.md` for the full architecture guide. Key concepts:

- **Server authority** — all game logic runs server-side; clients are renderers
- **Config-driven** — experiments defined in YAML, compiled to Phaser scenes
- **Strategy pattern** — `ExperimentContext` delegates to `IndividualStrategy` or `MultiplayerStrategy`
- **Event-driven** — Socket.IO events drive game flow
- **Scene flow** — `handleSceneComplete.js` is the central routing engine

## Quick Reference

### npm Scripts

```bash
npm run example                      # Run default example experiment
npm run generate examples/quick-test # Generate from YAML config
npm run experiment                   # Run generated experiment (auto-reload)
npm run generate:watch [name]        # Auto-regenerate on content changes

npm run docker:up                    # Start MongoDB
npm run docker:down                  # Stop MongoDB
npm run docker:shell                 # Access MongoDB shell
npm run db:clean -- --all --confirm  # Clean all experiment data
```

### Environment Variables (.env)

```bash
EXPERIMENT_TYPE=generated              # 'example', 'generated', or 'deployed'
EXPERIMENT_PATH=content/experiments/examples/quick-test
PORT=8000                              # Web server port
GAME_PORT=8181                         # Game server port
APP_URL=http://localhost:8000
GAME_SERVER_URL=http://localhost:8181
MONGODB_URI=mongodb://localhost:27017/collective_experiments
```

### Directory Structure

```
server/
  servers/          # Express web server + Socket.IO game server
  services/         # ExperimentLoader, ExperimentContext, strategies
  socket/           # Socket event handlers (scene flow, choices, etc.)
  database/models/  # MongoDB models (Experiment, Session, Trial)
  utils/            # RewardCalculator, PaymentCalculator, helpers

client/
  public/src/
    scenes/example/     # Reference scene implementations
    scenes/templates/   # Scene templates for generation
    generated/          # Auto-generated scenes (don't edit)

content/experiments/    # Experiment definitions (YAML + Markdown)
scripts/                # Generation and utility scripts
config/                 # Constants and templates
docker/                 # MongoDB Docker setup
```
