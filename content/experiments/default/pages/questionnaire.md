---
type: questionnaire
title: "Post-Experiment Survey"
sections:
  - demographics
  - strategy
  - experience
submit_button: "Submit Survey"
redirect_url: "/endPage"
---

# Post-Experiment Survey

Thank you for completing the task! Please answer these final questions.

## Demographics

{input: age, number, "What is your age?", required}

{select: gender, "What is your gender?", required}
- Male
- Female
- Other
- Prefer not to say
{/select}

{select: education, "What is your highest level of education?"}
- High school
- Bachelor's degree
- Master's degree
- PhD
- Other
{/select}

## Your Strategy

{textarea: strategy, "Please describe the strategy you used to make decisions during the task:", rows=5}

{radio: strategy_change, "Did you change your strategy during the experiment?", required}
- Yes, I changed my strategy significantly
- Yes, I made minor adjustments
- No, I kept the same strategy throughout
- I didn't have a specific strategy
{/radio}

{radio: noticed_patterns, "Did you notice any patterns in the rewards?", required}
- Yes, clear patterns
- Some patterns emerged
- No clear patterns
- Not sure
{/radio}

## Task Experience

Please rate your agreement with these statements (1 = Strongly Disagree, 5 = Strongly Agree):

{likert: enjoyed, "I enjoyed participating in this task", 1-5}
{likert: understood, "The instructions were clear and easy to understand", 1-5}
{likert: fair, "The payment structure was fair", 1-5}
{likert: challenging, "The task was appropriately challenging", 1-5}
{likert: realistic, "The task felt realistic and engaging", 1-5}

## Group Experience

{if condition="group"}
{likert: teamwork, "I felt like I was part of a team", 1-5}
{likert: cooperation, "Other participants seemed to cooperate", 1-5}
{likert: social_pressure, "I felt pressure from other team members", 1-5}
{/if}

## Additional Comments

{textarea: feedback, "Any other feedback about the experiment? (optional)", rows=3, optional}

{textarea: technical_issues, "Did you experience any technical issues? (optional)", rows=2, optional}