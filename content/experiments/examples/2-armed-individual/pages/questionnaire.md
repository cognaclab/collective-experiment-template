---
title: "Post-Task Survey"
type: "questionnaire"
form_action: "/questionnaire"
submit_button: "Submit Survey"
---

# Post-Task Survey

Thank you for completing the 2-armed bandit task! Please answer a few questions about your experience.

## Task Experience

{likert: difficulty, "How difficult was the task?", 1-7}
*1 = Very Easy, 7 = Very Difficult*

{likert: confidence, "How confident are you that you found the better option?", 1-7}
*1 = Not Confident At All, 7 = Very Confident*

{radio: strategy, "Which strategy did you primarily use?"}
- Mostly chose the left option
- Mostly chose the right option  
- Switched back and forth equally
- Started by exploring, then focused on the better option
- No particular strategy
{/radio}

{radio: better_option, "Which option do you think was better?"}
- Left option was clearly better
- Right option was clearly better
- They seemed about the same
- I'm not sure
{/radio}

## General Questions

{input: age, number, "What is your age?", required}

{select: gender, "What is your gender?", required}
- Male
- Female
- Non-binary
- Prefer not to say
{/select}

{radio: previous_experience, "Have you done similar decision-making tasks before?"}
- Never
- Once or twice
- Several times  
- Many times
{/radio}

{textarea: comments, "Any additional comments about the task?", rows=3, optional}

---

**Thank you for your participation!**