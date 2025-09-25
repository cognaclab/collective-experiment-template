---
type: completion
title: "Study Complete!"
show_completion_code: true
show_earnings: true
redirect_delay: 10
redirect_url: "https://app.prolific.co/submissions/complete"
---

# Study Complete!

Thank you very much for participating in our research study.

{success_message}
Your responses have been successfully recorded and your participation is complete.
{/success_message}

## Your Earnings

{earnings_summary}
- **Base payment**: £{base_payment}
- **Task bonus**: £{task_bonus}
- **Waiting bonus**: £{waiting_bonus}
- **Total earnings**: £{total_earnings}
{/earnings_summary}

## Completion Code

{completion_code_section}
Please copy the completion code below and return to Prolific to confirm your participation:

**Completion Code**: {completion_code}

This code confirms you have successfully completed all parts of the study.
{/completion_code_section}

## Next Steps

- Your payment will be processed within **24 hours**
- All data will be anonymized immediately after payment processing
- Results from this study will contribute to academic research on collective decision-making
- Published results will not contain any identifying information

## Research Impact

Your participation helps us understand how people make decisions in groups and how collective intelligence emerges. This research contributes to fields including:

- Behavioral economics
- Social psychology  
- Collective intelligence
- Human-AI interaction

## Optional Feedback

{textarea: final_feedback, "Any final thoughts about your experience? (optional)", rows=3, optional}

---

## Thank You!

We sincerely appreciate your time and contribution to our research.

{if redirect_url}
You will be automatically redirected to Prolific in {redirect_delay} seconds.

[Return to Prolific Now]({redirect_url})
{/if}

---

*This study was conducted by the Social Psychology and Decision Sciences Department, University of Konstanz, Germany.*