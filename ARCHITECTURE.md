# Config-Driven Experiment Architecture

## Overview

This document describes the new config-driven experiment architecture that allows researchers to create experiments by editing YAML configuration files, with the backend automatically adapting its behavior based on the experiment configuration.

## Architecture Goals

1. **Config-Driven**: All experiment parameters come from YAML files
2. **No Hardcoded Values**: Server loads all configuration at startup
3. **Automatic Adaptation**: System handles individual vs multiplayer logic automatically
4. **Scalable**: Easy to support different numbers of bandit arms, group sizes, etc.
5. **Clean Code**: Use Strategy Pattern instead of scattered conditionals
6. **User-Friendly**: Researchers only need to edit YAML configuration files

## Directory Structure

```
content/experiments/          # Source experiments (edit these)
  └── examples/
      └── quick-test/
          ├── config.yaml     # Experiment configuration
          ├── sequences/      # Scene sequences
          └── instructions/   # Markdown content

client/public/src/
  ├── generated/              # Build output (generated, can be edited)
  ├── deployed/               # NOT CREATED YET - will be active experiment
  └── example/                # Original example (reference only)

deployed/                     # Active deployed experiment
  ├── config.yaml             # Loaded by server at runtime
  └── client/
      ├── src/                # Client-side code
      └── views/              # EJS templates

server/
  ├── services/
  │   ├── ExperimentLoader.js    # Loads config from deployed/
  │   └── ExperimentContext.js   # Manages strategy selection
  └── strategies/
      ├── ExperimentStrategy.js   # Base strategy interface
      ├── IndividualStrategy.js   # Individual experiment logic
      └── MultiplayerStrategy.js  # Multiplayer experiment logic
```

## Workflow

### 1. Generate Experiment

```bash
npm run generate examples/quick-test
```

This reads from `content/experiments/examples/quick-test/` and outputs to `client/public/src/generated/` and `client/views/generated/`.

### 2. Deploy Experiment

```bash
npm run deploy
```

This copies files from `generated/` to `deployed/`:
- `client/public/src/generated/*` → `deployed/client/src/`
- `client/views/generated/*` → `deployed/client/views/`
- Extracts config from `compiled_scenes.json` → `deployed/config.yaml`

### 3. Run Experiment

```bash
npm run experiment
```

This runs both web and game servers in "deployed" mode:
- `EXPERIMENT_TYPE=deployed npm run dev:web:deployed`
- `EXPERIMENT_TYPE=deployed EXPERIMENT_PATH=deployed npm run dev:game:deployed`

## Strategy Pattern Implementation

### Core Components

#### 1. ExperimentLoader (`server/services/ExperimentLoader.js`)

Responsible for:
- Loading `config.yaml` from deployed directory
- Validating configuration
- Building structured game configuration object
- Providing helper methods to access config

```javascript
const loader = new ExperimentLoader('deployed');
loader.loadConfig();
const gameConfig = loader.gameConfig;
// gameConfig contains: horizon, k_armed_bandit, min_group_size, etc.
```

#### 2. ExperimentStrategy (Base Class)

Defines the interface for all experiment strategies:

```javascript
class ExperimentStrategy {
    shouldWaitForPlayers(room, config)
    handlePlayerReady(room, client, config, io)
    shouldShowMultiplayerUI()
    getMinimumPlayers(config)
    getMaximumPlayers(config)
    shouldCreateNewRoom(room, config)
    handlePlayerDisconnect(room, client, config, io)
    calculateCollectivePayoff(playerPayoffs, config)
    shouldStartWaitingTimer(room, config)
    getStrategyName()
}
```

#### 3. IndividualStrategy

Strategy for solo experiments:
- Never waits for players
- Each player gets their own room
- Starts immediately upon connection
- No multiplayer UI elements
- Collective payoff = individual payoff

```javascript
shouldWaitForPlayers() {
    return false;  // Never wait
}

getMinimumPlayers() {
    return 1;  // Exactly one player
}

shouldShowMultiplayerUI() {
    return false;  // Hide group UI
}
```

#### 4. MultiplayerStrategy

Strategy for group experiments:
- Waits for minimum number of players
- Players share a room
- Shows waiting room UI
- Shows multiplayer UI elements
- Collective payoff = sum of player payoffs

