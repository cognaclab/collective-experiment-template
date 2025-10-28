'use strict';

// // const htmlServer = 'http://192.168.33.10:'; // vagrant server
// const htmlServer = 'http://63-250-60-135.cloud-xip.io:'; //ipaddress 63.250.60.135
// //const portnum = 8080; //8181
// const portnumQuestionnaire = 8000;
// const exceptions = ['INHOUSETEST3', 'wataruDebug', 'wataruDebug'];

// === Socket.io ====
const portnumQuestionnaire = 8000
	// Auto-detect server based on current hostname
	, htmlServer = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
		? 'http://localhost:' // Development server
		: 'http://tk2-127-63496.vs.sakura.ne.jp:' // Production server
	, exceptions = [
		'wataruDebug',  // Original internal test IDs
		'test', 'debug', 'quicktest',    // Quick-test recommended IDs
		'test1', 'test2', 'test3',       // Common test IDs used in docs
		'alice', 'bob', 'carol',         // Named test users in docs
		'player1', 'player2', 'player3'  // Player IDs for group testing
	]
;

// Create socket connection and expose to window for ES6 module access
window.socket = io.connect(htmlServer+portnum, { query: 'subjectID='+subjectID }); // portnum is defined in game.ejs
const socket = window.socket; // Local reference for backward compatibility

const flatBonus = 1.6; // pounds sterling (GBP)

// experimental parameters 
// -- these values are fixed when 
// -- it get "this_is_your_parameters" from the server
let numOptions = 0
,	option1_positionX = 0 // X coordinate of the bandit 1 
,	space_between_boxes = 0 // a space between option icons
,	info_share_cost = 0
,	info_share_cost_total = 0
,	environment_change = 0
,	optionOrder
,	confirmationID = 'browser-reloaded'
,	myRoom
,	maxChoiceStageTime
,	indivOrGroup
,	exp_condition
,	taskOrder
,   subjectNumber
,   horizon
,	changes// env changing points for the dynamic task
,	environments // payoff profiles for each environments 
,	prob_means // a full list of the bandit probability
,	gameRound = 0
,	taskType // static or dynamic
,	incorrectCount = 0
;

const mean_list = []
, sd_list = []
, base_mean = 1
;

// Gaussian distribution (E[risky] = 1.61)
/*let mean_sure = 1.5
,	sd_sure = 0.05
,	mean_risky = 1.60
,	sd_risky = 1
;*/
let mean_sure
,	sd_sure = 0.1
,	mean_risky
,	sd_risky = 1
;

// Binary distribution (E[risky] = 1.61)
//let riskDistributionId = rand(3, 0); // PILOT TEST
let pRiskyRare
,	pSure
,	pPoor
,	payoff_sureL
,	payoff_sureH
,	payoff_sureL1
,	payoff_sureH1
,	payoff_sureL2
,	payoff_sureH2
,	payoff_sureL3
,	payoff_sureH3
,	payoff_riskyCommon
,	payoff_riskyRare
,	smallNoise = sd_sure
,	probabilityList = {}
,	payoffList = {}
,	optionsKeyList = []
;

const backgroundcolour_feedback = '#ffd6c9'; //#d9d9d9 = grey #ffffff = white

const maxLatencyForGroupCondition = 1500; //1500;
const feedbackTime = 1.5;

let isEnvironmentReady = false
,	isPreloadDone = false
,	isWaitingRoomStarted = false
,	isWaiting = false
,	isThisGameCompleted = false
,	wasAnyoneDisconnected = false
,   myChoices = []
,   myEarnings = []
,   payoff = 0
,	didShare = 0
,	payoffTransformed
,   totalEarning = 0
,	groupCumulativePayoff = [0, 0]
,	cent_per_point = 6/100 // 4 pence per 100 points
,	browserHiddenPermittedTime = 7 * 1000
,   sessionName
,   roomName
,	maxConfirmationWhenMissed = 10 * 1000
,   currentTrial = 1
,   currentStage
,	n_in_waitingRoom2 = 0// the current number of subjects who finished Intro
,	currentGroupSize = 0 // the current number of subject in the room
,   choiceOrder
,   currentChoiceFlag = 0
,   waitingBonus = 0
,	waitingBonus_per_6sec = 1.0
,   maxGroupSize
,	maxWaitingTime
,	answers = [-1,-1,-1,-1,-1]
,   startTime
,	doneSubject
,   pointCentConversionRate = 0
,   completed = 0
,   waitingRoomFinishedFlag = 0
,	understandingCheckStarted = 0
,   averageLatency = [0,0,0]
,   submittedLatency = -1
,	mySocialInfoList = {option1:0, option2:0, option3:0, option4:0}
,	mySocialInfo
,	myPublicInfo
,	myLastChoice
,	myLastChoiceFlag
,	share_or_not = []
// ,	payoff_info = []
// ,	shared_position = []
;

const myData = [];

const alphabetList = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
const iconColourList = ['blue','red','yellow'];
const instructionTextBackgroundColor = "rgba(255,255,255, 0.5)";

// experimental variables
let configWidth = 800
, configHeight = 600
, optionWidth = 150
, optionHeight = 150



// ---- 2-armed bandit
// , option1_positionX = 225
// , space_between_boxes = 350 //190 //space_between_boxes
// ------------------

// --- 4-armed bandit
// , option1_positionX = 122.5
// , space_between_boxes = 185 //190 //space_between_boxes
// ------------------


// , option2_positionX = 250
// , option3_positionX = 450
// , option4_positionX = 650
, missPositionX = configWidth/2
//, leftSlotPositionX
//, rightSlotPositionX
//, missPositionX
, surePosition = 0
, riskyPosition = 1
, noteColor = '#ff5a00' // red-ish
, nomalTextColor = '#000000' // black
, player
, stars_option1 = []
, stars_option2 = []
, stars_option3 = []
, stars_option4 = []
, stars_sure = []
, stars_risky = []
, bombs
, platforms
, cursors
, score = 0

, groupTotalScore = 0
, totalPayoff_perIndiv = 0
// , totalPayoff_perIndiv_all = []
, totalPayoff_perIndiv_perGame = new Array(4).fill(0) // = [0,0,0,0]

, gameOver = false
, choiceFlag
, waitingBox
, waitingBar
, waitingCountdown
, countDownChoiceStage = new Object()
, bonusBar
, bonusBox
, countdownText
, bonusText
, restTime

, trialText
, scoreText
, timeText
, payoffText
, groupTotalScoreText
, costPaidText
, costPaidText_2

, waitOthersText
, objects_feedbackStage
, feedbackTextPosition
//, currentInstructionPicture = []
, instructionPosition = 0
, trialText_tutorial
, groupSizeText_tutorial
, timeText_tutorial
, tutorialPosition // tracking the tutorial text's number
, tutorialTrial = 1 // tracking the tutorial's trial (1, 2, or 3)
, score_tutorial = 0
, choice_tutorial = 0
, isInstructionRevisit = false
, emitting_time = 0
;
