# Implementation Plan: Network-Embedded Dyadic Prisoner's Dilemma

**Date:** 2025-11-17
**Status:** ~60% Complete (Backend done, Frontend scenes needed)
**Estimated Remaining:** 15-18 hours

---

## Experiment Overview

**Network-Embedded Dyadic Prisoner's Dilemma (NEDPD)** based on Zajkowski et al. (2024):
- **8 players** in a complete graph network
- **30 rounds** of pairwise Prisoner's Dilemma
- **Ostracism every 5 rounds** (rounds 5, 10, 15, 20, 25, 30)
- **Unilateral edge removal** - either player can break connection
- **Isolated players** sit out remaining rounds

**Payoff Matrix:**
| P1 ↓ / P2 → | Cooperate | Defect |
|-------------|-----------|--------|
| Cooperate   | 3, 3      | 0, 5   |
| Defect      | 5, 0      | 1, 1   |

---

## Current Status

### ✅ COMPLETED: Backend Infrastructure (100%)

**Database Models:**
- `NetworkState.js` - Stores network adjacency matrix snapshots
- `Trial.js` - Extended with `networkData` field for partner info

**Server Utilities:**
- `NetworkGraph.js` - 8×8 adjacency matrix with edge removal operations
- `PairingManager.js` - Network-constrained pairing algorithm

**Socket Handlers:**
- `handlePairingStart.js` - Generates pairings based on current network
- `handleNetworkedPDChoice.js` - Collects choices, calculates payoffs
- `handleOstracismVote.js` - Processes votes, updates network graph

**Configuration:**
- `roomFactory.js` - Auto-initializes network for networked experiments
- Backend tested and working

---

### ⚠️ IN PROGRESS: Frontend (50%)

**Completed:**
- `config.yaml` - Full network/pairing/ostracism configuration
- Instruction files (4 markdown files)
- `sequences/main.yaml` - Correct structure but only 1 round

**Missing:**
- ❌ ScenePDPairing.js
- ❌ SceneOstracismVote.js
- ❌ SceneNetworkUpdate.js
- ❌ Sequence expansion (1 round → 30 rounds)
- ❌ Socket handler registration in gameServer.js

---

## Implementation Plan

### Phase 1: Create Frontend Scenes (6-8 hours)

#### 1.1 ScenePDPairing.js
**Location:** `client/public/src/scenes/example/ScenePDPairing.js`

**Purpose:** Display partner assignment before each round

**Socket Events:**
- Listen: `pairing_assigned` → show partner info
- Emit: `scene_complete` → continue to choice

**UI Elements:**
- Round number (e.g., "Round 12 of 30")
- Partner info ("Paired with Player 5")
- Cooperation history (if available)
- Network status ("5 connections remaining")
- Continue button

**Edge Cases:**
- Isolated player → show message, auto-skip
- Unpaired (odd count) → show message, auto-skip

---

#### 1.2 SceneOstracismVote.js
**Location:** `client/public/src/scenes/example/SceneOstracismVote.js`

**Purpose:** Vote to maintain or break edge with partner

**Socket Events:**
- Emit: `ostracism_vote` → send vote to server
- Listen: `ostracism_complete` → proceed to network update

**UI Elements:**
- Partner summary ("You played with Player 5")
- Round outcome ("Both cooperated - 3 points each")
- Cooperation history ("Partner cooperated 3 of 5 times")
- Two buttons: "Continue Partnership" (green), "Break Connection" (red)
- Warning: "Breaking a connection is permanent"

---

#### 1.3 SceneNetworkUpdate.js
**Location:** `client/public/src/scenes/example/SceneNetworkUpdate.js`

**Purpose:** Show network changes after ostracism

**Socket Events:**
- Listen: `network_summary` → display changes
- Emit: `scene_complete` → continue to next round

**UI Elements:**
- Summary ("3 edges were removed this round")
- Network status ("You can interact with 5 players")
- Available partners ("Players 1, 3, 4, 6, 7")
- Network density ("75% connected")
- Auto-advance after 5 seconds OR continue button

---

### Phase 2: Register Socket Handlers (30 mins)

**File:** `server/servers/gameServer.js`

**Add imports:**
```javascript
const handlePairingStart = require('../socket/handlePairingStart');
const handleNetworkedPDChoice = require('../socket/handleNetworkedPDChoice');
const handleOstracismVote = require('../socket/handleOstracismVote');
```

**Add listeners:**
```javascript
socket.on('pairing_start', (data) => handlePairingStart(data, socket, io, rooms));
socket.on('networked_pd_choice', (data) => handleNetworkedPDChoice(data, socket, io, rooms));
socket.on('ostracism_vote', (data) => handleOstracismVote(data, socket, io, rooms));
```

