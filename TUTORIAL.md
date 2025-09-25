# Step-by-Step Tutorial: Creating Your First Template Experiment

This tutorial will guide you through creating a simple 3-armed bandit experiment using the template system.

## Tutorial Overview
- **Time**: ~30 minutes
- **Goal**: Create a working 3-armed group bandit task
- **Skills**: Markdown editing, YAML configuration, basic experiment design

## Step 1: Setup and Installation (5 min)

### 1.1 Check Prerequisites
```bash
node --version    # Should be v14+ 
npm --version     # Should be v6+
```

### 1.2 Install Dependencies
```bash
npm install
```

### 1.3 Start MongoDB (if using data collection)
```bash
# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or use Docker
docker run -d -p 27017:27017 mongo:latest
```

### 1.4 Test Basic Setup
```bash
npm run example
```
Open `http://localhost:8000?subjectID=TUTORIAL_TEST` to verify the system works.

Stop the server with Ctrl+C before continuing.

## Step 2: Create Your First Template Experiment (10 min)

### 2.1 Examine the Template Structure
```bash
ls content/experiments/default/
```
You should see:
- `config.yaml` - Experiment configuration
- `sequences/main.yaml` - Experiment flow
- `instructions/` - Markdown instruction files  
- `pages/` - Markdown page templates

### 2.2 Configure Basic Parameters

Edit `content/experiments/default/config.yaml`:
```yaml
experiment:
  name: "3-Armed Group Bandit Tutorial"
  description: "A tutorial experiment with 3 options and group play"

game:
  numOptions: 3
  maxGroupSize: 4
  minGroupSize: 2  
  horizon: 15
  maxChoiceStageTime: 8000
  maxWaitingTime: 30000

conditions:
  indivOrGroup: group
  taskType: static
  exp_condition: tutorial
```

### 2.3 Customize the Welcome Message

Edit `content/experiments/default/instructions/welcome.md`:
```markdown
---
title: "Welcome to the Tutorial"
navigation: button
---

# 3-Armed Bandit Tutorial

Welcome! In this experiment, you will work **together with other participants** to solve a decision-making task.

## What You'll Do
1. Choose from 3 different options repeatedly
2. See the team's total reward (not individual rewards)
3. Try to maximize the group's earnings

{if condition="group"}
You will be working with **{{maxGroupSize-1}} other participants** as a team.
{else}
You will be working individually.
{/if}

**Ready to begin?** Click Continue to start.
```

### 2.4 Update Instructions

Edit `content/experiments/default/instructions/instruction.md`:
```markdown
---
title: "Task Instructions"  
navigation: button
---

# How the Task Works

## The 3-Armed Bandit
- You will see **3 colored options** (boxes)
- Each option gives rewards with different probabilities
- **Your goal**: Find and choose the most rewarding options

## Group Rules
{if condition="group"}
- All group members choose at the same time  
- You see the **total team reward** each round
- Individual rewards remain hidden
- Work together to maximize team earnings!
{else}
- You will see your individual reward each round
- Try to maximize your personal earnings
{/if}

## Time Limits
- You have **8 seconds** to make each choice
- If you don't choose in time, a random option will be selected
- The task has **15 rounds** total

Click Continue when you understand the rules.
```

### 2.5 Start Template Mode
```bash
npm run dev
```

### 2.6 Test Your Experiment
1. Open: `http://localhost:8000?subjectID=TUTORIAL_TEST`
2. You should see your customized welcome message
3. Click through to see your customized instructions
4. Note how group/individual content changes based on configuration

## Step 3: Customize the Questionnaire (5 min)

### 3.1 Create a Custom Survey

Edit `content/experiments/default/pages/questionnaire.md`:
```markdown
---
title: "Tutorial Survey"
type: "questionnaire"
---

# Tutorial Feedback Survey

Thanks for completing the 3-armed bandit tutorial! Please answer a few questions about your experience.

## About You

{input: age, number, "What is your age?", required}

{select: gender, "What is your gender?", required}
- Male
- Female  
- Non-binary
- Prefer not to say
{/select}

{select: education, "Highest education level?"}
- High school
- Bachelor's degree
- Master's degree
- PhD or higher
- Other
{/select}

## Tutorial Experience

{likert: difficulty, "How difficult was the tutorial?", 1-5}
*1 = Very Easy, 5 = Very Hard*

{radio: strategy, "What strategy did you use?"}
- Explored all options equally
- Focused on the best option once found
- Kept switching between options
- No particular strategy
{/radio}

{textarea: feedback, "Any feedback about the tutorial?", rows=3, optional}

## Group Dynamics
{if condition="group"}
{likert: teamwork, "How well did your team work together?", 1-7}
*1 = Very Poorly, 7 = Extremely Well*

{radio: communication, "Did you feel you could communicate with your team?"}
- Yes, very well
- Somewhat  
- Not really
- No, not at all
{/radio}
{/if}

---
*Thank you for your participation in this tutorial!*
```

