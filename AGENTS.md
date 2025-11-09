# Collective Reward Experiment Platform - Architecture Guide for LLMs

This document provides a comprehensive overview of the Collective Reward Experiment Platform architecture to help LLMs understand and develop features for this project.

## Project Overview

This is a production-ready platform for running online behavioral experiments, specifically designed for multi-armed bandit tasks with individual and group conditions. Researchers can define experiments using YAML configuration files, and the system automatically generates game scenes, manages real-time multiplayer coordination, and logs data to MongoDB.

**Key Features:**
- Config-driven experiment generation (YAML → Phaser scenes)
- Real-time multiplayer coordination via Socket.IO
- Strategy pattern for individual vs group experiment logic
- MongoDB integration with comprehensive trial-level logging
- Flexible payment calculation system
- Docker containerization for easy deployment

---

## Technology Stack

### Backend
- **Node.js 22.15.0** - Runtime environment
- **Express 4.21.2** - Web server framework
- **Socket.IO 4.8** - Real-time bidirectional communication
- **MongoDB 8.0.9** with **Mongoose 8.15.0** - Database and ODM
- **Winston 3.17.0** - Structured logging

### Frontend
- **Phaser 3.90.0** - Game engine for interactive experiments
- **jQuery 3.5.1** - DOM manipulation
- **EJS** - Server-side templating

### Tools & Utilities
- **js-yaml 4.1.0** - YAML parsing for configs
- **marked 16.2.1** & **gray-matter 4.0.3** - Markdown processing
- **fast-csv 4.3.6** - CSV data export
- **nodemon** & **concurrently** - Development workflow

---

## Directory Structure

```
/
├── server/                     # Backend Node.js server
│   ├── servers/               # Server entry points
│   │   ├── webServer.js       # Express web server (port 8000)
│   │   └── gameServer.js      # Socket.IO game server (port 8181)
│   ├── services/              # Business logic services
│   │   ├── ExperimentLoader.js    # Loads & validates YAML configs
│   │   ├── ExperimentContext.js   # Strategy pattern coordinator
│   │   └── contentLoader.js       # Loads experiment content files
│   ├── strategies/            # Experiment behavior strategies
│   │   ├── ExperimentStrategy.js  # Base interface
│   │   ├── IndividualStrategy.js  # Solo player logic
│   │   └── MultiplayerStrategy.js # Group player logic
│   ├── socket/                # Socket.IO event handlers
│   │   ├── handlerOnConnection.js # Client connection & room assignment
│   │   ├── coreReadyHandler.js    # Game initialization
│   │   ├── handleChoiceMade.js    # Records choices & payoffs
│   │   ├── handleSceneComplete.js # Scene transitions
│   │   ├── handleDisconnect.js    # Player disconnection
│   │   ├── sessionManager.js      # Room & waiting logic
│   │   └── paramEmitters.js       # Sends params to clients
│   ├── database/              # MongoDB models & connection
│   │   ├── models/
│   │   │   ├── Experiment.js  # Experiment metadata & config
│   │   │   ├── Session.js     # Per-participant session data
│   │   │   └── Trial.js       # Trial-level choice data
│   │   └── connection.js      # Mongoose connection manager
│   ├── utils/                 # Utility functions
│   │   ├── PaymentCalculator.js # Points → currency conversion
│   │   ├── roomFactory.js       # Room object creation
│   │   ├── dataBuilders.js      # Trial/session record builders
│   │   ├── helpers.js           # Math, ID generation, shuffling
│   │   └── logger.js            # Winston logging config
│   ├── middleware/            # Express middleware
│   │   ├── ExperimentMode.js  # Routes to example/generated/deployed
│   │   └── MainJsRouter.js    # Serves correct main.js file
│   └── routes/                # HTTP route handlers
│       ├── gameRoutes.js      # Game page routes
│       └── questionnaireRoutes.js # Questionnaire routes
│
├── client/                    # Frontend application
│   ├── public/src/
│   │   ├── main-example.js    # Phaser entry (example mode)
│   │   ├── main-generated.js  # Phaser entry (generated mode)
│   │   ├── global_values.js   # Global game state
│   │   ├── scenes/            # Scene implementations
│   │   │   ├── example/       # Reference scene implementations
│   │   │   └── templates/     # Scene generation templates
│   │   ├── generated/         # Auto-generated from YAML
│   │   │   └── scenes/        # Generated Phaser scenes
│   │   └── ui/                # UI components
│   │       ├── bonusBar.js    # Visual payoff tracking
│   │       └── functions.js   # Shared utilities
│   └── views/                 # EJS templates
│       ├── example/           # Example experiment views
│       ├── generated/         # Generated experiment views
│       └── deployed/          # Production deployment views
│
├── content/experiments/       # Experiment definitions
│   └── examples/
│       ├── quick-test/            # Individual bandit task (3 trials)
│       │   ├── config.yaml        # Main experiment config
│       │   ├── sequences/main.yaml # Scene flow definition
│       │   ├── instructions/      # Markdown instruction files
│       │   └── pages/            # Questionnaire HTML pages
│       └── prisoners-dilemma/     # 2-player strategic game
│           ├── config.yaml        # Payoff matrix configuration
│           ├── sequences/main.yaml # PD-specific scene flow
│           ├── instructions/      # Game instructions
│           └── pages/            # Post-game questionnaire
│
├── scripts/                   # Automation scripts
│   ├── generate-scenes.js     # Generates Phaser scenes from YAML
│   └── db-clean.js           # Database cleanup utility
│
├── config/                    # Global constants
│   └── constants.js          # Game parameters, validation rules
│
├── docker/                    # Docker configuration
│   ├── docker-compose.yml    # MongoDB container setup
│   └── mongo-init.js         # Database initialization script
│
└── deployed/                  # Active deployed experiment
    └── [experiment-name]/    # Runtime experiment files
```

