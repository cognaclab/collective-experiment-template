# Prisoner's Dilemma - Multiplayer Test Experiment

A minimal 2-player prisoner's dilemma experiment designed to test the multiplayer functionality of the refactored codebase.

## Overview

- **Players:** 2 (exactly)
- **Trials:** 3 rounds
- **Choices:** Cooperate (0) or Defect (1)
- **Mode:** Multiplayer (group)

## Payoff Matrix

| Your Choice | Partner's Choice | Your Points | Partner's Points |
|------------|------------------|-------------|------------------|
| Cooperate  | Cooperate        | 3           | 3                |
| Cooperate  | Defect           | 0           | 5                |
| Defect     | Cooperate        | 5           | 0                |
| Defect     | Defect           | 1           | 1                |

## Running the Experiment

### Prerequisites

1. **MongoDB running:**
   ```bash
   npm run docker:up
   ```

2. **Environment configured:**
   Ensure `.env` file exists with proper settings (default values should work).

### Start the Experiment

```bash
npm run pd-test
```

This will start both:
- **Web server** on port 8000 (http://localhost:8000)
- **Game server** on port 8181

### Testing Multiplayer

1. Open two browser windows/tabs
2. Navigate to http://localhost:8000 in both
3. Both players will be matched in a waiting room
4. Once both are ready, the experiment begins
5. Play through 3 trials:
   - Make choice (Cooperate/Defect)
   - Wait for partner
   - See results showing both choices and payoffs
6. Complete questionnaire
7. View payment summary

## Expected Flow

```
SceneWelcome (instructions)
    ↓
SceneWaitingRoom (match players)
    ↓
Trial 1: ScenePDChoice → ScenePDResults
    ↓
Trial 2: ScenePDChoice → ScenePDResults
    ↓
Trial 3: ScenePDChoice → ScenePDResults
    ↓
SceneGoToQuestionnaire → /questionnaire → /endPage
```

## What's Being Tested

### Multiplayer Synchronization
- ✅ Player matching (2 players required)
- ✅ Waiting for both players to make choices
- ✅ Simultaneous results display
- ✅ Scene synchronization (both players advance together)

### Server-Side Logic
- ✅ Payoff calculation based on matrix (server authority)
- ✅ Individual payoff tracking per player
- ✅ Social information (partner's choice) sharing
- ✅ Timeout/miss handling

### Data Logging
- ✅ Trial-level data (choices, payoffs, RTs)
- ✅ Session-level data (total points, payment)
- ✅ Both players' choices stored in database

## Files Created

### Configuration
- `config.yaml` - Experiment settings and payoff matrix
- `sequences/main.yaml` - Scene flow definition

### Content
- `instructions/welcome.md` - Game rules and payoff table
- `pages/questionnaire.html` - Post-experiment survey

### Scene Implementations
- `client/public/src/scenes/example/ScenePDChoice.js` - Choice UI (2 buttons)
- `client/public/src/scenes/example/ScenePDResults.js` - Results display

### Server Logic
- Modified `server/socket/handleChoiceMade.js` - PD payoff calculation
- Modified `server/socket/handleSceneComplete.js` - PD results scene data

## Debugging

### Check MongoDB Data

```bash
npm run db:shell
```

```javascript
// View all sessions
db.sessions.find({ experimentName: "Prisoner's Dilemma Test" }).pretty()

// View all trials
db.trials.find({ experimentName: "Prisoner's Dilemma Test" }).pretty()

// View specific session's trials
db.trials.find({ sessionId: "YOUR_SESSION_ID" }).pretty()
```

### Clean Test Data

```bash
# Clean specific experiment
npm run db:clean -- --exp "Prisoner's Dilemma Test" --confirm

# Clean all data
npm run db:clean -- --all --confirm
```

### Server Logs

Watch for these log messages:
- `[PD PAYOFF] Calculating payoffs for trial X`
- `[PD PAYOFF] Player choices: { ... }`
- `[PD PAYOFF] Calculated payoffs: ...`
- `[SCENE COMPLETE] scene=ScenePDResults`

## Payment Calculation

- **Base payment:** £0.50
- **Completion bonus:** £0.25
- **Points conversion:** 1 penny per point
- **Max earnings:** £0.90 (15 points if you defect 3 times while partner cooperates)
- **Typical earnings:** £0.84 (9 points if both cooperate 3 times)

## Known Limitations (Minimal Test)

- No practice trials
- No comprehension test
- No bot support
- Fixed 3 trials only
- Simplified questionnaire

## Next Steps for Full Implementation

1. Add practice trials with feedback
2. Add comprehension test
3. Support variable number of trials (horizon)
4. Add multi-round support
5. Add more sophisticated questionnaire
6. Add bot players for solo testing
7. Add visual improvements to scenes

## Troubleshooting

### Players don't match
- Check that both browsers connect successfully
- Check MongoDB is running (`docker ps`)
- Check game server logs for connection errors

### Scenes don't transition
- Check browser console for errors
- Check that `start_scene` events are being received
- Verify ExperimentFlow is initialized

### Payoffs are wrong
- Check `[PD PAYOFF]` logs in game server
- Verify config.yaml payoff matrix values
- Check Trial records in MongoDB

### Timeout handling
- If player doesn't choose in 10 seconds, they're shown SceneAskStillThere
- After confirmation, they proceed to results with 0 payoff
