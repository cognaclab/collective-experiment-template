# Networked Prisoner's Dilemma (NEDPD) Experiment

## Overview

This experiment implements a **Network-Embedded Dyadic Prisoner's Dilemma** with 8 players over 30 rounds. Players can dynamically exclude partners through ostracism votes every 5 rounds, creating an evolving social network.

## Key Features

- **8-player groups** with real-time multiplayer coordination
- **30 rounds** of iterated Prisoner's Dilemma
- **Dynamic partner pairing** - players are randomly paired each round
- **Ostracism mechanism** - vote to "break links" with partners every 5 rounds
- **Network evolution** - track how the social network fragments over time
- **Comprehensive data logging** - network states, cooperation rates, exclusion patterns

## Architecture

### Network System

#### NetworkGraph (`server/utils/NetworkGraph.js`)
- Manages the social network as an **adjacency matrix**
- Initialized as a **complete graph** (all players connected)
- Supports **edge removal** when players ostracize each other
- Tracks **isolated players**, **network density**, and **connected components**

**Key Methods**:
- `hasEdge(player1, player2)` - Check if two players can interact
- `removeEdge(player1, player2)` - Sever connection (unilateral)
- `getValidPartners(playerId)` - Get all possible partners
- `isIsolated(playerId)` - Check if player has any connections
- `getDensity()` - Calculate network density (0-1)
- `getConnectedComponents()` - Find disconnected subgroups

#### PairingManager (`server/utils/PairingManager.js`)
- Generates **valid pairings** each round based on network state
- Avoids **consecutive repeats** (configurable max_consecutive_repeats)
- Handles **isolated players** (those with no valid partners)

**Pairing Strategies**:
- `random_valid` (default) - Random pairing from valid partners
- `round_robin` - Systematic rotation through all partners
- `preferential_attachment` - Pair high-degree players first

**Key Methods**:
- `generatePairings(roundNum, playerIds)` - Create round pairings
- `getPairHistory(player1, player2)` - Get history between two players
- `getTimesP aired(player1, player2)` - Count interactions

### Database Models

#### NetworkState (`server/database/models/NetworkState.js`)
Stores network snapshot for each round:
- **Adjacency matrix** - Full network state
- **Network metrics** - Total edges, density, connectivity
- **Isolated players** - Who has no partners
- **Ostracism votes** - Who voted to break with whom
- **Pairings** - Who played with whom this round

#### Trial Model Extensions
Added `networkData` field to track:
- **Partner information** - Current partner ID, pairing history
- **Cooperation data** - Mutual cooperation, exploitation, defection
- **Ostracism data** - Votes, link breakage, initiator
- **Network snapshot** - Degree, density, isolation status

### Room State Extensions (`server/utils/roomFactory.js`)

Added fields to room object:
```javascript
{
  network: NetworkGraph instance,
  pairingManager: PairingManager instance,
  currentPairings: [[p1, p2], ...],
  isolatedPlayers: [playerId, ...],
  ostracismVotes: { roundNum: { playerId: { vote, partnerId } } },
  cooperationHistory: { playerId: { partnerId: [choices] } },
  roundNumber: 0
}
```

## Configuration

### config.yaml Parameters

```yaml
game:
  horizon: 30                    # Total rounds

groups:
  max_group_size: 8              # 8 players per group
  min_group_size: 8              # Require full group

network:
  initial_topology: "complete"   # Start fully connected
  ostracism_enabled: true
  ostracism_frequency: 5         # Vote every 5 rounds
  ostracism_type: "unilateral"   # Either player can break
  edge_removal_rule: "either"    # If EITHER votes break, edge removed

pairing:
  strategy: "random_valid"
  allow_repeat_partners: true
  max_consecutive_repeats: 2     # Avoid pairing same player 3+ times in a row
  isolation_handling: "sit_out"  # Isolated players skip rounds

reward_system:
  type: "payoff_matrix"
  payoffs:
    "[0,0]": [3, 3]   # Both cooperate
    "[0,1]": [0, 5]   # Sucker's payoff / Temptation
    "[1,0]": [5, 0]   # Temptation / Sucker's payoff
    "[1,1]": [1, 1]   # Both defect
```

