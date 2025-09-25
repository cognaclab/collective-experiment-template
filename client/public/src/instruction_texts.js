'use strict';

const waitingRoomText0 =
	[ 'Welcome!'
	, 'The task will start shortly.'
	, 'Make sure you have a stable internet connection.'
	, ''
	];
const waitingRoomText =
	[ 'Waiting Room'
	, 'Please do not reload this page or open a new browser window.'
	, 'Also please do not hide this browser window by other tab or apps.'
	, 'If you do so, the task will be terminated automatically.'
	, ''
	];
const waitingForOthers =
	[ 'Wait for others'
	, 'Please do not reload this page or open a new browser window.'
	, 'Also please do not hide this browser window by other tab or apps.'
	, 'If you do so, the task will be terminated automatically.'
	, 'Your waiting bonus is ' + '???' + ' cents.'
	];

const instructionText_group_static =
	[ 'Welcome!! <br><br>Please read these instructions carefully. Afterward, you will answer a few questions to check your understanding. You may then wait until enough participants join. <br><br>You will earn <span class="note">10&nbsp;pence per minute</span> (£6 per hour) for any time spent in the waiting room.'

	, '<br>You will play a slot machine game and your goal is to earn as many points as possible.'

	, 'Each time you play, a slot machine gives out either 0 or 100 points.'

	, 'There are 3 slot machines that differ in quality: some give rewards more often than others. You can learn which machine is best from by playing.'
	
	, '<br>There will be <span class="note">76 trials in total</span>, divided into <span class="note">4 rounds</span>. Each round consists of 19 trials, and there will be a short break between rounds. <br>'

	, '<br>The quality of the machines stays the same within each round, but may change between rounds.'

	, 'You will play together with <span class="note">1-9 other participants</span>. In each trial, you choose one of the 3 machines. Everyone chooses at the same time but you cannot communicate directly. Multiple people can choose the same machine, there are no constraints.'

	, 'After everyone made their choice, you will see: <br>(1) Team reward: the sum of everyone\'s points. <br>(2) Team choices: how many people picked each machine.'

	, '<span class="note">This is important:</span> In each trial, you will not see how many points each machine produced, only the total team reward! This team reward depends on everyone\'s choices, not just yours.'

	, 'In each trial, you have <span class="note">10 seconds</span> to make a choice. If you do not choose in time, you miss the trial. <br> At least two people in the team must make a choice. Otherwise, the team earns nothing in that trial.' 

	, 'If you miss a trial, you must confirm you are still in the game by clicking the "Yes, I am!" button. If you do not confirm within 10 seconds, we will assume you have ended the study and you will not get your participation fee.'

	, '<br>Your total payout will be based on <span class="note">the sum of all points</span> your team earns over the whole experiment.'

	, '<br>The payout for each person is the total accumulated reward divided by the number of people in the team and is the same for everyone.'

	, '<br>The total accumulated reward will be divided equally among all team members. The conversion rate from points to real money is <span class="note">100&nbsp;points = 4&nbsp; pence (£0.04)</span>.'

	, 'After all experimental sessions end, participants in the top-performing team will receive an additional bonus (paid out at a later date).'

	, '<br><br><br>On the next page, you will play a tutorial to get familiar with the task!'
	];

