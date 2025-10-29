# CollectiveRewardExp - Development Priorities

**Last Updated:** 2025-10-29

## Current Status
- ✅ Quick-test example working (5 trials, 2 options, individual)
- ✅ Config-driven experiment architecture implemented
- ✅ Probability randomization with counterbalancing working
- ✅ Round summary with points and machine probabilities
- ⚠️ Database integration needs update for new config system
- ⚠️ 2-armed-individual example untested with new system

---

## Priority 1: Database Integration with Flexible Document Structure ⭐ CRITICAL

### Goal
Implement Option B - Flexible document structure that adapts to any experiment configuration.

### Current Problem
- Database schema is HARDCODED with fixed columns (optionOrder_0, optionOrder_1, optionOrder_2)
- Maximum 3 options only - cannot support 4+ armed bandits
- Data saving happens every 20 rounds, not per trial
- New config-driven experiments not fully integrated

### Solution: Flexible Document Structure
Keep core fields fixed, store variable data in flexible nested objects:

```javascript
{
  // Fixed core fields (always present)
  subjectID: "test1",
  date: "2025-10-29",
  time: "10:30:45",
  trial: 1,
  gameRound: 0,

  // Flexible experiment data (adapts to config)
  experimentData: {
    optionOrder: [2, 1, 3, 4],           // Array of any length
    probabilities: [0.9, 0.1, 0.3, 0.7], // Matches k_armed_bandit
    chosenOption: 2,
    chosenPosition: 0,
    payoff: 100,
    reactionTime: 1234,

    // Experiment-specific fields can be added here
    customField: "whatever"
  },

  // Metadata
  experimentConfig: {
    name: "Quick Test",
    horizon: 5,
    k_armed_bandit: 2,
    mode: "individual"
  }
}
```

### Implementation Tasks
1. Update `behaviouralData.js` schema to include flexible `experimentData` field
2. Modify `handleChoiceMade.js` to build flexible data structure
3. Update `savingBehaviouralData_array.js` worker to handle new structure
4. Test with quick-test (2 options)
5. Test with 4-option experiment to verify scalability
6. Add data export functionality (CSV/JSON)

### Benefits
- ✅ Supports any number of options (2, 3, 4, 5+)
- ✅ Can store experiment-specific custom data
- ✅ Backwards compatible (existing data still readable)
- ✅ Leverages MongoDB's document flexibility
- ✅ No complex schema generation needed

---

## Priority 2: Test & Update 2-Armed-Individual Example

### Goal
Verify the template system works with a richer, more realistic experiment.

### Features in 2-Armed-Individual
- **50 trials** (vs 3 in quick-test) - tests longer experiments
- **Instruction phases:**
  - Welcome screen
  - Instructions
  - Practice trials
  - Main task
  - Questionnaire
- **Different probabilities:** 30% vs 70% (closer reward rates)
- **Tests learning:** Participants need more trials to learn optimal strategy

### Implementation Tasks
1. Review 2-armed-individual config.yaml
2. Update any legacy config format to new system
3. Test sequence flow (welcome → instruction → practice → main → questionnaire)
4. Verify practice trials work correctly
5. Ensure data saving works for 50-trial experiment
6. Document any issues or missing features

### Success Criteria
- All instruction phases display correctly
- Practice trials function properly
- 50 trials run smoothly without errors
- Data saved correctly to database
- Round summary shows correct totals

---

## Priority 3: Add Missing Single-Player Features

### 3.1 Practice Trial Configuration
**Current:** Practice scenes exist but not integrated with config system
**Needed:** YAML config for practice trial parameters

```yaml
practice:
  enabled: true
  trials: 3
  feedback: true
  probabilities: [0.5, 0.5]  # Can differ from main task
```

### 3.2 Comprehension Check Integration
**Current:** SceneUnderstandingTest exists but not in sequences
**Needed:**
- Add to sequence YAML as optional step
- Configure pass/fail criteria in config
- Handle retry logic

### 3.3 Flexible Payment/Bonus Calculation
**Current:** Hardcoded flat bonus
**Needed:**
```yaml
payment:
  flat_fee: 2.0
  completion_fee: 1.0
  performance_bonus:
    enabled: true
    points_per_pound: 100  # 100 points = £1
    min_bonus: 0
    max_bonus: 5.0
```

### 3.4 Data Export Tools
**Needed:**
- Export to CSV for SPSS/R analysis
- Export to JSON for Python/JavaScript processing
- Filter by experiment, date range, subject
- Include experiment metadata in export

---

## Priority 4: Group Experiments (Later)

### Goal
Support multi-player experiments with waiting rooms and social information.

### Tasks (Deferred)
1. Create simple-group-task example (2-3 players, 10 trials, 3 options)
2. Test waiting room functionality with new config system
3. Verify social information tracking
4. Test room management and group formation
5. Handle disconnections and timeouts

### Note
**Only start after single-player system is rock solid.**

---

## Database Approach Decision

### Selected: Option B - Flexible Document Structure ✅

**Why Option B over Option A:**
- Simpler to implement
- Backwards compatible
- MongoDB-native approach
- No schema generation complexity
- Easier to add experiment-specific fields
- Better for rapid prototyping

**Option A (Dynamic Schema per Experiment)** rejected because:
- Over-engineered for current needs
- Schema migration challenges
- Harder to maintain
- Not leveraging MongoDB's flexibility

---

## Data Export Requirements

### Formats Needed
1. **CSV** - Primary format for statistical analysis (SPSS, R, Excel)
2. **JSON** - Secondary format for custom processing (Python, JavaScript)

### Export Features
- Filter by experiment name
- Filter by date range
- Filter by subject ID
- Include experiment configuration in export
- Wide format (one row per trial) vs long format option
- Automated exports on experiment completion

---

## Testing Strategy

### For Each Priority
1. **Unit Testing:** Test individual components
2. **Integration Testing:** Test full experiment flow
3. **Edge Cases:** Test with unusual configs (1 option, 10 options, etc.)
4. **User Testing:** Run through experiment as a participant
5. **Database Verification:** Check data is saved correctly

### Test Experiments
- **quick-test:** Minimal test (5 trials, 2 options)
- **2-armed-individual:** Standard experiment (50 trials, instructions, practice)
- **4-armed-test:** (To be created) Test scalability (20 trials, 4 options)
- **extreme-test:** (To be created) Edge case testing (100 trials, 10 options)

---

## Next Immediate Steps

1. ✅ Document priorities (this file)
2. 🔄 Implement flexible database structure (Priority 1)
3. 🔄 Test with quick-test to verify
4. 🔄 Update and test 2-armed-individual (Priority 2)
5. ⏳ Add missing features (Priority 3)

---

## Questions for Future Discussion

1. Should questionnaire responses be saved to behavioral database or separate collection?
2. Need for real-time experiment monitoring dashboard?
3. Data retention policy - how long to keep raw data?
4. Multi-language support needed for instructions?
5. Mobile device support priority?

---

## References

- `/content/experiments/examples/quick-test/` - Minimal working example
- `/content/experiments/examples/2-armed-individual/` - Rich example with instructions
- `/server/database/models/behaviouralData.js` - Current database schema
- `/server/socket/handleChoiceMade.js` - Choice event handler and data saving
- `/server/services/ExperimentLoader.js` - Config loader with validation