```javascript
shouldWaitForPlayers(room, config) {
    return room.n < config.min_group_size;
}

getMinimumPlayers(config) {
    return config.min_group_size;
}

shouldShowMultiplayerUI() {
    return true;
}
```

#### 5. ExperimentContext

Manages the current experiment's state and strategy:

```javascript
const context = new ExperimentContext(experimentLoader);

// Automatically selects strategy based on config
if (config.mode === 'individual') {
    context.strategy = new IndividualStrategy();
} else {
    context.strategy = new MultiplayerStrategy();
}

// Delegate to strategy
if (context.shouldWaitForPlayers(room)) {
    startWaitingRoom();
} else {
    startGameImmediately();
}
```

## Configuration Format

### Example: Individual Experiment

```yaml
experiment:
  name: "Quick Test"
  description: "Minimal experiment for testing setup"

game:
  horizon: 3                  # Number of trials
  total_game_rounds: 1        # Number of rounds
  k_armed_bandit: 2           # Number of options
  max_choice_time: 15000      # 15 seconds per choice
  max_waiting_time: 2000      # 2 seconds max wait

groups:
  max_group_size: 1           # Individual = 1 player
  min_group_size: 1

conditions:
  indivOrGroup: individual    # 'individual' or 'group'
  taskType: static            # 'static' or 'dynamic'
  exp_condition: quick_test

environments:
  static:
    prob_0: [0.9, 0.1]        # Option probabilities
```

### Example: Multiplayer Experiment

```yaml
experiment:
  name: "Group Cooperation Task"

game:
  horizon: 10
  k_armed_bandit: 3           # 3 options
  max_waiting_time: 120000    # 2 minutes wait

groups:
  max_group_size: 3           # Up to 3 players
  min_group_size: 2           # Need at least 2

conditions:
  indivOrGroup: group         # Multiplayer mode
  taskType: static

environments:
  static:
    prob_0: [0.2, 0.5, 0.8]   # 3 options
```

## Benefits

### For Researchers
- ✅ Edit YAML files only - no code changes needed
- ✅ System automatically adapts to individual vs group mode
- ✅ Easy to create new experiments by copying and modifying YAML
- ✅ Clear separation between experiment design and implementation

### For Developers
- ✅ Clean code - no scattered if/else statements
- ✅ Testable - each strategy can be unit tested
- ✅ Extensible - easy to add new experiment types
- ✅ Maintainable - strategy pattern keeps logic organized

### For the System
- ✅ Config-driven - no hardcoded experiment parameters
- ✅ Flexible - supports 2, 3, 4+ armed bandits automatically
- ✅ Scalable - handles varying group sizes (1 to N players)
- ✅ Robust - validation ensures required config fields are present

## Next Steps (TODO)

1. **Integrate ExperimentLoader into gameServer.js**
   - Replace hardcoded parameters with loaded config
   - Use ExperimentContext for strategy-based logic

2. **Update Socket Handlers**
   - Modify handlers to use strategy methods
   - Remove scattered individual vs group conditionals

3. **Update Room Factory**
   - Accept experiment config as parameter
   - Use config values instead of constants

4. **Client-Side Integration**
   - Pass experiment config to clients
   - Conditionally render UI based on mode

5. **Testing**
   - Test individual experiments
   - Test multiplayer experiments
   - Test generate → deploy → serve workflow

## Migration Notes

### Old Way (Hardcoded)
```javascript
// server/servers/gameServer.js
const horizon = 20;  // Hardcoded!
const K = 3;         // Hardcoded!

// Scattered conditionals everywhere
if (room.indivOrGroup === 0) {
    // individual logic
} else {
    // group logic
}
```

### New Way (Config-Driven)
```javascript
// Load config at startup
const experimentLoader = new ExperimentLoader('deployed');
experimentLoader.loadConfig();
const context = new ExperimentContext(experimentLoader);

// Use config values
const horizon = context.getGameConfig().horizon;
const K = context.getGameConfig().k_armed_bandit;

// Use strategy
if (context.shouldWaitForPlayers(room)) {
    startWaitingRoom();
} else {
    startGameImmediately();
}
```

## Conclusion

This architecture provides a clean, maintainable, and flexible foundation for creating diverse behavioral experiments while keeping the complexity hidden from researchers who only need to edit configuration files.
