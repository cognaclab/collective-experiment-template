# Experiment Creation Guide

This guide teaches you how to create your own collective behavior experiments from scratch using the template system.

## 🎯 Overview: How Experiments Work

The platform uses a **template-based approach** where you write content in simple formats and the system generates the technical code for you.

### Your Input (Simple)
- **YAML configuration** - Experiment settings
- **Markdown files** - Text that participants see
- **Simple syntax** - For conditional content and forms

### System Output (Complex)
- **Phaser game scenes** - Interactive experiment interface
- **Socket.io integration** - Real-time multiplayer
- **Database integration** - Data collection
- **Web server routes** - Complete web application

## 📁 Experiment Structure

Every experiment has this structure:

```
my-experiment/
├── config.yaml              # Main experiment configuration
├── sequences/
│   └── main.yaml            # Define the flow of scenes
├── instructions/
│   ├── welcome.md           # Consent/welcome page
│   ├── tutorial.md          # How to play (optional)
│   ├── questionnaire.md     # Post-experiment survey
│   └── other-pages.md       # Any other instruction pages
└── pages/                   # Additional custom pages (optional)
```

## 🛠️ Step-by-Step Creation Process

### Step 1: Create Your Experiment Directory

```bash
# Option A: Copy an existing example
cp -r content/experiments/examples/quick-test content/experiments/my-study

# Option B: Copy the default (more complex)
cp -r content/experiments/default content/experiments/my-study

# Option C: Start from scratch
mkdir -p content/experiments/my-study/{instructions,sequences}
```

### Step 2: Configure Your Experiment (config.yaml)

This file controls all the experiment parameters:

```yaml
# Basic information
experiment:
  name: "My Awesome Study"
  description: "Testing cooperative decision making"
  author: "Your Name"

# Game mechanics
game:
  horizon: 20                    # Number of trials per round
  total_game_rounds: 2           # How many game rounds
  k_armed_bandit: 3             # Number of options (2-4)
  max_choice_time: 10000        # Time limit per choice (ms)
  max_waiting_time: 120000      # Max time to wait for group (ms)

# Group settings
groups:
  max_group_size: 5             # Maximum people per group
  min_group_size: 2             # Minimum to start a group

# Experimental conditions
conditions:
  indivOrGroup: group           # "group" or "individual"
  taskType: static              # "static" or "dynamic"
  exp_condition: my_study_v1    # Unique identifier

# Reward probabilities for bandit arms
environments:
  static:
    prob_0: [0.8, 0.5, 0.2]    # 80%, 50%, 20% for 3 options
  # For dynamic environments:
  # dynamic:
  #   prob_1: [0.8, 0.3, 0.3]
  #   prob_2: [0.3, 0.8, 0.3]
  #   change_points: [10, 20]

# Payment information
payment:
  flat_fee: 2.0                 # Base payment in GBP
  completion_fee: 1.0           # Extra for completing

# Debug settings
debug:
  subject_exceptions: ["test1", "debug", "pilot"]  # IDs that can replay
```

### Step 3: Write Participant Instructions

#### 3.1 Welcome/Consent Page (`instructions/welcome.md`)

```markdown
# Welcome to My Study!

Thank you for participating in our research on group decision-making.

## What You'll Do

You will work with {min_group_size}-{max_group_size} other participants to make decisions about which options to choose. Each option has different chances of giving you points.

## Payment

- **Base payment**: £{flat_fee}
- **Performance bonus**: Up to £{max_bonus}
- **Duration**: About {estimated_duration} minutes

## Important Notes

{note}
- Keep your internet connection stable
- Don't refresh your browser once started
- You may wait up to {max_wait_seconds} seconds to form a group
{/note}

---

## Consent Information

This study is conducted by [Your Institution]. Your participation is voluntary...

## Contact Information

Questions? Contact: your.email@university.edu
```

#### 3.2 Questionnaire (`instructions/questionnaire.md`)

```markdown
# Post-Experiment Survey

Thank you for completing the task! Please answer these questions.

## Demographics

{input: age, number, "What is your age?", required}

{select: gender, "What is your gender?", required}
- Male
- Female
- Other
- Prefer not to say
{/select}

{select: education, "Highest education level?"}
- High school
- Bachelor's degree
- Master's degree
- PhD or equivalent
- Other
{/select}

## Your Strategy

{textarea: strategy, "Describe your decision-making strategy:", rows=4}

{radio: strategy_change, "Did you change your strategy during the experiment?", required}
- Yes, changed significantly
- Made small adjustments
- Kept the same strategy
- Had no specific strategy
{/radio}

## Task Experience

Rate your agreement (1=Strongly Disagree, 5=Strongly Agree):

{likert: enjoyed, "I enjoyed this task", 1-5}
{likert: clear, "The instructions were clear", 1-5}
{likert: fair, "The payment was fair", 1-5}

## Group Experience
<!-- Only show for group experiments -->
{if condition="group"}
{likert: cooperation, "I felt my teammates were cooperative", 1-5}
{likert: communication, "I wish I could communicate with teammates", 1-5}
{/if}

## Final Comments

{textarea: comments, "Any other thoughts? (optional)", rows=3, optional}
```

