# Networked-PD Implementation Status

## ✅ Phase 1: Foundation (COMPLETE)

### Experiment Structure
- [x] Directory: `content/experiments/networked-pd/`
- [x] Configuration: `config.yaml` with network parameters
- [x] Scene sequences: `sequences/main.yaml`
- [x] Instructions: 4 markdown files (welcome, PD rules, network, ostracism)
- [x] Questionnaire: `pages/questionnaire.html`
- [x] README documentation

### Core Network Infrastructure
- [x] **NetworkGraph.js** (`server/utils/NetworkGraph.js`)
  - Adjacency matrix management
  - Edge addition/removal
  - Network metrics (density, connectivity, components)
  - Isolated player detection
  - Serialization for database storage

- [x] **PairingManager.js** (`server/utils/PairingManager.js`)
  - Random valid pairing algorithm
  - Recent partner avoidance
  - Isolated player handling
  - Pairing history tracking
  - Multiple strategy support

### Database Models
- [x] **NetworkState** (`server/database/models/NetworkState.js`)
  - Network snapshots per round
  - Adjacency matrix storage
  - Network metrics
  - Ostracism vote tracking
  - Query methods for evolution analysis

- [x] **Trial Model Extensions** (`server/database/models/Trial.js`)
  - Added `networkData` field with:
    - Partner information
    - Cooperation tracking
    - Ostracism data
    - Network snapshots
    - Player status

### Server Infrastructure
- [x] **roomFactory.js Extensions** (`server/utils/roomFactory.js`)
  - Auto-initialization of NetworkGraph
  - Auto-initialization of PairingManager
  - Network state fields in room object

---

## ✅ Phase 2: Server-Side Event Handlers (COMPLETE)

### Round Progression
- [x] **handlePairingStart.js** (`server/socket/handlePairingStart.js`)
  - Generates valid pairings each round
  - Emits pairing info to players
  - Handles isolated players
  - Saves network state to database
  - Broadcasts pairing completion

**Key Features**:
- Uses PairingManager to generate pairs
- Checks network graph for valid edges
- Provides cooperation history to players
- Notifies isolated/unpaired players

### Choice Collection
- [x] **handleNetworkedPDChoice.js** (`server/socket/handleNetworkedPDChoice.js`)
  - Collects PD choices from paired players
  - Waits for both players to choose
  - Calculates payoffs using RewardCalculator
  - Updates cooperation history
  - Saves comprehensive trial data
  - Emits results to both players

**Key Features**:
- Finds partner from currentPairings
- Uses payoff matrix for rewards
- Tracks cooperation patterns (mutual, exploitation, etc.)
- Stores network snapshot in trial data

### Ostracism Processing
- [x] **handleOstracismVote.js** (`server/socket/handleOstracismVote.js`)
  - Collects ostracism votes from players
  - Waits for all paired players to vote
  - Processes votes (unilateral edge removal)
  - Updates NetworkGraph
  - Detects newly isolated players
  - Saves updated network state
  - Broadcasts network summary

**Key Features**:
- Unilateral ostracism (either player can break)
- Bidirectional edge removal
- Isolation detection
  - Real-time notifications
- Comprehensive logging

---

## 🚧 Phase 3: Client-Side Scenes (TODO)

### Scene Templates Needed

#### 1. ScenePDPairing
**Purpose**: Display partner assignment at start of round

**UI Elements**:
- Partner ID display: "You are paired with Player 5"
- Cooperation history: "You've played together 3 times"
- Partner cooperation rate: "Partner cooperated 67% (2/3 times)"
- Network status: "You have 5 possible partners remaining"
- Continue button

**Socket Events**:
- Listen: `pairing_assigned`
- Emit: `ready_for_choice` (when player clicks continue)

#### 2. SceneOstracismVote
**Purpose**: Vote interface to continue or break link with partner

**UI Elements**:
- Partner summary: "You just played with Player 5"
- Cooperation summary: "This round: Both cooperated (earned 3 points)"
- History display: "Overall: Partner cooperated 67% of the time"
- Vote buttons:
  - "Continue" (green) - Keep interacting with this partner
  - "Break Link" (red) - Never interact with this partner again
- Warning text: "If you break the link, you cannot undo this decision"

**Socket Events**:
- Listen: `ostracism_vote_required` (triggered after PD results on rounds 5, 10, 15, 20, 25, 30)
- Emit: `ostracism_vote` with `{ vote: 'continue'|'break', partnerId }`
- Listen: `vote_acknowledged`

#### 3. SceneNetworkUpdate
**Purpose**: Show updated network connections after ostracism

**UI Elements**:
- Network summary:
  - "You can still interact with X players"
  - "Y edges were removed this round"
  - "Z players are now isolated"
- List of available partners: "Players 1, 3, 4, 6, 7"
- Network metrics (optional):
  - Network density bar
  - Total edges remaining
- Continue button

**Socket Events**:
- Listen: `network_summary`
- Listen: `ostracism_complete`
- Emit: `ready_for_next_round`

#### 4. SceneIsolationWarning
**Purpose**: Notify player if they become isolated

**UI Elements**:
- Large warning message: "You have been excluded by all players"
- Explanation: "You will not participate in remaining rounds"
- Earnings display: "You earned X points total"
- Auto-redirect to end page or questionnaire

