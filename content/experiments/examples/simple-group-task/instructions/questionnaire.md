# Thank You!

Great job completing the group task! Please answer these quick questions.

## Demographics

{input: age, number, "What is your age?", required}

{select: gender, "What is your gender?", required}
- Male
- Female
- Other
- Prefer not to say
{/select}

## Your Experience

{textarea: strategy, "What strategy did you use to make decisions?", rows=3}

{radio: cooperation, "How much did you feel like you were cooperating with your teammates?", required}
- A lot - we worked well together
- Somewhat - some cooperation
- A little - mostly individual decisions
- Not at all - no cooperation
{/radio}

{radio: difficulty, "How difficult was the task?", required}
- Very easy
- Easy
- Just right
- Difficult
- Very difficult
{/radio}

{likert: enjoyed, "I enjoyed this task", 1-5}
{likert: clear_instructions, "The instructions were clear", 1-5}

## Final Comments

{textarea: feedback, "Any other thoughts about this experiment? (optional)", rows=2, optional}