### 3.2 Test the Survey
1. Refresh your browser at the experiment URL
2. Navigate through the experiment
3. You should see your customized questionnaire

## Step 4: Experiment Flow and Testing (5 min)

### 4.1 Understand the Flow

Check `content/experiments/default/sequences/main.yaml`:
```yaml
sequence:
  - scene: welcome
    type: instruction
    content: welcome.md
    next: instruction
    
  - scene: instruction
    type: instruction  
    content: instruction.md
    next: tutorial_intro
    
  - scene: tutorial_intro
    type: instruction
    content: tutorial.md
    next: waiting_room
    
  - scene: waiting_room
    type: waiting
    max_wait_time: 30000
    next: game_round_1
    
  - scene: game_round_1
    type: game
    environment: static
    trials: 15
    next: questionnaire
    
  - scene: questionnaire
    type: questionnaire
    next: end
```

### 4.2 Test Complete Flow

1. Open multiple browser tabs with different subject IDs:
   - `http://localhost:8000?subjectID=TUTORIAL_P1`
   - `http://localhost:8000?subjectID=TUTORIAL_P2`

2. Complete the flow in both tabs simultaneously:
   - Welcome screen → Instructions → Waiting room
   - Once 2+ participants are ready, the game will start
   - Complete the bandit task
   - Fill out the questionnaire

### 4.3 Check Live Reload

While the servers are running:
1. Edit any Markdown file (e.g., change welcome message)
2. Save the file
3. Refresh browser - changes should appear immediately
4. Check console - you should see template regeneration

## Step 5: Troubleshooting and Next Steps (5 min)

### 5.1 Common Issues

**Experiment won't start**
```bash
# Check if generation succeeded
npm run template:generate

# Look for errors in output
# Check server logs for template loading
```

**Group not forming**
- Check `minGroupSize` in config.yaml
- Open enough browser tabs to meet minimum
- Check server logs for connection issues

**Changes not appearing**
- Verify template watcher is running (should see regeneration in console)
- Hard refresh browser (Ctrl+Shift+R)
- Check for YAML syntax errors

### 5.2 View Generated Files

Explore what the system created:
```bash
# Generated scenes
ls client/public/src/generated/scenes/

# Generated templates  
ls client/views/generated/

# Compiled data
cat client/public/src/generated/compiled_scenes.json
```

### 5.3 Switch to Example Mode

Compare your template experiment with the original:
```bash
# Stop current server (Ctrl+C)
npm run example
```
Open the same URL to see the original hardcoded experiment.

### 5.4 Next Steps

**Try Different Configurations:**
- Change to individual mode: `indivOrGroup: individual`
- Adjust number of options: `numOptions: 2` or `numOptions: 4`
- Modify time limits and trial counts

**Advanced Features:**
- Add conditional content for different experiment conditions
- Create multi-round experiments with breaks
- Customize visual styling via CSS
- Add custom JavaScript for complex interactions

**Data Analysis:**
- Check MongoDB for collected data
- Export CSV files for analysis
- Review real-time logs

## Congratulations! 🎉

You've successfully created a template-driven behavioral experiment! The template system allows you to:

✅ **Create experiments using Markdown instead of JavaScript**
✅ **Configure parameters via YAML files**  
✅ **Use conditional content for different experimental conditions**
✅ **Collect data with the same robustness as hardcoded experiments**
✅ **Iterate quickly with live reload during development**

### What's Next?

- Read the [Extended Markdown Reference](MARKDOWN-REFERENCE.md) for more syntax options
- Check the [Configuration Guide](CONFIG-REFERENCE.md) for advanced settings  
- Look at the [2-Armed Individual Example](examples/2-armed-individual.md)
- Explore the [3-Armed Group Example](examples/3-armed-group.md)

Happy experimenting!