---

## Architecture Patterns

### 1. Strategy Pattern (Experiment Behavior)

The system uses the Strategy pattern to handle different experiment types without conditional logic scattered throughout the codebase.

**Components:**
- **ExperimentStrategy** (Base interface) - Defines methods like `handleConnection()`, `handleChoiceMade()`, `transitionScene()`
- **IndividualStrategy** - Solo experiments (no waiting, immediate start)
- **MultiplayerStrategy** - Group experiments (waits for players, coordinates group)
- **ExperimentContext** - Selects appropriate strategy based on config and delegates calls

**Why this matters:** When adding features, check if behavior differs between individual/group modes. If so, implement in both strategies.

### 2. Config-Driven Generation

Experiments are defined declaratively in YAML, then compiled into executable Phaser scenes.

**Flow:**
```
config.yaml + sequences/main.yaml + instructions/*.md
    ↓ (npm run generate)
client/public/src/generated/scenes/*.js (Phaser scene classes)
```

**Why this matters:** Don't manually edit generated files. Always modify templates or configs, then regenerate.

### 3. Event-Driven Architecture

Socket.IO events drive game flow:
- Client emits events (e.g., `choiceMade`, `sceneComplete`)
- Server handlers process events, update state, emit responses
- Client listeners update UI based on server events

**Why this matters:** Game logic lives on the server. Clients are "dumb" renderers that respond to server instructions.

---

## Configuration System

### Experiment Configuration (config.yaml)

Every experiment is defined by a YAML file in `content/experiments/[name]/config.yaml`.

**Key Sections:**

```yaml
experiment:
  name: "Quick Test"              # Display name
  description: "Testing..."       # Description
  author: "Researcher Name"       # Author

game:
  horizon: 12                     # Trials per round
  k_armed_bandit: 2               # Number of options (2-4)
  max_choice_time: 5000           # MS to make choice
  max_lobby_wait_time: 120000     # MS to wait for group formation
  max_scene_wait_time: 5000       # MS to wait at scene transitions

groups:
  max_group_size: 4               # Max players per group
  min_group_size: 2               # Min to start

conditions:
  indivOrGroup: "individual"      # "individual" or "group"
  taskType: "static"              # "static" or "dynamic"
  exp_condition: "control"        # Condition label

# Reward System - Generic payoff calculation supporting multiple game types
reward_system:
  type: "probabilistic"           # "payoff_matrix", "probabilistic", "deterministic", "function"

# For probabilistic rewards (bandit tasks), define environments
environments:
  static:
    probabilities: [0.9, 0.1]     # Payoff probabilities per arm
  dynamic:
    probabilities: [0.9, 0.1]

# For matrix games (Prisoner's Dilemma, coordination games, etc.)
# reward_system:
#   type: "payoff_matrix"
#   matrix_type: "prisoners_dilemma"  # Optional label
#   payoffs:
#     "[0,0]": [3, 3]   # Both cooperate: [player1_payoff, player2_payoff]
#     "[0,1]": [0, 5]   # P1 cooperates, P2 defects
#     "[1,0]": [5, 0]   # P1 defects, P2 cooperates
#     "[1,1]": [1, 1]   # Both defect

payment:
  flat_fee: 0.50                  # Base payment (GBP)
  completion_fee: 0               # Completion bonus
  points_to_currency: 0.0006      # Conversion rate (6p per 100 pts)
  currency: "GBP"                 # Currency code
```

**Reward System Types:**