const instructionText_group_dynamic =
	[ 'Welcome!! <br><br>Please read the following instructions carefully. After reading the instructions, we will ask a few questions to verify your understanding of the experimental task. <br><br>After answering these questions, you may spend some more time in a waiting room until sufficient number of participants have arrived to start the task. <br><br>You will be paid <span class="note">10&nbsp;pence per minute</span> (that is, £6 per hour) for any time spent in the waiting room. When your group is ready, the main task will start.'

	, '<br>In this task, you will play a game of getting rewards from a slot machine and your goal is to earn as many points as possible. '

	, 'As in the real world, rewards are not guaranteed—they are given according to certain probabilities. Compared to a real slot machine, there are three important differences: <br><br>First, the reward on any play is either 0 or 100 points.'

	, 'Second, instead of a single slot machine, there are three. These machines differ in quality: some are more likely to give a reward (on average) than others. At the start, you will not know which machine is best, but you can make an informed guess based on your experience over the trials.'
	
	, '<br>There will be <span class="note">76 trials in total</span>. In each trial, you will choose one of the three machines and then receive a reward.'

	, 'The 76 trials are divided into <span class="note">four rounds</span>. The quality (average payoff) of the machines may change between rounds, meaning the best machine in one round may not be the best in another. Within each round, machine quality stays the same. You will <span class="note">NOT</span> be told when a new round begins.'

	, 'Third, you will be playing together with <span class="note">1-9 other participants</span>. Everyone in the group is choosing at the same time but you cannot communicate directly with others. Multiple people can choose the same machine, there are no constraints.'

	, 'After everyone made their choice, you will see two things: <br>(1) Team reward: the sum of everyone\'s individual rewards. <br>(2) Team choices: the number of people (including yourself) choosing each slot.'

	, 'In sum, there will be <span class="note">76 trials in total</span>. In each trial, you will choose one of the three machines and then receive a reward.'

	, '<span class="note">This is important:</span> You will not see the individual reward your or anyone else\'s machine generated. <span class="note">You will only see the total team reward in a given trial</span>. This team reward depends on everyone\'s choices, not just yours.'

	, 'Note that in every trial, you have up to <span class="note">10 seconds</span> to make a choice. If you do not select an option in time, you will miss that trial. <br> -- If at least two team members make a choice, their contributions count toward the common reward pool. <br> <span class="note">If fewer than two respond, no reward is gained.</span>' 

	, 'If you miss a trial, you will be asked to confirm that you are still participating in the experiment. Please click the "Yes, I am!" button. If you do not confirm within 10 seconds, we will assume you have ended the study, and it will be terminated without compensation.'

	, '<br>Your total payout will be based on <span class="note">the sum of all points</span> your team earns over the whole experiment.'

	, '<br>The payout for each person is the total accumulated reward divided by the number of people in the team and is the same for everyone.'

	, 'The total reward you get will be converted into real money. The exchange rate is <span class="note">100&nbsp;points = 4&nbsp; pence (£0.04)</span>.'

	, 'After all experimental sessions are complete, participants in the top-performing team will receive an additional bonus. This bonus will be calculated based on overall team performance and paid out at a later date.'

	, '<br><br><br>On the next page, you will play a tutorial to get familiar with the task!'
	];

const tutorialText_group =
	[ '<br>This is the tutorial task. <br><br>Start by choosing whichever slot machine you like!'

	, '<br>Your team got 200 points! Well done. You can see how many people chose each machine. Click "Next" to proceed.'

	, 'This is trial 2. The <span class="note">same slot machines</span> will appear again. Again choose one of the slots you like!'

	, 'Hooray! Your team got 300 points this time! Some machines may generate more reward on average, while other machines may generate less reward. Guess that based on the team reward!'

	, '<br>This is trial 3. Again choose one of the slots you like!'

	, '<br>Your team got 100 points! Note that <span class="note">two people missed</span> the trial, hence no reward contribution from those members, resulting in less total team reward.'

	, 'You have <span class="note">up to 10 seconds</span> to make a choice. <br><br>Note: You cannot click any options here in the tutorial for illustrative purposes. Let\'s see what happens if time is up.'

	, 'Time\'s up — <span class="note">you missed the trial</span> (your contribution to the team reward is 0). To continue, please confirm you\'re still participating. If you don\'t click "Yes, I am!" <span class="note">within 10 seconds</span>, we\'ll assume you\'ve left the study, and it will end without compensation.'

	, 'Oh no, your team got 0 points because there was just one person making a choice for this trial. As a team, <span class="note">at least two people must make a choice</span> to obtain the team reward. Try not to miss any trial!'

	, '<br>The tutorial is done. <br><br>Next, you will proceed to a short comprehension quiz!'
	];

const understandingCheckText_dynamic =
	[ '<h3>Please answer the following questions.</h3>'

	, 'How many trials will you play in total?' // 76

	, 'Does the quality of the machines stay the same across trials?' // no

	, 'Can you directly see whether the machine you chose has generated points?' //no

    , 'Does your personal monetary reward increase if you contribute more points to your group?' // yes

    , 'If only one person in your team responds in a trial, does the team earn any points?' // no
	];

const understandingCheckText_static = [
  '<h3>Please answer the following questions.</h3>',

  'How many trials will you play in total?', // 76

  'Does the quality of the machines stay the same within a single round?', // yes

  'Can you directly see whether the machine you chose has generated points?', //no

  'Does your personal monetary reward increase if you contribute more points to your group?', // yes

  'If only one person in your team responds in a trial, does the team earn any points?' // no
];




const transitionText_staticToDynamic = 
	[ '<br><br>Well done! You are now moving on to the next round.'

	, '<br><br>The next part of the game is the same as before with one difference:'

	, '<br>So far the average payoff of each machine has been the same from trial to trial. In this next part <span class="note">the quality (average payoff) of different machines will change 3 times during the course of the game</span>. That is, the best machine at a certain time might not be the best during another round. You will not be explicitly notified of the change if it occurs. <br><br>Also, <span class="note">there will be 60 trials</span>.'

	];