**Socket Events**:
- Listen: `player_became_isolated`
- Emit: `acknowledged_isolation`

### Scene Template Files to Create
```
client/public/src/scenes/templates/
├── ScenePDPairing.js
├── SceneOstracismVote.js
├── SceneNetworkUpdate.js
└── SceneIsolationWarning.js
```

---

## 🚧 Phase 4: Integration (TODO)

### Socket Event Registration
**File**: `server/servers/gameServer.js`

Need to register handlers:
```javascript
const handlePairingStart = require('./socket/handlePairingStart');
const handleNetworkedPDChoice = require('./socket/handleNetworkedPDChoice');
const handleOstracismVote = require('./socket/handleOstracismVote');

io.on('connection', (socket) => {
  // Existing handlers...

  // Networked PD handlers
  socket.on('start_pairing', (data) =>
    handlePairingStart(data, socket, io, rooms));

  socket.on('networked_pd_choice', (data) =>
    handleNetworkedPDChoice(data, socket, io, rooms));

  socket.on('ostracism_vote', (data) =>
    handleOstracismVote(data, socket, io, rooms));
});
```

### Scene Generation
Run the scene generator:
```bash
npm run generate networked-pd
```

This will:
1. Read `config.yaml` and `sequences/main.yaml`
2. Process templates from `client/public/src/scenes/templates/`
3. Generate scene files to `client/public/src/generated/scenes/`
4. Generate EJS views to `client/views/generated/`

### ExperimentLoader Integration
**File**: `server/services/ExperimentLoader.js`

May need to add validation for new config fields:
- `network.*` parameters
- `pairing.*` parameters
- `round_structure` configuration

---

## 🧪 Phase 5: Testing (TODO)

### Unit Tests Needed
- [ ] NetworkGraph class
  - Edge addition/removal
  - Isolation detection
  - Network metrics calculation
- [ ] PairingManager class
  - Pairing generation
  - History tracking
  - Isolated player handling

### Integration Tests
- [ ] Full 30-round simulation with 8 players
- [ ] Ostracism voting with edge removal
- [ ] Network fragmentation scenarios
- [ ] Isolated player handling

### Test Scenarios
1. **Normal Flow**: 8 players, 30 rounds, some ostracism
2. **Heavy Ostracism**: Many break votes early, network fragments quickly
3. **Isolation**: Test player becoming isolated mid-game
4. **No Ostracism**: All players vote "continue" every time
5. **Disconnection**: Player disconnects during game

---

## 📊 Data Flow Summary

### Round Progression
```
1. Server: handlePairingStart
   ├─> Generate pairings (PairingManager)
   ├─> Save network state (NetworkState)
   └─> Emit 'pairing_assigned' to players

2. Client: ScenePDPairing
   ├─> Display partner info
   └─> Emit 'ready_for_choice'

3. Client: ScenePDChoice
   └─> Emit 'networked_pd_choice'

4. Server: handleNetworkedPDChoice
   ├─> Wait for both players
   ├─> Calculate payoffs (RewardCalculator)
   ├─> Save trial data (Trial model)
   └─> Emit 'pd_result' to both players

5. Client: ScenePDResults
   └─> Display outcomes

[Every 5 rounds:]

6. Client: SceneOstracismVote
   └─> Emit 'ostracism_vote'

7. Server: handleOstracismVote
   ├─> Collect all votes
   ├─> Update network graph (remove edges)
   ├─> Save updated network state
   └─> Emit 'ostracism_complete'

8. Client: SceneNetworkUpdate
   └─> Display updated connections
```

---

## 🔧 Configuration Example

**Minimal `config.yaml` for Testing**:
```yaml
experiment:
  name: "Networked PD Test"

game:
  horizon: 10  # Fewer rounds for testing
  k_armed_bandit: 2

groups:
  max_group_size: 4  # Smaller group for testing
  min_group_size: 4

network:
  initial_topology: "complete"
  ostracism_enabled: true
  ostracism_frequency: 3  # Vote every 3 rounds

pairing:
  strategy: "random_valid"
  max_consecutive_repeats: 2

reward_system:
  type: "payoff_matrix"
  payoffs:
    "[0,0]": [3, 3]
    "[0,1]": [0, 5]
    "[1,0]": [5, 0]
    "[1,1]": [1, 1]
```

---

## 📈 Next Steps (Priority Order)

1. **Create client-side scene templates** (3 scenes: Pairing, Ostracism, NetworkUpdate)
2. **Register socket event handlers** in gameServer.js
3. **Run scene generation**: `npm run generate networked-pd`
4. **Test with 4 players, 10 rounds** (minimal test case)
5. **Debug and iterate** on scene flow
6. **Scale to 8 players, 30 rounds** (full experiment)
7. **Add comprehensive logging** and analytics
8. **Write unit tests** for core classes

---

## 🎯 Implementation Completeness

- **Foundation**: 100% ✅
- **Server Handlers**: 100% ✅
- **Database Models**: 100% ✅
- **Client Scenes**: 0% 🚧
- **Integration**: 0% 🚧
- **Testing**: 0% 🚧

**Overall**: ~60% complete

The server-side infrastructure is fully built and ready. The remaining work is primarily:
1. Client-side UI scenes (Phaser templates)
2. Socket event registration
3. Testing and debugging