## Experiment Flow

### Phase 1: Introduction (Scenes 1-4)
1. **Welcome** - Overview of experiment
2. **PD Instructions** - Payoff matrix explanation
3. **Network Instructions** - How pairing works
4. **Ostracism Instructions** - Partner selection mechanism

### Phase 2: Waiting Room
- Wait for 8 players to join
- Show player count in real-time

### Phase 3: Main Game (30 rounds)

**Each round consists of**:
1. **Pairing Scene** - Shows your partner for this round
2. **Choice Scene** - Cooperate or Defect decision
3. **Results Scene** - Both choices and payoffs revealed

**Every 5 rounds (5, 10, 15, 20, 25, 30)**:
4. **Ostracism Vote** - Vote to continue or break link with partner
5. **Network Update** - View current connections

### Phase 4: End Game
- **Final Summary** - Total earnings, cooperation rate, network stats
- **Questionnaire** - Strategy questions, ostracism reasoning

## Data Collected

### Per Trial
- Player's choice (cooperate/defect)
- Partner's choice
- Both payoffs
- Reaction time
- Partner ID and history
- Cooperation pattern (mutual, exploitation, etc.)

### Per Ostracism Round
- Player's vote (continue/break)
- Partner's vote
- Whether link was broken
- Who initiated the break

### Per Round (Network States)
- Complete adjacency matrix
- Network density
- Isolated player count
- Connected components
- Edge removals with timestamps

## Implementation Status

### ✅ Completed
- [x] Experiment directory structure
- [x] Configuration file (config.yaml)
- [x] Scene sequences definition
- [x] Instruction markdown files
- [x] NetworkGraph class (full network management)
- [x] PairingManager class (partner assignment)
- [x] roomFactory extensions (network state)
- [x] NetworkState database model
- [x] Trial model network extensions

### 🚧 TODO (Next Steps)
- [ ] Round progression event handlers
  - [ ] `handlePairingStart.js` - Generate pairings and emit to clients
  - [ ] `handleNetworkedPDChoice.js` - Collect choices from paired players
  - [ ] `handleOstracismVote.js` - Process exclusion votes
  - [ ] `handleNetworkUpdate.js` - Update graph and save state
- [ ] Client-side scene templates
  - [ ] `ScenePDPairing.js` - Display partner assignment
  - [ ] `SceneOstracismVote.js` - Voting interface
  - [ ] `SceneNetworkUpdate.js` - Network visualization
  - [ ] `SceneIsolationWarning.js` - Notify isolated players
- [ ] Scene generation for networked-pd
- [ ] Testing with 8-player simulation

## Research Questions

This implementation supports investigation of:

1. **Cooperation dynamics** - How does repeated interaction affect cooperation?
2. **Ostracism effects** - Does the ability to exclude partners increase/decrease cooperation?
3. **Network fragmentation** - How quickly do networks break apart?
4. **Isolated player behavior** - What predicts becoming isolated?
5. **Reputation effects** - Do cooperation rates affect partner retention?

## Technical Notes

### Network Constraints
- Pairings respect the **current network graph** (no pairing across broken links)
- **Isolated players** (degree = 0) cannot be paired and sit out rounds
- **Odd unpaired player** can occur if network fragmentation creates uneven groups

### Ostracism Rules
- **Unilateral** - If EITHER player votes "break", the edge is removed
- **Bidirectional** - Removing edge A→B also removes B→A
- **Irreversible** - Once broken, links cannot be restored
- **Anonymous** - Players don't immediately see partner's vote

### Pairing Algorithm
1. Check network for valid partners (connected via edge)
2. Exclude recent partners (avoid repeats within N rounds)
3. Randomly pair from remaining valid partners
4. Mark isolated players as "unpaired"
5. Store pairing history

## References

This implementation is based on:
- **Zajkowski et al. (2024)** - Network-Embedded Dyadic Prisoner's Dilemma (NEDPD)
- **Classic Prisoner's Dilemma** - Axelrod's iterated PD tournaments
- **Social network dynamics** - Exclusion mechanisms in cooperation studies
