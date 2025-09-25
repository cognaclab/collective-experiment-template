---
scene_type: quiz
pass_threshold: 4
retry_allowed: true
correct_answers:
  group_static: [3, 0, 0, 0, 1]
  group_dynamic: [3, 1, 1, 0, 1]
  individual_static: [3, 0, 0, -1, -1]
  individual_dynamic: [3, 1, 1, -1, -1]
styles:
  backgroundColor: "rgba(51,51,51,0.1)"
  width: "700px"
  height: "400px"
  fontSize: "25px"
---

# Understanding Test

Please answer the following questions to check your understanding of the task.

## Question 1
How many slot machines are there?

- [ ] 2 machines
- [ ] 3 machines  
- [ ] 4 machines
- [x] 3 machines

## Question 2
{if condition="group"}
Will you see individual rewards?
- [x] No, only team total
- [ ] Yes, individual rewards
{else}
Will you see your reward?
- [ ] No
- [x] Yes, your points
{/if}

## Question 3
{if taskType="dynamic"}
Can machine quality change during the experiment?
- [x] Yes, between rounds
- [ ] No, stays the same
{else}
Can machine quality change during the experiment?
- [ ] Yes, any time
- [x] Only between rounds
{/if}

## Question 4
{if condition="group"}
What happens if only one person chooses in a trial?
- [x] Team gets no reward
- [ ] Team gets partial reward
- [ ] Normal reward distribution
{else}
This question is not applicable for individual condition.
{/if}

## Question 5
{if condition="group"}
How long do you have to make a choice?
- [ ] 5 seconds
- [x] 10 seconds  
- [ ] 15 seconds
- [ ] No time limit
{else}
This question is not applicable for individual condition.
{/if}