### Step 4: Define Experiment Flow (`sequences/main.yaml`)

```yaml
sequences:
  main:
    # Welcome and consent
    - scene_type: "instruction"
      content_key: "welcome"
      duration: null              # Wait for user interaction

    # Optional tutorial
    - scene_type: "instruction"
      content_key: "tutorial"
      duration: null

    # Main experiment
    - scene_type: "game"
      content_key: "main_task"
      duration: null              # Controlled by game logic

    # Post-experiment survey
    - scene_type: "instruction"
      content_key: "questionnaire"
      duration: null
```

### Step 5: Generate and Test

```bash
# Generate your experiment templates
npm run generate my-study

# Run your experiment
npm run experiment

# Test with participants
# Individual: http://localhost:8000/?subjectID=test1
# Group: Open multiple tabs with test1, test2, test3...
```

## 🎨 Advanced Features

### Conditional Content

Show different text based on experimental conditions:

```markdown
{if condition="group"}
You are working with other participants.
{/if}

{if condition="individual"}
You are working alone.
{/if}

{if condition="static"}
The reward probabilities stay the same throughout.
{/if}

{if condition="dynamic"}
The reward probabilities may change during the task.
{/if}
```

### Form Elements

#### Text Input
```markdown
{input: field_name, text, "Question text", required}
{input: age, number, "Your age:", required}
{input: feedback, textarea, "Comments:", optional, rows=3}
```

#### Multiple Choice
```markdown
{select: field_name, "Question text", required}
- Option 1
- Option 2
- Option 3
{/select}
```

#### Radio Buttons
```markdown
{radio: field_name, "Question text", required}
- Choice A
- Choice B
- Choice C
{/radio}
```

#### Likert Scales
```markdown
{likert: satisfaction, "I enjoyed the task", 1-5}
{likert: difficulty, "The task was difficult", 1-7}
```

#### Text Areas
```markdown
{textarea: strategy, "Describe your approach:", rows=4}
{textarea: comments, "Optional feedback:", rows=2, optional}
```

### Variables and Placeholders

Use variables from your config.yaml:

```markdown
This study takes about {estimated_duration} minutes.
You'll work in groups of {min_group_size} to {max_group_size} people.
Your base payment is £{flat_fee}.
```

Available variables:
- From `config.yaml`: Any value you define
- Automatic: `max_wait_seconds`, `estimated_duration`, etc.
- Runtime: `subjectID`, `totalEarning`, `completionCode`

## 🔧 Testing Your Experiment

### Individual Experiments
```bash
# Single participant
http://localhost:8000/?subjectID=test1
```

### Group Experiments
```bash
# Open multiple browser tabs/windows:
http://localhost:8000/?subjectID=alice
http://localhost:8000/?subjectID=bob
http://localhost:8000/?subjectID=carol
```

### Debug Mode

Use debug subject IDs (defined in config.yaml) to:
- Skip waiting periods
- Replay the experiment multiple times
- Test different scenarios

## 📊 Data Collection

Your experiment automatically collects:
- **Behavioral data**: Choices, reaction times, outcomes
- **Survey responses**: All questionnaire answers
- **Session data**: Group formation, disconnections, completion status

Data is stored in MongoDB and can be exported as CSV:

```bash
# Access database
npm run docker:shell

# In MongoDB shell:
use collective_bandit_dev
db.behaviouraldatas.find().pretty()

# Export to CSV (see main README for full command)
```

## 🚨 Common Mistakes to Avoid

### 1. YAML Syntax Errors
- Use spaces, not tabs for indentation
- Be consistent with spacing
- Quote strings with special characters

### 2. Missing Required Fields
- Every experiment needs `config.yaml` and `sequences/main.yaml`
- Survey forms need at least one question
- Group experiments need `min_group_size >= 2`

### 3. Form Validation Issues
- Use `required` for mandatory fields
- Don't forget closing `{/select}` tags
- Match field names in forms (no spaces, use underscores)

### 4. Testing Problems
- Test with debug subject IDs first
- For groups, open all participant tabs quickly
- Check browser console for JavaScript errors

## 🎯 Tips for Success

### 1. Start Simple
- Begin with an existing example
- Make small changes and test frequently
- Add complexity gradually

### 2. Test Early and Often
- Test after every major change
- Try both individual and group scenarios
- Use different browsers and devices

### 3. Write Clear Instructions
- Participants often don't read carefully
- Use bold text for important points
- Include examples when explaining complex concepts

### 4. Plan Your Data Analysis
- Think about what data you need before creating the experiment
- Design questionnaires with analysis in mind
- Consider how you'll identify different experimental conditions

## 📚 Next Steps

Once you've created a basic experiment:

1. **Read the deployment guide** - Learn how to run experiments with real participants
2. **Study the default experiment** - See advanced features in action
3. **Check the API reference** - Understand the data structure
4. **Join the lab community** - Share your experiments and get feedback

Happy experimenting! 🎉