**Fix event naming in ScenePDChoice.js:**
- Detect networked mode: `window.gameConfig?.network?.ostracism_enabled`
- Emit `networked_pd_choice` (not `choice_made`) for networked experiments

---

### Phase 3: Expand Sequence (2-3 hours)

**File:** `content/experiments/networked-pd/sequences/main.yaml`

**Current:** 1 round
**Target:** 30 rounds with ostracism at rounds 5, 10, 15, 20, 25, 30

**Pattern:**
```yaml
# Rounds 1-4: Pairing → Choice → Results
# Round 5: Pairing → Choice → Results → OstracismVote → NetworkUpdate
# Rounds 6-9: Pairing → Choice → Results
# Round 10: Pairing → Choice → Results → OstracismVote → NetworkUpdate
# ... repeat ...
# Round 30: Pairing → Choice → Results → OstracismVote → NetworkUpdate → Questionnaire → End
```

**Total scenes:** ~109 entries
- 4 instruction scenes
- 1 waiting room
- 30 × 3 = 90 (pairing, choice, results)
- 6 × 2 = 12 (ostracism, network update)
- 2 end scenes

---

### Phase 4: Generate & Test (4-6 hours)

**1. Generate experiment:**
```bash
npm run generate networked-pd
```

**2. Test progression:**
- **Level 1:** Single scene testing (each scene in isolation)
- **Level 2:** 4 players, 6 rounds (test config with ostracism at rounds 3, 6)
- **Level 3:** Edge cases (isolation, disconnection, timeouts)
- **Level 4:** Full scale (8 players, 30 rounds)

**3. Create test config:**
`content/experiments/networked-pd/config-test.yaml`:
- 4 players (min viable)
- 6 rounds (ostracism at rounds 3, 6)
- Faster iteration for debugging

---

## Integration Points

### Data Flow

**Pairing:**
1. Client emits `pairing_start`
2. Server generates pairings via PairingManager
3. Server emits `pairing_assigned` with partner info
4. Client displays partner, user clicks continue

**Choice:**
1. Client emits `networked_pd_choice` with choice + partnerId
2. Server waits for both players
3. Server calculates payoffs from matrix
4. Server saves to Trial collection
5. Server emits `choice_result` to both players

**Ostracism:**
1. Client emits `ostracism_vote` with vote (maintain/break)
2. Server collects all votes
3. Server updates NetworkGraph (removes edges)
4. Server saves to NetworkState collection
5. Server emits `network_summary` to all players

---

## Database Schema

### NetworkState Collection
```javascript
{
  experimentName: "Networked Prisoner's Dilemma",
  roomId: "room_abc",
  roundNumber: 5,
  adjacencyMatrix: [[...]], // 8×8 boolean
  totalEdges: 18,
  density: 0.75,
  isolatedPlayers: [],
  playerDegrees: [{ playerId: 0, degree: 6 }, ...],
  ostracismVotes: [{ playerId: 0, partnerId: 2, vote: "break" }, ...],
  pairings: [[0,1], [2,3], [4,5], [6,7]]
}
```

### Trial Collection (networkData field)
```javascript
{
  networkData: {
    partnerId: "abc123",
    partnerSubjectId: "player2",
    timesPlayedWithPartner: 3,
    partnerChoice: { optionId: 0, payoff: 3 },
    cooperationHistory: { /* ... */ },
    ostracismData: { /* vote, linkBroken, etc */ },
    networkSnapshot: { /* edges, density, etc */ },
    playerStatus: { isIsolated: false, validPartnerCount: 6 }
  }
}
```

---

## Implementation Order

1. **Create 3 Phaser scenes** (ScenePDPairing, SceneOstracismVote, SceneNetworkUpdate) - 6-8 hours
2. **Register socket handlers** in gameServer.js - 30 mins
3. **Expand sequences** to 30 rounds with ostracism - 2-3 hours
4. **Generate & test** (iterative debugging) - 4-6 hours

**Total:** 15-18 hours

---

## Success Criteria

- ✅ 8 players form complete network
- ✅ Pairings respect network connections
- ✅ Choices collected, payoffs calculated correctly
- ✅ Ostracism votes update network
- ✅ Isolated players handled gracefully
- ✅ All 30 rounds complete successfully
- ✅ Data logged to NetworkState and Trial collections

---

## Notes

- Backend is production-ready and tested
- Frontend work is primarily scene creation
- Use existing PD scenes as templates
- Test incrementally (scenes → flow → full scale)
- Monitor MongoDB for data integrity

**Last Updated:** 2025-11-17