const transitionText_dynamicToStatic = 
[ '<br><br>Well done! You are now moving on to the next round.'

	, '<br><br>The next part of the game is the same as before with one difference:'

	, '<br>So far the quality (average payoff) of different machines has not been the same throughout the game. <span class="note">Now it will remain the same</span>, although it might be different from which machine was the best in the previous round. <br><br><span class="note">There will be 30 trials this time</span>.'

	];

const transitionText_static = [
	[ '<br><br>Well done! You are now moving on to the next game.'

	, '<br><br>The next game is the same as before with different machines.'

	, 'Please proceed to the next round when you are ready.'

	],

	[ '<br><br>Well done! You are now moving on to the next game.'

	, '<br><br>The next game is the same as before with different machines.'

	, 'Please proceed to the next round when you are ready.'

	],

	[ '<br><br>Well done! You are now moving on to the next game.'

	, '<br><br>The next game is the same as before with different machines.'
	
	, 'Please proceed to the next round when you are ready.'

	]

];




const instructionText_indiv_static =
	[ 'Welcome!! <br><br>Please read the following instructions carefully. After reading them, you will be asked a few questions to check your understanding of the task.'

	, '<br>You will play a slot machine game and your goal is to earn as many points as possible.'

	, 'Each time you play, a slot machine gives out either 0 or 100 points.'

	, 'There are 3 slot machines that differ in quality: some give rewards more often than others. You can learn which machine is best from by playing.'
	
	, '<br>There will be <span class="note">76 trials in total</span>, divided into <span class="note">4 rounds</span>. Each round consists of 19 trials, and there will be a short break between rounds. <br>'

	, '<br>The quality of the machines stays the same within each round, but may change between rounds.'

	, 'Note that in every trial, you have up to <span class="note">10 seconds</span> to make a choice. If you do not select an option in time, you will miss that trial.' 

	, 'If you miss a trial, you will be asked to confirm that you are still participating in the experiment. Please click the "Yes, I am!" button. If you do not confirm within 10 seconds, we will assume you have ended the study, and it will be terminated without compensation.'

	, '<br>Your total payout will be based on the <span class="note">sum of all points</span> you earn over the whole experiment.'

	, 'The total reward will be converted into real money at the rate of <span class="note">100&nbsp;points = 4&nbsp; pence (£0.04)</span>.'

	, 'After all experimental sessions are complete, top-performing participants will receive an additional bonus. This bonus will be calculated based on overall team performance and paid out at a later date.'

	, '<br><br><br>On the next page, you will play a tutorial to get familiar with the task!'
	];
		

const instructionText_indiv_dynamic =
	[ 'Welcome!! <br><br>Please read the following instructions carefully. After reading them, you will be asked a few questions to check your understanding of the task.'

	, '<br>In this task, you will play a game to earn as many points as possible by getting rewards from slot machines. '

	, 'As in the real world, rewards are not guaranteed—they are given according to certain probabilities. Compared to a real slot machine, there are two important differences: <br><br>First, The reward on any play is either 0 or 100 points.'

	, 'Second, instead of a single slot machine, there are three. These machines differ in quality: some are more likely to give a reward (on average) than others. At the start, you will not know which machine is best, but you can make an informed guess based on your experience over the trials.'

	, '<br>There will be <span class="note">76 trials in total</span>. In each trial, you will choose one of the three machines and then receive a reward.'

	, 'The 76 trials are divided into <span class="note">four rounds</span>. The quality (average payoff) of the machines may change between rounds, meaning the best machine in one round may not be the best in another. Within each round, machine quality stays the same. You will <span class="note">NOT</span> be told when a new round begins.'

	, 'Note that in every trial, you have up to <span class="note">10 seconds</span> to make a choice. If you do not select an option in time, you will miss that trial.' 

	, 'If you miss a trial, you will be asked to confirm that you are still participating in the experiment. Please click the "Yes, I am!" button. If you do not confirm within 10 seconds, we will assume you have ended the study, and it will be terminated without compensation.'

	, '<br>Your total payout will be based on the <span class="note">sum of all points</span> you earn over the whole experiment.'

	, 'The total reward will be converted into real money at the rate of <span class="note">100&nbsp;points = 4&nbsp; pence (£0.04)</span>.'

	, 'After all experimental sessions are complete, the top-performing participant will receive an additional bonus. This bonus will be calculated based on overall performance and paid out at a later date.'

	, '<br><br><br>On the next page, you will play a tutorial to get familiar with the task!'
	];