1. **`payoff_matrix`** - For N-player strategic games (Prisoner's Dilemma, coordination games, public goods games)
   - Payoffs defined as: `[choice1, choice2, ...]: [payoff1, payoff2, ...]`
   - Matrix dimensions implicitly define number of players
   - Server calculates payoffs after all players choose

2. **`probabilistic`** - For multi-armed bandit tasks
   - Each option has a probability of returning reward (0 or 1)
   - Uses `environments` field to define probabilities per arm
   - Supports static and dynamic environments

3. **`deterministic`** - For fixed rewards per choice
   - Each option always returns the same reward value
   - Defined as: `rewards: [10, 20, 30]`

4. **`function`** - For custom reward functions (future extension)
   - Allows JavaScript function evaluation for complex reward logic

### Scene Sequences (sequences/main.yaml)

Defines the flow of scenes in the experiment:

```yaml
sequences:
  - name: "welcome"
    type: "SceneWelcome"
    params:
      instructionsFile: "instructions/welcome.md"

  - name: "main_game"
    type: "SceneMain"
    params:
      trials: 12
      showFeedback: true

  - name: "questionnaire"
    type: "SceneGoToQuestionnaire"
```

### Generation Process

```bash
# Generate individual bandit task
npm run generate examples/quick-test

# Generate strategic game (Prisoner's Dilemma)
npm run generate examples/prisoners-dilemma
```

1. Reads `config.yaml` and validates against schema
2. Reads `sequences/main.yaml` for scene flow
3. Reads instruction files from `instructions/` and `pages/`
4. Processes templates from `client/public/src/scenes/templates/`
5. Generates scene classes to `client/public/src/generated/scenes/`
6. Generates EJS views to `client/views/generated/`

**Important:** Generated files should NOT be manually edited. Always modify source templates.

---

## Server Architecture

### Entry Points

#### 1. Web Server (server/servers/webServer.js)
- **Port:** 8000 (configurable via `PORT`)
- **Purpose:** Serves HTML pages, static assets, questionnaire
- **Middleware:**
  - `ExperimentMode` - Routes to example/generated/deployed templates based on `EXPERIMENT_TYPE`
  - `MainJsRouter` - Serves appropriate `main-[type].js` file
- **Routes:**
  - `GET /` - Game page
  - `GET /questionnaire` - Post-experiment questionnaire
  - `GET /endPage` - Payment summary and completion

#### 2. Game Server (server/servers/gameServer.js)
- **Port:** 8181 (configurable via `GAME_PORT`)
- **Purpose:** Real-time game coordination, state management, data logging
- **Startup Flow:**
  1. Loads environment variables from `.env`
  2. Initializes `ExperimentLoader` and loads `config.yaml`
  3. Initializes `ExperimentContext` with appropriate strategy
  4. Creates HTTP server + Socket.IO instance
  5. Registers socket event handlers
  6. Connects to MongoDB
  7. Starts listening for client connections

### Services Layer

#### ExperimentLoader (server/services/ExperimentLoader.js)
- Loads and validates `config.yaml`
- Builds complete game configuration object
- Validates required fields and types
- Returns game config for use by strategies

**Key Methods:**
- `loadConfig()` - Reads YAML from filesystem
- `buildGameConfig()` - Constructs config object with defaults

#### ExperimentContext (server/services/ExperimentContext.js)
- Strategy pattern coordinator
- Selects `IndividualStrategy` or `MultiplayerStrategy` based on config
- Delegates all game logic calls to active strategy

**Key Methods:**
- `handleConnection(socket, io, rooms)` - Delegates to strategy
- `handleChoiceMade(data, socket, io, rooms)` - Delegates to strategy
- `transitionScene(data, socket, io, rooms)` - Delegates to strategy

### Strategies

#### IndividualStrategy (server/strategies/IndividualStrategy.js)
- **Use Case:** Solo experiments, no waiting for other players
- **Behavior:**
  - Immediately starts game on connection
  - No group formation or waiting
  - Records individual choices and payoffs
  - Progresses through scenes independently

#### MultiplayerStrategy (server/strategies/MultiplayerStrategy.js)
- **Use Case:** Group experiments, synchronized gameplay
- **Behavior:**
  - Waits in lobby until `min_group_size` reached
  - Coordinates group to ensure synchronized scene transitions
  - Waits for all players to make choices before progressing
  - Applies timeout if players exceed `max_choice_time`
  - Handles disconnections and group dissolution

**Key Difference:** Multiplayer requires checking `allPlayersReady()` before scene transitions.

### Socket Event Handlers

#### handlerOnConnection (server/socket/handlerOnConnection.js)
- Triggered when client connects to game server
- Assigns player to room (new or existing)
- Initializes player state in room object
- Delegates to strategy for connection handling

#### coreReadyHandler (server/socket/coreReadyHandler.js)
- Triggered when client Phaser game finishes loading
- Sends initial game parameters to client
- Starts experiment sequence

#### handleChoiceMade (server/socket/handleChoiceMade.js)
- Triggered when player makes bandit arm choice
- Records choice, payoff, reaction time in room state
- For groups: waits for all players to choose
- Builds Trial record and saves to MongoDB
- Emits result feedback to client(s)

#### handleSceneComplete (server/socket/handleSceneComplete.js)
- Triggered when player finishes a scene
- Marks player as ready for next scene
- For groups: waits for all players before transitioning
- Emits scene transition event to client(s)

#### handleDisconnect (server/socket/handleDisconnect.js)
- Triggered when client connection drops
- Removes player from room
- For groups: notifies other players, may end experiment early

#### sessionManager (server/socket/sessionManager.js)
- Manages room lifecycle and waiting mechanisms
- Handles lobby waiting for group formation
- Implements timeout logic for scene waits

#### paramEmitters (server/socket/paramEmitters.js)
- Sends game parameters to clients
- Emits experiment config, trial parameters, group info

### Database Models

#### Experiment (server/database/models/Experiment.js)
**Purpose:** Stores experiment metadata and configuration snapshot

**Key Fields:**
- `experimentName` (String, unique indexed) - Identifier
- `config` (Mixed) - Full YAML config for reproducibility
- `statistics` (Object) - Aggregated stats (sessions count, avg payment)
- `status` (String) - deployment/development/testing/active/paused
- `deployment` (Object) - URL, recruitment platform, deployed date

#### Session (server/database/models/Session.js)
**Purpose:** One record per participant, tracks session-level data

**Key Fields:**
- `sessionId` (String, unique indexed) - UUID
- `experimentName` (String, indexed)
- `subjectId` (String, indexed) - Participant identifier
- `roomId` (String, indexed) - Group room assignment
- `startTime`, `endTime`, `duration` (Date, Date, Number)
- `performance` (Object) - `totalPoints`, `totalPayoff`, `bonuses`, `earnings`
- `comprehension` (Object) - Test scores, practice trial performance
- `questionnaire` (Mixed) - Post-experiment responses
- `demographics` (Object) - Collected demographic data

#### Trial (server/database/models/Trial.js)
**Purpose:** One record per bandit choice, detailed trial-level logging

**Key Fields:**
- `experimentName`, `sessionId`, `roomId` (all indexed)
- `subjectId`, `subjectNumber` (participant info)
- `timestamp`, `date`, `time` (timing info)
- `gameRound`, `trial`, `pointer` (position in experiment)
- `experimentConfig` (Object) - Mode, taskType, horizon, kArmedBandit, etc.
- `choice` (Object):
  - `optionId` - Which arm was chosen
  - `screenPosition` - Visual position on screen
  - `payoff` - Reward received (0 or 1)
  - `reactionTime` - MS from stimulus to choice
- `socialInfo` (Array) - Other players' choices (for group experiments)
- `comprehension` (Object) - Comprehension test data if applicable
- `flags` (Object):
  - `wasTimeout` - Did player exceed time limit?
  - `wasMiss` - Did player fail to respond at all?

**Indexes:** Compound indexes on (experimentName, sessionId) and (experimentName, roomId) for efficient querying.

---

## Client Architecture

### Phaser Game Initialization

**Entry File:** `client/public/src/main-example.js` or `main-generated.js`

**Initialization Flow:**
1. Define Phaser game configuration:
   ```javascript
   const config = {
     type: Phaser.AUTO,
     width: 800,
     height: 600,
     scene: [ScenePreload, SceneWelcome, SceneMain, ...],
     parent: 'game-container'
   };
   ```

2. Import all scene classes (from generated or example directories)

3. Create Socket.IO client connection:
   ```javascript
   const socket = io(GAME_SERVER_URL);
   ```

4. Register global socket event listeners:
   - `connect`, `disconnect`, `error`
   - `gameParams`, `startExperiment`, `sceneFeedback`

5. Create Phaser game instance:
   ```javascript
   const game = new Phaser.Game(config);
   ```

6. Setup page visibility monitoring (auto-disconnect on tab close)

### Scene System

Phaser games are organized into scenes. Each scene represents a distinct phase of the experiment.

**Common Scene Types:**

#### ScenePreload
- **Purpose:** Load assets (images, sprites, sounds)
- **When:** First scene, runs once
- **Key Methods:**
  - `preload()` - Load assets
  - `create()` - Transition to next scene

#### SceneWelcome
- **Purpose:** Display instructions, consent, welcome message
- **Params:** `instructionsFile` - Path to Markdown content
- **Key Methods:**
  - `create()` - Render instructions
  - Button click → emit `sceneComplete` → next scene

#### SceneMain
- **Purpose:** Core bandit task gameplay
- **Params:** `trials`, `showFeedback`
- **Key Elements:**
  - Displays bandit arm options (2-4 slots)
  - Countdown timer for choice window
  - Listens for player clicks
  - Emits `choiceMade` event to server
- **Key Methods:**
  - `create()` - Setup UI, start timer
  - `handleChoice(optionId)` - Emit choice to server
  - Socket listener: `choiceResult` - Display feedback, progress to next trial

#### SceneResultFeedback
- **Purpose:** Show trial outcome (points earned)
- **Params:** `payoff`, `totalPoints`
- **Duration:** ~2 seconds, then auto-progresses

#### SceneAskStillThere
- **Purpose:** Attention check after timeout/miss
- **Triggers:** Player exceeded `max_choice_time` or completely missed trial
- **Behavior:** Requires confirmation button press to continue

#### SceneWaitingRoom (Multiplayer Only)
- **Purpose:** Lobby for group formation
- **Behavior:**
  - Displays "Waiting for players..." message
  - Shows current player count
  - Listens for `groupFormed` event from server
  - Auto-progresses when `min_group_size` reached or timeout

#### SceneGoToQuestionnaire
- **Purpose:** End-of-game transition to questionnaire
- **Behavior:**
  - Displays completion message
  - Button → redirects to `/questionnaire`

### Global Game State

**File:** `client/public/src/global_values.js`

**Shared Variables:**
- `subjectId` - Participant UUID
- `sessionId` - Session UUID
- `roomId` - Assigned room/group ID
- `totalPoints` - Cumulative points earned
- `currentTrial` - Trial counter
- `horizon` - Total trials per round
- `kArmedBandit` - Number of options (2-4)
- `payoffProbabilities` - Arm reward probabilities
- `gameConfig` - Full experiment configuration object

**Usage:** Imported by all scenes to share state across scene transitions.

### UI Components

#### bonusBar.js
- **Purpose:** Visual payoff/bonus tracker
- **Displays:** Running total of points, formatted as currency
- **Updates:** On `choiceResult` events

#### functions.js
- **Purpose:** Shared utility functions
- **Examples:**
  - `shuffle(array)` - Randomize array order
  - `formatCurrency(amount)` - Format money display
  - `calculateReactionTime(startTime)` - Compute RT

---

## Data Flow: From Choice to Database

**Step-by-Step Flow:**

1. **Client (SceneMain):**
   - Player clicks bandit arm option
   - Records reaction time, choice ID, screen position
   - Emits Socket.IO event:
     ```javascript
     socket.emit('choiceMade', {
       sessionId: SESSION_ID,
       roomId: ROOM_ID,
       trial: CURRENT_TRIAL,
       optionId: 2,
       reactionTime: 1523,
       screenPosition: 1
     });
     ```

2. **Server (handleChoiceMade.js):**
   - Receives `choiceMade` event
   - Validates choice data
   - Looks up payoff from probability distribution
   - Records choice in room state object
   - For groups: waits until all players have chosen
   - Calls `dataBuilders.buildTrialRecord()`

3. **Data Builder (server/utils/dataBuilders.js):**
   - Constructs Trial document with:
     - Experiment config
     - Choice details (option, payoff, RT)
     - Social info (group choices)
     - Timing metadata
     - Flags (timeout, miss)
   - Returns document ready for MongoDB

4. **MongoDB:**
   - Trial record inserted via `Trial.create()`
   - Session record updated with cumulative stats
   - Indexes ensure efficient querying by experimentName, sessionId, roomId

5. **Server Response:**
   - Emits `choiceResult` event back to client(s):
     ```javascript
     socket.emit('choiceResult', {
       payoff: 1,
       totalPoints: 7,
       socialInfo: [{playerId: 'abc', choice: 1}, ...]
     });
     ```

6. **Client (SceneMain listener):**
   - Receives `choiceResult`
   - Updates UI with feedback
   - Progresses to next trial or transitions to feedback scene

**Key Insight:** All game logic and validation happens server-side. Clients are untrusted and simply render what the server tells them.

---

## Payment System

### RewardCalculator (server/utils/RewardCalculator.js)

**Purpose:** Generic reward/payoff calculation system supporting multiple game types.

**Supported Reward Types:**
1. `payoff_matrix` - Strategic N-player games (Prisoner's Dilemma, coordination, public goods)
2. `probabilistic` - Multi-armed bandit tasks with probability distributions
3. `deterministic` - Fixed rewards per choice
4. `function` - Custom reward functions (future extension)

**Configuration (from YAML):**
```yaml
# Matrix game example (Prisoner's Dilemma)
reward_system:
  type: "payoff_matrix"
  matrix_type: "prisoners_dilemma"
  payoffs:
    "[0,0]": [3, 3]   # Both cooperate
    "[0,1]": [0, 5]   # P1 cooperates, P2 defects
    "[1,0]": [5, 0]   # P1 defects, P2 cooperates
    "[1,1]": [1, 1]   # Both defect

# Probabilistic example (bandit task)
reward_system:
  type: "probabilistic"
environments:
  static:
    probabilities: [0.9, 0.1]
```

**Usage:**
```javascript
const calculator = new RewardCalculator(config);

// For matrix games (N-player)
const choices = [0, 1];  // Player 1 chose 0, Player 2 chose 1
const payoffs = calculator.calculateReward(choices, context);
// Returns: [0, 5]  (Player 1 gets 0, Player 2 gets 5)

// For probabilistic rewards (individual)
const choice = 0;  // Chose option 0
const reward = calculator.calculateReward(choice, { environment: 'static' });
// Returns: 0 or 1 based on probability
```

**Key Methods:**
- `calculateReward(choices, context)` - Main entry point, routes to appropriate method
- `calculateMatrixPayoff(choices, context)` - For N-player strategic games
- `calculateProbabilisticReward(choices, context)` - For bandit tasks
- `calculateDeterministicReward(choices, context)` - For fixed rewards
- `validateConfig()` - Validates reward_system configuration at load time

**Matrix Game Logic:**
- Accepts array of player choices: `[choice1, choice2, ...]`
- Looks up payoffs using JSON key: `"[0, 1]"` → `[0, 5]`
- Returns array of payoffs: `[payoff1, payoff2, ...]`
- Works for any number of players (N-player games)

---

### PaymentCalculator (server/utils/PaymentCalculator.js)

**Purpose:** Converts experimental performance (points) into real-world payment.

**Configuration (from YAML):**
```yaml
payment:
  flat_fee: 0.50              # Base payment for participation
  completion_fee: 0           # Bonus for completing (not quitting)
  points_to_currency: 0.0006  # Conversion rate (e.g., 6p per 100 pts)
  currency: "GBP"             # Currency code
```

**Calculation Logic:**
```javascript
totalPayment = flat_fee
             + (totalPoints * points_to_currency)
             + completion_fee
             + waitingBonuses
```

**Waiting Bonuses (Group Experiments):**
- Compensation for time spent waiting in lobby
- Configurable rate per minute waited
- Encourages retention during group formation

**Output:**
- Formatted currency string: `"£0.92"`
- Precision based on currency (2 decimals for GBP, USD, EUR)

**Usage:**
```javascript
const calculator = new PaymentCalculator(config.payment);
const payment = calculator.calculate(totalPoints, waitingTimeMs);
// Returns: { amount: 0.92, formatted: "£0.92", breakdown: {...} }
```

---

## Database Schema Summary

### Collections Overview

| Collection | Purpose | Key Indexes | Typical Count |
|------------|---------|-------------|---------------|
| experiments | Experiment metadata | experimentName | 1 per experiment |
| sessions | Per-participant data | sessionId, experimentName, subjectId | 1 per participant |
| trials | Per-choice data | experimentName + sessionId, experimentName + roomId | horizon * sessions |

### Indexes for Performance

**experiments:**
- `{ experimentName: 1 }` (unique)

**sessions:**
- `{ sessionId: 1 }` (unique)
- `{ experimentName: 1 }`
- `{ subjectId: 1 }`
- `{ roomId: 1 }`

**trials:**
- `{ experimentName: 1, sessionId: 1 }`
- `{ experimentName: 1, roomId: 1 }`

**Why These Indexes Matter:**
- Quickly query all trials for a given participant (by sessionId)
- Quickly query all trials for a group (by roomId)
- Efficiently aggregate data by experiment

### Data Export

**CSV Export:**
- Configured via `CSV_OUTPUT_DIR` in `.env`
- Uses `fast-csv` library for efficient streaming
- Typical exports: trial-level data, session summaries

---

## Development Workflows

### Common npm Scripts

**Development:**
```bash
npm run example              # Run example experiment (auto-reload)
npm run experiment           # Run last generated experiment
npm run generate examples/quick-test   # Generate scenes from YAML
npm run generate:watch examples/quick-test  # Auto-regenerate on changes
```

**Servers:**
```bash
npm run dev:web:generated    # Web server only (port 8000)
npm run dev:game:generated   # Game server only (port 8181)
npm run dev:full             # Docker + both servers (full stack)
```

**Docker & Database:**
```bash
npm run docker:up            # Start MongoDB container
npm run docker:down          # Stop MongoDB container
npm run docker:clean         # Remove all data volumes
npm run docker:shell         # Access MongoDB shell (mongosh)

npm run db:clean -- --all --confirm          # Clean all data (skip confirmation)
npm run db:clean -- --exp "Quick Test"       # Clean specific experiment
npm run db:shell             # Access experiment database directly
```

**Important:** Use `--` separator to pass arguments to npm scripts (e.g., `npm run db:clean -- --all`).

### Environment Variables (.env)

**Required Variables:**
```bash
# Experiment Configuration
EXPERIMENT_TYPE=generated              # 'example', 'generated', or 'deployed'
EXPERIMENT_PATH=content/experiments/examples/quick-test

# Server Configuration
PORT=8000                              # Web server port
GAME_PORT=8181                         # Game server port
APP_URL=http://localhost:8000          # Web server URL
GAME_SERVER_URL=http://localhost:8181  # Game server URL

# Database
MONGODB_URI=mongodb://localhost:27017/collective_reward_exp

# Logging
LOG_LEVEL=info                         # debug, info, warn, error
LOG_DIR=logs                           # Directory for log files

# Data Export
CSV_OUTPUT_DIR=data/csv                # CSV export directory
```

**Modes:**
- **example** - Runs pre-built example experiment
- **generated** - Runs last generated experiment from content/experiments
- **deployed** - Runs production experiment from deployed/ directory

---

## Key Entry Points for Development

### Adding a New Scene Type

1. **Create Template:** `client/public/src/scenes/templates/SceneMyNewScene.js`
2. **Define Lifecycle:**
   - `preload()` - Load assets
   - `create()` - Setup UI, register event listeners
   - `update()` - Game loop (optional)
3. **Add Socket Listeners:**
   ```javascript
   this.socket.on('mySceneEvent', (data) => {
     // Handle server event
   });
   ```
4. **Emit Completion:**
   ```javascript
   this.socket.emit('sceneComplete', { sceneName: 'MyNewScene' });
   ```
5. **Update Generator:** Modify `scripts/generate-scenes.js` to include new template
6. **Add to Sequence:** Include in `sequences/main.yaml`

### Adding a New Socket Event

1. **Create Handler:** `server/socket/handleMyEvent.js`
   ```javascript
   module.exports = function handleMyEvent(data, socket, io, rooms) {
     const room = rooms[data.roomId];
     // Process event
     io.to(data.roomId).emit('myEventResponse', { result: ... });
   };
   ```

2. **Register Handler:** In `server/servers/gameServer.js`:
   ```javascript
   const handleMyEvent = require('./socket/handleMyEvent');

   io.on('connection', (socket) => {
     socket.on('myEvent', (data) => handleMyEvent(data, socket, io, rooms));
   });
   ```

3. **Client Emitter:** In Phaser scene:
   ```javascript
   this.socket.emit('myEvent', { roomId: ROOM_ID, payload: ... });
   ```

4. **Client Listener:** In Phaser scene:
   ```javascript
   this.socket.on('myEventResponse', (data) => {
     // Update UI
   });
   ```

### Modifying Experiment Config Schema

1. **Update Schema:** In `server/services/ExperimentLoader.js`, modify `validateConfig()` method
2. **Update Defaults:** Add default values in `buildGameConfig()`
3. **Update Documentation:** Document new fields in this file and example configs
4. **Test Generation:** Run `npm run generate` with updated config to ensure validation works

### Adding a New Database Collection

1. **Create Model:** `server/database/models/MyModel.js`
   ```javascript
   const mongoose = require('mongoose');

   const mySchema = new mongoose.Schema({
     experimentName: { type: String, required: true, index: true },
     data: { type: Object, required: true },
     createdAt: { type: Date, default: Date.now }
   });

   module.exports = mongoose.model('MyModel', mySchema);
   ```

2. **Create Indexes:** In `docker/mongo-init.js`:
   ```javascript
   db.mymodels.createIndex({ experimentName: 1 });
   ```

3. **Import Model:** In handler files:
   ```javascript
   const MyModel = require('../database/models/MyModel');
   ```

4. **Use Model:**
   ```javascript
   await MyModel.create({ experimentName: 'Quick Test', data: {...} });
   ```

### Extending Payment Calculation

1. **Modify Calculator:** `server/utils/PaymentCalculator.js`
2. **Add Config Fields:** Update `payment:` section in YAML schema
3. **Update Calculation Logic:**
   ```javascript
   calculate(points, waitingTimeMs, bonusMultiplier = 1) {
     const basePayment = this.flat_fee + (points * this.points_to_currency * bonusMultiplier);
     // Add custom logic
     return { amount, formatted, breakdown };
   }
   ```

4. **Test:** Run experiment and verify payment display on end page

---

## Common Development Patterns

### 1. Strategy Pattern for Behavior Variants
When adding features that differ between individual/group modes:
- Add method to `ExperimentStrategy.js` base class
- Implement in both `IndividualStrategy.js` and `MultiplayerStrategy.js`
- Call via `experimentContext.strategy.myMethod()`

### 2. Room State Management
Game state is stored in `rooms` object on game server:
```javascript
rooms[roomId] = {
  players: [{ socketId, subjectId, choices: [] }],
  currentTrial: 0,
  status: 'active',
  config: {...}
};
```

**Always:**
- Check if room exists before accessing
- Update room state before emitting events
- Clean up rooms on disconnect

### 3. Error Handling
- Use `try/catch` blocks for async operations
- Log errors with Winston: `logger.error('Message', { context: ... })`
- Emit error events to clients: `socket.emit('error', { message: ... })`
- Gracefully handle disconnections

### 4. Validation
- Validate all client inputs server-side (never trust client)
- Use Mongoose schemas for database validation
- Use AJV or custom validators for YAML configs
- Return descriptive error messages

### 5. Code Comments and Cleanliness
**IMPORTANT CODE HYGIENE RULES:**
- **Never add meta comments** about changes being made (e.g., "Updated from old approach", "New implementation", "Legacy code removed")
- **Only document current functionality** as-is - comments should explain what the code does now, not its history
- **Delete old code completely** when replacing functionality - never keep commented-out "fallback" or "legacy" pathways
- **No TODO comments** in production code - either implement immediately or track in a proper task system
- **Clean refactoring** - when modifying code, remove all traces of the old approach

**Good Comments:**
```javascript
// Calculate payoff based on arm's probability distribution
const payoff = Math.random() < probabilities[armId] ? 1 : 0;
```

**Bad Comments:**
```javascript
// New approach: Calculate payoff based on arm's probability
// Old approach was: const payoff = getPayoff(armId); // Removed legacy method
const payoff = Math.random() < probabilities[armId] ? 1 : 0;
```

---

## Architecture Principles

1. **Server Authority:** All game logic executes on server. Clients render UI only.
2. **Config-Driven:** Experiments are data, not code. Generate, don't hardcode.
3. **Strategy Pattern:** Use polymorphism for variant behaviors (individual vs group).
4. **Event-Driven:** Socket.IO events coordinate client-server communication.
5. **Comprehensive Logging:** Every choice, scene transition, and error is logged to MongoDB.
6. **Fail-Safe Design:** Disconnections, timeouts, and errors are handled gracefully.
7. **Reproducibility:** Full config is stored with experiment record for replication.
8. **Clean Codebase:** No meta-comments about changes, no legacy code paths, only document current functionality.

---

## Troubleshooting Guide

### "Cannot find experiment config"
- Check `EXPERIMENT_TYPE` and `EXPERIMENT_PATH` in `.env`
- Ensure `config.yaml` exists at specified path
- Run `npm run generate [experiment-name]` to generate experiment

### "MongoDB connection failed"
- Ensure Docker is running: `docker ps`
- Start MongoDB: `npm run docker:up`
- Check connection string in `.env`

### "Scenes not loading in Phaser"
- Check browser console for errors
- Verify scene imports in `main-[type].js`
- Ensure scenes are generated: check `client/public/src/generated/scenes/`

### "Players stuck in waiting room"
- Check `min_group_size` in config
- Verify `MultiplayerStrategy` is selected (check `indivOrGroup` in config)
- Check server logs for connection errors

### "Payment calculation incorrect"
- Verify `payment` config in YAML
- Check `PaymentCalculator` logic
- Inspect session record in MongoDB: `npm run db:shell` → `db.sessions.findOne()`

---

## Summary

This platform is a sophisticated, production-ready system for online behavioral experiments. Its **config-driven architecture** allows researchers to define experiments declaratively, while the **Strategy Pattern** cleanly separates individual and group experiment logic. **Socket.IO** provides real-time multiplayer coordination, **Phaser** delivers rich interactive experiences, and **MongoDB** stores comprehensive trial-level data.

When developing:
- Always modify templates/configs, not generated files
- Implement variant behaviors in both strategies
- Validate all inputs server-side
- Log everything to MongoDB
- Test with both individual and group modes

The system demonstrates excellent software engineering practices: separation of concerns, clean architecture patterns, comprehensive logging, flexible payment calculations, and multi-mode support.
