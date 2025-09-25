---
scene_type: instruction
navigation: linear
buttons:
  next: "Next"
  back: "Back"
images:
  - name: "instructionPictures_individual"
    condition: "individual"
    count: 11
  - name: "instructionPictures_collective"
    condition: "group"
    count: 16
styles:
  backgroundColor: "rgba(51,51,51,0.1)"
  width: "700px"
  height: "400px"
  fontSize: "25px"
---

# Welcome!!

Please read these instructions carefully. Afterward, you will answer a few questions to check your understanding. You may then wait until enough participants join.

You will earn **10 pence per minute** (£6 per hour) for any time spent in the waiting room.

---

You will play a slot machine game and your goal is to earn as many points as possible.

---

Each time you play, a slot machine gives out either 0 or 100 points.

---

There are 3 slot machines that differ in quality: some give rewards more often than others. You can learn which machine is best from by playing.

---

{if taskType="static"}
There will be **76 trials in total**, divided into **4 rounds**. Each round consists of 19 trials, and there will be a short break between rounds.
{else}
There will be **76 trials in total**. In each trial, you will choose one of the three machines and then receive a reward.
{/if}

---

{if taskType="static"}
The quality of the machines stays the same within each round, but may change between rounds.
{else}
The 76 trials are divided into **four rounds**. The quality (average payoff) of the machines may change between rounds, meaning the best machine in one round may not be the best in another. Within each round, machine quality stays the same. You will **NOT** be told when a new round begins.
{/if}

---

{if condition="group"}
You will play together with **1-9 other participants**. In each trial, you choose one of the 3 machines. Everyone chooses at the same time but you cannot communicate directly. Multiple people can choose the same machine, there are no constraints.
{else}
You will play individually. In each trial, you choose one of the 3 machines.
{/if}

---

{if condition="group"}
After everyone made their choice, you will see:
1. **Team reward**: the sum of everyone's points.
2. **Team choices**: how many people picked each machine.
{else}
After you make your choice, you will see:
1. **Your reward**: the points you earned.
2. **Your choice**: which machine you selected.
{/if}

---

{if condition="group"}
**This is important:** In each trial, you will not see how many points each machine produced, only the total team reward! This team reward depends on everyone's choices, not just yours.
{else}
You will see exactly how many points you earned from your chosen machine.
{/if}

---

In each trial, you have **10 seconds** to make a choice. If you do not choose in time, you miss the trial.

{if condition="group"}
At least two people in the team must make a choice. Otherwise, the team earns nothing in that trial.
{/if}

---

If you miss a trial, you must confirm you are still in the game by clicking the "Yes, I am!" button. If you do not confirm within 10 seconds, we will assume you have ended the study and you will not get your participation fee.

---

{if condition="group"}
Your total payout will be based on **the sum of all points** your team earns over the whole experiment.
{else}
Your total payout will be based on **the sum of all points** you earn over the whole experiment.
{/if}

---

{if condition="group"}
The payout for each person is the total accumulated reward divided by the number of people in the team and is the same for everyone.
{/if}

---

The total accumulated reward will be {if condition="group"}divided equally among all team members{/if}. The conversion rate from points to real money is **100 points = 4 pence (£0.04)**.

---

{if condition="group"}
After all experimental sessions end, participants in the top-performing team will receive an additional bonus (paid out at a later date).
{/if}

---

On the next page, you will play a tutorial to get familiar with the task!