const tutorialText_indiv =
	[ '<br>This is the tutorial task. <br><br>Start by choosing whichever slot machine you like!'

	, '<br><br>You got 100 points! Well done.'

	, '<br>This is the second trial. The <span class="note">same slot machines</span> will appear again. <br><br>Please make another choice!'

	, '<br><br>Hooray! You got 100 points!'

	, 'You have <span class="note">up to 10 seconds</span> to make a choice. <br><br>Note: You cannot click any options here for the tutorial purpose. Let\'s see what happens if time is up.'

	, '<br>Time was up and you missed the trial! Try not to miss any trial! <br><br>If you miss a trial, you are asked to confirm you are still participating in the experiment. If you do not manage to confirm you are still in the experiment in another 10 seconds, we have to assume you ended the study and the study will abort without compensation. Please click the "Yes, I am!" button below.'

	, '<br>The tutorial is done. <br><br>Next, you will proceed to a short comprehension quiz!'
	];
const understandingCheckText_indiv =
	[ '<h3>Please answer the following questions.</h3>'

	, 'How many trials will you play in total?' // 76

	, 'Is it possible to choose the same option repeatedly?' //YES

	, 'Does your monetary bonus of this task increase by accumulating more points?' //YES
	];




const revisitingInstructionText =
	[ '<br><br><span class="note">Woops! One or more answers were incorrect.</span> Please read the instruction again!'

	, '<br><br>That\'s it! Take the comprehension quiz again in the next page.'
	]

const goToQuestionnaireText =
	[ 'Well done!'
	, 'Your total game reward: £'
	, 'Waiting bonus: £'
	, 'Flat fee for completion of the task: £'
	];

const goToNewGameRoundText =
	[ 'Well done!'
	, 'You have completed Round #'
	, 'Please proceed to the next round!'
	, ''
	];

const testText = ['this is a test'];


const instructionText_group =
	[ 'Please read the following instructions carefully. After reading the instructions, we will ask a few questions to verify your understanding of the experimental task. <br><br>After answering these questions, you may spend some more time in a waiting room until sufficient number of participants have arrived to start the task. <br><br>You will be paid <span class="note">10&nbsp;pence per minute</span> (that is, £6 per hour) for any time spent in the waiting room. When your group is ready, the main task will start.'

	, '<br>Throughout the main task, you are to make a series of choices between '//+numOptions+' slot machines.'

	, '<br><br>Overall, you will play <span class="note">60&nbsp;trials</span> in the game. On <span class="note">each trial</span>, you are to make <span class="note">1&nbsp;choice</span>.'

	//, '<br>The slot machines will be reset for every new game.'

	, '<br>Other people will participate in this online experiment at the same time with you. You will be in a group of 2 ~ 6 people.'

	, '<br>Your choice will generate some rewards. The points you and other group members generate are summed up. The sum of the points is your group\'s total reward.'

	, '<br>Your final payout will be the <span class="note">group\'s total points divided by the number of people in your group</span>.'

	, '<br>The total reward you get will be converted into real money. The exchange rate is <span class="note">500&nbsp;points = 15&nbsp;pence</span>.'

	, 'The reward for each slot seems random, but <span class="note">one of the slots may generate a higher payoff on average than the other one</span>. The average payoff of each slot is mostly constant over trials, and is same for all members; however, the exact amount of payoff you get may be different from what other group members get from the same slot, due to the randomness.'

	, 'After each choice, you can see how much points you generated. Subsequently, <span class="note">you may share your experience of that trial to other group members</span> if you choose to pay some costs incurred on the group\'s total reward.'

	, '<br>If you choose "YES", the cost is paid. In this case, 200 points minus the cost of 50 points, that is, 150 points will be added to the group\'s total payoff.'

	, '<br>If you choose to share the information, other members can see how much payoffs the slot has generated in the preceding trial. This may be helpful for other members to quickly guess which slot seems to be a better option.'

	, 'If you see numbers shown above the slots, this means that <span class="note">another group member has chosen to share information at the cost</span>. In this example, the information indicates that the slot 2 has dropped 130 points in the preceding trial to another member of your group. This may help you and the other group members to determine which slot provides the better outcomes.'

	//, '<br>The sharing cost will vary from trial to trial. At some trials, you can share information more cheaply, while other times it is more expensive. Thus, use the "information sharing" wisely!'

	, '<br><br><br>On the next page, you will play a tutorial to get familiar with the task!'
	];