# Experiment Examples

This directory contains simple example experiments that you can use to learn from and build upon.

## Available Examples

### 1. `quick-test/`
**Perfect for:** Testing your setup
- ✅ Individual task (no waiting)
- ✅ Only 3 trials (~1 minute)
- ✅ Clear winner option (90% vs 10%)
- ✅ Minimal questionnaire

```bash
npm run generate examples/quick-test
npm run experiment
# Visit: http://localhost:8000/?subjectID=test
```

### 2. `2-armed-individual/`
**Perfect for:** Learning individual decision tasks
- ✅ Individual task
- ✅ 50 trials for learning patterns
- ✅ 2 options (30% vs 70%)
- ✅ Good for studying individual learning

```bash
npm run generate examples/2-armed-individual
npm run experiment
```

### 3. `simple-group-task/`
**Perfect for:** Learning group experiments
- ✅ Small groups (2-3 people)
- ✅ Short task (10 trials)
- ✅ 3 options (20%, 50%, 80%)
- ✅ Group cooperation focus

```bash
npm run generate examples/simple-group-task
npm run experiment
# Open 3 tabs with different subjectIDs to test group formation
```

## How to Use These Examples

### 1. Generate and Run
```bash
# Generate templates from any example
npm run generate examples/quick-test

# Run the generated experiment (auto-reloads on changes)
npm run experiment
```

### 2. Copy and Modify
```bash
# Copy an example to create your own version
cp -r content/experiments/examples/quick-test content/experiments/my-experiment

# Edit the files in my-experiment/
# Then generate and run your version:
npm run generate my-experiment
npm run experiment
```

### 3. Rapid Development
```bash
# Terminal 1: Auto-regenerate when content changes
npm run generate:watch examples/quick-test

# Terminal 2: Run experiment (auto-reloads when regenerated)
npm run experiment

# Now edit YAML/Markdown files and see changes instantly!
```

### 4. Learn from the Structure

Each example shows you:
- **config.yaml** - How to configure different experiment types
- **instructions/welcome.md** - How to write participant instructions
- **instructions/questionnaire.md** - How to create surveys
- **sequences/main.yaml** - How to structure the experiment flow

## Key Differences Between Examples

| Feature | quick-test | 2-armed-individual | simple-group-task |
|---------|------------|-------------------|------------------|
| **Players** | 1 (individual) | 1 (individual) | 2-3 (group) |
| **Trials** | 3 | 50 | 10 |
| **Options** | 2 | 2 | 3 |
| **Duration** | 1 min | 10-15 min | 5-10 min |
| **Purpose** | Testing setup | Learning patterns | Group cooperation |
| **Complexity** | Minimal | Medium | Medium |

## Testing with Multiple Participants

For group experiments, open multiple browser tabs:
- `http://localhost:8000/?subjectID=player1`
- `http://localhost:8000/?subjectID=player2`
- `http://localhost:8000/?subjectID=player3`

## Next Steps

1. **Try all examples** to see different experiment types
2. **Copy and modify** an example that's close to what you want
3. **Read the main documentation** for advanced features
4. **Check the default experiment** for a full-featured example

Happy experimenting! 🎉