/*
  Calculation checks (anti-bot)
  -----------------------------
  These are NOT part of the published questionnaires.

  The app generates concrete arithmetic expressions deterministically
  from sessionId so they remain stable if the participant resumes later.

  kinds supported:
    - add_sub
    - mul
    - div
    - mul_add
    - div_sub
*/

window.RIKEN_SURVEY_DATA = window.RIKEN_SURVEY_DATA || {};

window.RIKEN_SURVEY_DATA["math_checks"] = {
  id: "math_checks",
  title: "Calculation Check",
  maxAttempts: 3,
  checks: [
    {
      id: "math_check_1",
      title: "Calculation Check",
      between: "Demographics → HEXACO",
      kind: "add_sub",
      prompt: "Please solve the following arithmetic problem. Click the answer field to start the timer, then type the answer and press Enter."
    },
    {
      id: "math_check_2",
      title: "Calculation Check",
      between: "HEXACO → IPIP-NEO",
      kind: "mul",
      prompt: "Please solve the following arithmetic problem. Click the answer field to start the timer, then type the answer and press Enter."
    },
    {
      id: "math_check_3",
      title: "Calculation Check",
      between: "IPIP-NEO → MFQ",
      kind: "div",
      prompt: "Please solve the following arithmetic problem. Click the answer field to start the timer, then type the answer and press Enter."
    },
    {
      id: "math_check_4",
      title: "Calculation Check",
      between: "MFQ → D70",
      kind: "mul_add",
      prompt: "Please solve the following arithmetic problem. Click the answer field to start the timer, then type the answer and press Enter."
    },
    {
      id: "math_check_5",
      title: "Calculation Check",
      between: "D70 → SVO",
      kind: "div_sub",
      prompt: "Please solve the following arithmetic problem. Click the answer field to start the timer, then type the answer and press Enter."
    }
  ]
};
