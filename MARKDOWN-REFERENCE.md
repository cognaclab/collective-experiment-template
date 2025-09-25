# Extended Markdown Syntax Reference

The template system extends standard Markdown with custom syntax for experimental content, forms, and conditional logic.

## Table of Contents
- [Basic Markdown](#basic-markdown)
- [Conditional Content](#conditional-content)  
- [Form Elements](#form-elements)
- [Variables](#variables)
- [YAML Front Matter](#yaml-front-matter)
- [Page Types](#page-types)

## Basic Markdown

All standard Markdown syntax is supported:

```markdown
# Heading 1
## Heading 2  
### Heading 3

**Bold text** and *italic text*

- Bullet point
- Another point

1. Numbered list
2. Second item

[Link text](http://example.com)

> Blockquote text

`inline code` 

```javascript
// Code block
console.log("Hello world");
```
```

## Conditional Content

Show different content based on experiment conditions.

### Basic If/Else
```markdown
{if condition="group"}
You are in a **group condition** with other participants.
{else}
You are in an **individual condition**.
{/if}
```

### Task Type Conditions  
```markdown
{if taskType="static"}
The reward probabilities will remain **constant** throughout.
{else}
The reward probabilities will **change** during the experiment.
{/if}
```

### Experiment Condition
```markdown
{if exp_condition="treatment"}
Special treatment instructions here.
{else}
Control condition instructions here.
{/if}
```

### Available Conditions
- `condition`: "group" or "individual" 
- `taskType`: "static" or "dynamic"
- `exp_condition`: Any string from config.yaml

## Form Elements

Create interactive forms using extended syntax.

### Text Input
```markdown
{input: fieldName, inputType, "Label text", required}
{input: fieldName, inputType, "Label text", optional}
```

**Examples:**
```markdown
{input: age, number, "What is your age?", required}
{input: name, text, "Your name", optional}  
{input: email, email, "Email address", required}
```

**Input types:** text, number, email, password, url, tel

### Textarea
```markdown
{textarea: fieldName, "Label text", rows=number, required/optional}
```

**Example:**
```markdown
{textarea: comments, "Additional comments", rows=4, optional}
```

### Select Dropdown
```markdown
{select: fieldName, "Label text", required/optional}
- Option 1
- Option 2  
- Option 3
{/select}
```

**Example:**
```markdown
{select: education, "Highest education level", required}
- High school
- Bachelor's degree
- Master's degree
- PhD
{/select}
```

### Radio Buttons
```markdown
{radio: fieldName, "Label text", required/optional}
- Option 1
- Option 2
- Option 3
{/radio}
```

**Example:**
```markdown
{radio: experience, "Previous experience with this task?"}
- None
- Some
- Extensive  
{/radio}
```

### Likert Scale
```markdown
{likert: fieldName, "Question text", min-max}
```

**Examples:**
```markdown
{likert: satisfaction, "How satisfied are you?", 1-7}
{likert: difficulty, "How difficult was the task?", 1-5}
```

## Variables

Insert dynamic values from the experiment system.

### Available Variables
```markdown
{{subjectID}}        # Participant's ID
{{currentTrial}}     # Current trial number  
{{gameRound}}        # Current game round
{{totalEarning}}     # Total earnings
{{confirmationID}}   # Unique confirmation code
{{maxGroupSize}}     # Maximum group size
{{horizon}}          # Total number of trials
{{exp_condition}}    # Experiment condition
{{indivOrGroup}}     # 1 for group, 0 for individual
```

**Example usage:**
```markdown
## Trial {{currentTrial}} of {{horizon}}

Welcome, participant {{subjectID}}! 

{if condition="group"}
Your group can have up to {{maxGroupSize}} members.
{/if}

Your confirmation code is: **{{confirmationID}}**
```

## YAML Front Matter

Configure page behavior with YAML metadata at the top of files.

### Basic Structure
```markdown
---
title: "Page Title"
type: "page"
navigation: "button" 
---

# Markdown content starts here
```

### Available Options

#### For Instruction Scenes
```yaml
---
title: string           # Page title (appears in browser)
navigation: string      # "button", "auto", or "none"
delay: number          # Auto-advance delay in milliseconds
next: string           # Override next scene
---
```

#### For Pages (questionnaire, etc.)
```yaml
---
title: string           # Page title  
type: string           # "questionnaire", "consent", "completion"
form_action: string    # Where form submits ("/questionnaire")
submit_button: string  # Button text ("Submit Survey")
---
```

### Navigation Types
- `button`: Show "Continue" button (default)
- `auto`: Auto-advance after delay
- `none`: No navigation (for custom logic)

**Example:**
```markdown
---
title: "Brief Instructions"
navigation: auto
delay: 5000
---

# Quick Instructions

These instructions will advance automatically in 5 seconds.
```

## Page Types

Different page types enable different functionality.

### Instruction Pages
Located in `content/experiments/default/instructions/`

```markdown
---
title: "Task Instructions"
navigation: button
---

# Instructions content here
```

**Features:**
- Conditional content blocks
- Variable substitution
- Navigation controls
- Generates Phaser.js scenes

### Web Pages  
Located in `content/experiments/default/pages/`

```markdown
---
title: "Survey"  
type: "questionnaire"
form_action: "/questionnaire"
submit_button: "Submit Responses"
---

# Survey content with form elements
```

**Features:**
- Extended form syntax
- HTML generation
- Server-side form handling  
- Generates EJS templates

## Advanced Examples

### Multi-Page Survey
```markdown
---
title: "Demographics Survey"
type: "questionnaire"
form_action: "/questionnaire"
---

# About You

{input: age, number, "Age", required}

{select: gender, "Gender", required}
- Male
- Female
- Non-binary
- Prefer not to say
{/select}

# Experience

{likert: computer_comfort, "How comfortable are you with computers?", 1-5}

{radio: previous_studies, "Have you participated in similar studies?"}
- Never
- Once or twice  
- Several times
- Many times
{/radio}

# Optional Feedback

{textarea: additional_comments, "Any other comments?", rows=3, optional}
```

### Conditional Instructions with Variables
```markdown
---
title: "Task Rules"
navigation: button  
---

# Task Rules for {{subjectID}}

{if condition="group"}
## Group Task ({{maxGroupSize}} players)

You are **Player {{subjectNumber}}** in a group of up to {{maxGroupSize}} participants.

{if taskType="static"}
The reward probabilities will **remain constant** for all {{horizon}} trials.
{else}
The reward probabilities will **change** during the {{horizon}} trials.
{/if}

{else}
## Individual Task

You will complete {{horizon}} trials working alone.
{/if}

Your goal is to maximize earnings over {{horizon}} trials.
```

### Complex Form with Validation
```markdown
---
title: "Registration Form"
type: "consent"
form_action: "/register"
submit_button: "I Agree and Continue"
---

# Consent and Registration

## Required Information

{input: participant_id, text, "Participant ID (from recruitment)", required}
{input: age, number, "Age (must be 18+)", required}

{select: country, "Country of residence", required}
- United States
- United Kingdom  
- Canada
- Australia
- Germany
- Other
{/select}

## Consent Items

{radio: consent_participate, "I agree to participate in this study", required}
- Yes, I agree
- No, I do not agree
{/radio}

{radio: consent_data, "I agree to have my data stored for research", required}
- Yes, I agree  
- No, I do not agree
{/radio}

{textarea: special_needs, "Any accommodations needed?", rows=2, optional}
```

## Error Handling

### Common Syntax Errors

**Missing closing tags:**
```markdown
{if condition="group"}
Content here
// ERROR: Missing {/if}
```

**Invalid field names:**
```markdown
{input: invalid-name, text, "Label"}  // ERROR: Use underscores
{input: valid_name, text, "Label"}    // CORRECT
```

**Malformed YAML:**
```markdown
---
title: Missing quotes for "Special: Characters"  // ERROR  
title: "Proper quotes for special chars"         // CORRECT
---
```

### Validation

The system validates:
- YAML front matter syntax
- Extended Markdown syntax
- Form element completeness  
- Variable availability
- Conditional block nesting

Errors appear in the generation console output.

## Best Practices

### Content Organization
- Keep instruction files focused on single topics
- Use descriptive filenames: `welcome.md`, `task_rules.md`
- Group related content with conditionals rather than separate files

### Form Design  
- Always include labels for accessibility
- Mark required fields clearly
- Provide reasonable defaults where appropriate
- Group related questions together

### Conditional Logic
- Keep conditions simple and readable
- Document complex conditional logic in comments
- Test all condition branches
- Use meaningful condition names

### Variable Usage
- Verify variables are available in the current context
- Provide fallbacks for optional variables
- Use variables to reduce content duplication

This reference covers all extended syntax supported by the template system. For examples of complete experiments, see the tutorial and example configurations.