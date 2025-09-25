/*

A collective reward multi-player 3-armed bandit task 
Author: Wataru Toyokawa (wataru.toyokawa@riken.jp)
Collaborating with Katja Sangati
May 2025

1. The task is basically a simple bandit task
2. However, players cannot see their individual payoffs
3. and they can only see the total team reward (i.e. sum(indiv_payoffs))

*/

'use strict';

// ==== Import Scenes (Example Experiment) ==================
import SceneWaitingRoom0 from './scenes/example/SceneWaitingRoom0.js';
import SceneWaitingRoom from './scenes/example/SceneWaitingRoom.js';
import SceneWaitingRoom2 from './scenes/example/SceneWaitingRoom2.js';
import SceneInstruction from './scenes/example/SceneInstruction.js';
import SceneTutorial from './scenes/example/SceneTutorial.js';
import SceneTutorialFeedback from './scenes/example/SceneTutorialFeedback.js';
import SceneTutorialAskStillThere from './scenes/example/SceneTutorialAskStillThere.js';
import SceneTutorialSharingCostExplained from './scenes/example/SceneTutorialSharingCostExplained.js';
import SceneBeforeUnderstandingTest from './scenes/example/SceneBeforeUnderstandingTest.js';
import SceneUnderstandingTest from './scenes/example/SceneUnderstandingTest.js';
import ScenePerfect from './scenes/example/ScenePerfect.js';
import SceneStartCountdown from './scenes/example/SceneStartCountdown.js';
import SceneAskStillThere from './scenes/example/SceneAskStillThere.js';
import SceneMain from './scenes/example/SceneMain.js';
import SceneResultFeedback from './scenes/example/SceneResultFeedback.js';
import SceneGoToNewGameRound from './scenes/example/SceneGoToNewGameRound.js';
import SceneGoToQuestionnaire from './scenes/example/SceneGoToQuestionnaire.js';
import SceneMessagePopUp from './scenes/example/SceneMessagePopUp.js';
import SceneNextRoundsInstruction from './scenes/example/SceneNextRoundsInstruction.js';


// ===== Import Functions =============================
import {rand
	, sum
	, settingConfirmationID
    , settingBanditPayoffs
    , createWindow
} from './functions.js';

/**===============================================
	Phaser Game Script
==================================================*/

window.onload = function() {
	// basic experimental values goes to POST values (in game.ejs)
	$("#subjectID").val(subjectID);
    $("#completed").val(completed);
    $("#currentTrial").val(currentTrial);
    $("#gameRound").val(gameRound);

    //======== monitoring reload activity ==========
    if (window.performance && subjectID != 'INHOUSETEST') {
        if (performance.navigation.type === 1) {
            // Redirecting to the questionnaire
            socket.io.opts.query = 'sessionName=already_finished';
            socket.disconnect();
            window.location.href = htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&info_share_cost='+info_share_cost+'&bonus_for_waiting='+waitingBonus+'&totalEarningInPence='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed='+0+'&latency='+submittedLatency;
        }
    }
    //======== end: monitoring reload activity =====


    // ─────────────────────────────────────────────────────────────
    // Page-visibility watchdog: send user to “bye-bye” after 7 s
    // ─────────────────────────────────────────────────────────────
    const HIDDEN_LIMIT   = 7_000;   // 7 s
    let hideTimeoutId    = null;    // id of the pending timeout

    function kickPlayer() {
        socket.io.opts.query = 'sessionName=already_finished';
        // …any other clean-up…
        socket.disconnect();
        // redirect
        $("#subjectID").val(subjectID);
        $("#currentTrial").val(currentTrial);
        $("#gameRound").val(gameRound);
        $("#indivOrGroup").val(indivOrGroup);
        $("#bonus_for_waiting").val(Math.round(waitingBonus));
        $("#completed").val("browserHidden");
        $("#form").submit();
    }

    // initial state (in case the script loads in a background tab)
    if (document.visibilityState === 'hidden') scheduleKick();

    // listen for future tab changes
    document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        scheduleKick();
    } else {
        cancelKick();
    }
    });

    // helpers
    function scheduleKick() {
        cancelKick();    // ensure only one timer
        hideTimeoutId = setTimeout(kickPlayer, HIDDEN_LIMIT);
    }

    function cancelKick() {
        if (hideTimeoutId !== null) {
            clearTimeout(hideTimeoutId);
            hideTimeoutId = null;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────
	let config = {
	    type: Phaser.AUTO, // Phaser.CANVAS, Phaser.WEBGL, or Phaser.AUTO
	    width: configWidth,
	    height: configHeight,
	    physics: {
	        default: 'arcade',
	        arcade: {
	            gravity: { y: 300 },
	            debug: false
	        }
	    },
	    parent: 'phaser-game-main',
	    scale: {
	        _mode: Phaser.Scale.FIT,
	        // mode: Phaser.Scale.ScaleModes.FIT,
	        parent: 'phaser-game-main',
	        autoCenter: Phaser.Scale.CENTER_BOTH,
	        width: configWidth,
	        height: configHeight
	    },
	    dom: {
        	createContainer: true
    	},
	    scene:
	    [ SceneWaitingRoom0
	    , SceneWaitingRoom
	    , SceneWaitingRoom2
	    , SceneInstruction
    	, SceneTutorial
    	, SceneTutorialFeedback
        , SceneTutorialAskStillThere
    	, SceneTutorialSharingCostExplained
    	, SceneBeforeUnderstandingTest
    	, SceneUnderstandingTest
    	, ScenePerfect
    	, SceneStartCountdown
    	, SceneMain
        , SceneResultFeedback
    	, SceneAskStillThere
    	, SceneGoToNewGameRound
    	, SceneGoToQuestionnaire
    	, SceneMessagePopUp
        , SceneNextRoundsInstruction
    	]
	};

	let game = new Phaser.Game(config);
	game.scene.add('SceneWaitingRoom0');
	game.scene.add('SceneWaitingRoom');
	game.scene.add('SceneWaitingRoom2');
	game.scene.add('SceneInstruction');
	game.scene.add('SceneTutorial');
	game.scene.add('SceneTutorialFeedback');
	game.scene.add('SceneTutorialSharingCostExplained');
	game.scene.add('SceneTutorialAskStillThere');
	game.scene.add('SceneBeforeUnderstandingTest');
	game.scene.add('SceneUnderstandingTest');
	game.scene.add('ScenePerfect');
	game.scene.add('SceneStartCountdown');
	game.scene.add('SceneMain');
    game.scene.add('SceneResultFeedback');
	game.scene.add('SceneAskStillThere');
	game.scene.add('SceneGoToQuestionnaire');
	game.scene.add('SceneGoToNewGameRound');
	game.scene.add('SceneMessagePopUp');
	game.scene.add('SceneNextRoundsInstruction');


	// I think this ping-pong monitoring is out-of-date; review needed. Discarded in the future
	socket.on('pong', function (ms) {
        ////console.log(`socket :: averageLatency :: ${averageLatency} ms`);
        averageLatency.push(ms);
        averageLatency.splice(0,1);
    });

    socket.on('this_is_your_parameters', function (data) {
        confirmationID = data.id;
        myRoom = data.room;
        maxChoiceStageTime = data.maxChoiceStageTime;
        indivOrGroup = data.indivOrGroup;
        exp_condition = data.exp_condition; //binary_4ab
        subjectNumber = data.subjectNumber;
        numOptions = data.numOptions;
        optionOrder = data.optionOrder;
        taskType = data.taskType;
        taskOrder = data.taskOrder;
        changes = data.changes; // env changing points
        environments = data.environments // payoff probability profiles
        horizon = data.horizon;
        
        // calculating the box positions depending on numOptions
        switch (numOptions) {
            case 2:
                option1_positionX = 225
                space_between_boxes = 350
                break;
            case 3:
                option1_positionX = 200
                space_between_boxes = 200
                break;
            case 4:
                option1_positionX = 122.5
                space_between_boxes = 185
                break;
            default:
                option1_positionX = 200
                space_between_boxes = 200
                break;
        }

        // setting the bandit profile
        prob_means = settingBanditPayoffs(numOptions, taskType, horizon, changes, environments, 0);
        // console.log(`taskType is ${taskType} and prob_means is ${prob_means}`);

        // avoiding safari's reload function
        if(!window.sessionStorage.getItem('uniqueConfirmationID')) {
            window.sessionStorage.setItem('uniqueConfirmationID', confirmationID);
        } else if (exceptions.indexOf(subjectID) == -1) {
            // there is already an unique confirmation id existing in the local storage
            socket.io.opts.query = 'sessionName=already_finished';
            socket.disconnect();
            window.location.href = htmlServer + portnumQuestionnaire + '/multipleAccess';
        }
        socket.io.opts.query = 'sessionName='+data.id+'&roomName='+data.room+'&subjectID='+subjectID+'&bonus_for_waiting='+waitingBonus+'&totalEarning='+totalEarning+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed='+completed+'&latency='+submittedLatency;
        
        settingConfirmationID(confirmationID); // do this: $("#confirmationID").val(id);
    });

    socket.on('this_is_your_new_parameters', function (data) {
        // when the room has been reformed due to the limited groupSize
        confirmationID = data?.id;
        myRoom = data?.room;
        indivOrGroup = data?.indivOrGroup;
        subjectNumber = data?.subjectNumber;
        numOptions = data?.numOptions;
        optionOrder = data?.optionOrder;
        taskType = data?.taskType;
        taskOrder = data?.taskOrder;
        changes = data?.changes; // env changing points
        environments = data?.environments // payoff probability profiles
        horizon = data?.horizon;
        
        // calculating the box positions depending on numOptions
        switch (numOptions) {
            case 2:
                option1_positionX = 225
                space_between_boxes = 350
                break;
            case 3:
                option1_positionX = 200
                space_between_boxes = 200
                break;
            case 4:
                option1_positionX = 122.5
                space_between_boxes = 185
                break;
            default:
                option1_positionX = 200
                space_between_boxes = 200
                break;
        }

        // setting the bandit profile
        prob_means = settingBanditPayoffs(numOptions, taskType, horizon, changes, environments, 0);
        // console.log(`new params reeived: taskType is ${taskType} and prob_means is ${prob_means}`);

        // avoiding safari's reload function
        if(!window.sessionStorage.getItem('uniqueConfirmationID')) {
            window.sessionStorage.setItem('uniqueConfirmationID', confirmationID);
        } else if (exceptions.indexOf(subjectID) == -1) {
            // there is already an unique confirmation id existing in the local storage
            socket.io.opts.query = 'sessionName=already_finished';
            socket.disconnect();
            window.location.href = htmlServer + portnumQuestionnaire + '/multipleAccess';
        }
        socket.io.opts.query = 'sessionName='+data.id+'&roomName='+data.room+'&subjectID='+subjectID+'&bonus_for_waiting='+waitingBonus+'&totalEarning='+totalEarning+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed='+completed+'&latency='+submittedLatency;
    });

    socket.on('this is the remaining waiting time', function(data){
        isEnvironmentReady = true;
        maxWaitingTime = data.max;
        maxGroupSize = data.maxGroupSize;
        restTime = data.restTime;
        currentGroupSize = data.n;
        // console.log('socket.on: "this is the remaining waiting time" : '+restTime+' msec.');
        if (isPreloadDone & !isWaitingRoomStarted) {
        	// game.scene.start('ScenePerfect'); // debug

        	game.scene.start('SceneWaitingRoom'); // main

        } else {
        	//socket.emit('not ready yet');
        }
        //SceneWaitingRoom
        //core.replaceScene(core.waitingRoomScene(data.restTime));
    });

    socket.on('wait for others finishing test', function (data) {
    	game.scene.stop('SceneWaitingRoom0');
    	game.scene.stop('SceneWaitingRoom');
    	game.scene.stop('SceneInstruction');
    	game.scene.stop('SceneTutorial');
    	game.scene.stop('SceneTutorialFeedback');
    	game.scene.stop('SceneUnderstandingTest');
    	game.scene.stop('ScenePerfect');
    	game.scene.stop('SceneGoToNewGameRound');
        game.scene.start('SceneWaitingRoom2', data);
    });

    socket.on('n_test_passed updated', function (data) {
    	n_in_waitingRoom2 = data.n_test_passed;
        currentGroupSize = data.n;
    });

    socket.on('wait for others get ready to move on', function (data) {
    	game.scene.stop('SceneWaitingRoom0');
    	game.scene.stop('SceneWaitingRoom');
    	game.scene.stop('SceneInstruction');
    	game.scene.stop('SceneTutorial');
    	game.scene.stop('SceneTutorialFeedback');
    	game.scene.stop('SceneUnderstandingTest');
    	game.scene.stop('ScenePerfect');
    	game.scene.stop('SceneGoToNewGameRound');
        game.scene.start('SceneWaitingRoom2', data);
    });

    // The task starts
    socket.on('this room gets started', function(data) {
        // console.log(`this room gets started with horizon = ${data.horizon}`);
        exp_condition = data.exp_condition;
        optionOrder = data.optionOrder;
        indivOrGroup = data.indivOrGroup;
        maxChoiceStageTime = data.maxChoiceStageTime;
        horizon = data.horizon;
        $("#indivOrGroup").val(indivOrGroup);
        $("#bonus_for_waiting").val(Math.round(waitingBonus));
        waitingRoomFinishedFlag = 1;
        game.scene.stop('SceneWaitingRoom0');
        game.scene.stop('SceneWaitingRoom');

        // game.scene.start('ScenePerfect', data); // make this active for debug
       	game.scene.start('SceneInstruction', data); 

    });

    socket.on('these are new rooms', function (rooms) {
    	// console.log(`receive: "these are new rooms" with ${rooms.newRoomName_1} and ${rooms.newRoomName_2} and ${rooms.newRoomName_3}`);
        socket.emit('let me in one of them', {rooms: [rooms.newRoomName_1,rooms.newRoomName_2,rooms.newRoomName_3]});
    });

    socket.on('you guys are individual condition', function () {
    	//console.log('receive: "you guys are individual condition"');
        socket.emit('ok individual condition sounds good');
    });

    socket.on('all passed the test', function(data) {
        currentGroupSize = data.n;
        gameRound = data.gameRound; // updating the game round
        game.scene.stop('SceneWaitingRoom0');
        game.scene.stop('SceneWaitingRoom');
        game.scene.stop('SceneInstruction');
        game.scene.stop('SceneTutorial');
        game.scene.stop('SceneTutorialFeedback');
        game.scene.stop('SceneUnderstandingTest');
        game.scene.stop('ScenePerfect');
        game.scene.stop('SceneGoToNewGameRound');
        game.scene.stop('SceneWaitingRoom2');
        game.scene.start('SceneStartCountdown', 
            {gameRound: data.gameRound
                , trial: 1
                , n: data.n
                , horizon: data.horizon
                , gameType: data.gameType
                , groupCumulativePayoff: 0});
        // check if n > minimumGroupSize
        // if yes, they should go for the task
        // if no, they shuold go to the byebye question unfortunately.
        // if (data.n >= data.minGroupSize) {
        //     // console.log(data)
        //     currentGroupSize = data.n;
        //     gameRound = data.gameRound; // updating the game round
        //     //console.log('testPassed reached ' + data.testPassed + ' conditoin: ' + data.exp_condition);
        //     game.scene.stop('SceneWaitingRoom0');
        //     game.scene.stop('SceneWaitingRoom');
        //     game.scene.stop('SceneInstruction');
        //     game.scene.stop('SceneTutorial');
        //     game.scene.stop('SceneTutorialFeedback');
        //     game.scene.stop('SceneUnderstandingTest');
        //     game.scene.stop('ScenePerfect');
        //     game.scene.stop('SceneGoToNewGameRound');
        //     game.scene.stop('SceneWaitingRoom2');
        //     game.scene.start('SceneStartCountdown', 
        //         {gameRound: data.gameRound
        //             , trial: 1
        //             , n: data.n
        //             , horizon: data.horizon
        //             , gameType: data.gameType
        //             , groupCumulativePayoff: 0});
        // } else {
        //     //console.log('receive: "you guys are individual condition"');
        //     // socket.emit('ok individual condition sounds good');
        //     $("#subjectID").val(subjectID);
        //     $("#currentTrial").val(currentTrial);
        //     $("#gameRound").val(gameRound);
        //     $("#indivOrGroup").val(0);
        //     $("#bonus_for_waiting").val(Math.round(waitingBonus));
        //     $("#completed").val("solo");
        //     $("#form").submit();
        //     socket.disconnect();
        // }
    });

    socket.on('all are ready to move on', function(data) {
        currentTrial = 1; // resetting the trial number
        gameRound = data.gameRound; // updating the game round
        horizon = data.horizon // horizon for the new round
        taskType = data.taskType // static or dynamic

        // setting the bandit profile
        prob_means = settingBanditPayoffs(numOptions, taskType, horizon, changes, environments, gameRound);

        game.scene.stop('SceneWaitingRoom0');
        game.scene.stop('SceneWaitingRoom');
    	game.scene.stop('SceneInstruction');
    	game.scene.stop('SceneTutorial');
    	game.scene.stop('SceneTutorialFeedback');
    	game.scene.stop('SceneUnderstandingTest');
    	game.scene.stop('ScenePerfect');
    	game.scene.stop('SceneGoToNewGameRound');
        game.scene.stop('SceneWaitingRoom2');
        game.scene.start('SceneStartCountdown', 
            {gameRound: data.gameRound
            , trial: 1
            , this_env: data.this_env
            , horizon: data.horizon
            , groupCumulativePayoff: 0
            , n: data.n
            , taskType: data.taskType
        });
    });

    socket.on('client disconnected', function(data) {
        // console.log('client disconnected ' + data.disconnectedClient + ' left the room');
        currentGroupSize = data?.roomStatus?.n;
        if ( !isThisGameCompleted ) {
            // "this" allows function.js to know where the game exists
        	createWindow(game, 'SceneMessagePopUp', {msg: 'Notification: One member has been disconnected'});
        }
        if (isWaiting) {
        	socket.emit('can I proceed');
        	// console.log('"can I proceed" sent');
        }
    });

    socket.on('these are done subjects', function(data) {
        doneSubject = data.doneSubject;
        // console.log('doneSubject is ' + doneSubject);
    });

    socket.on('Proceed to the result scene', function(data) {
        // update social frequency information
        currentGroupSize = data?.n;
        mySocialInfo = data?.socialInfo[data?.pointer - 1];
        groupTotalScore = data?.groupTotalPayoff[data?.pointer - 1];
        groupCumulativePayoff[data?.gameRound] = data?.groupCumulativePayoff[data?.gameRound];
        taskType = data?.taskType;

        if (indivOrGroup == 1) {
            for (let i = 1; i < numOptions+1; i++) {
                mySocialInfoList['option'+i] = data.socialFreq[data.pointer-1][optionOrder[i-1] - 1];
            }
            // console.log(mySocialInfoList);
        } else {
            for (let i = 1; i < numOptions+1; i++) {
                if (myLastChoiceFlag == i) { // myLastChoice
                    mySocialInfoList['option'+i] = 1;
                } else {
                    mySocialInfoList['option'+i] = 0;
                }
            }
        }

        // changing scenes
        game.scene.stop('SceneAskStillThere');
        game.scene.start('SceneResultFeedback', 
            {gameRound: gameRound
                , trial: currentTrial
                , mySocialInfo: mySocialInfo
                , groupTotalScore: groupTotalScore
                , horizon: horizon
                , n: currentGroupSize
                , groupCumulativePayoff: groupCumulativePayoff[data.gameRound]
                , taskType: taskType 
            });
    });

    socket.on('Proceed to next trial', function(data) {
        if(currentTrial < horizon) {
            mySocialInfo = data.socialInfo[data.pointer-2]; 
            choiceOrder = data.choiceOrder[data.pointer-2];
            groupTotalScore = data.groupTotalPayoff[data.pointer - 1]; 
            groupCumulativePayoff[data.gameRound]  = data.groupCumulativePayoff[data.gameRound];
            totalPayoff_perIndiv = sum( data.totalPayoff_perIndiv );
            totalPayoff_perIndiv_perGame[gameRound] = data.totalPayoff_perIndiv_perGame[gameRound];

            currentTrial++;

            $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
            $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
            $("#currentTrial").val(currentTrial);
            $("#gameRound").val(gameRound);
            $("#bonus_for_waiting").val(Math.round(waitingBonus));
            
            // for (let i =1; i<numOptions+1; i++) {
            // 	objects_feedbackStage['box'+i].destroy();
            // }
        	game.scene.stop('SceneResultFeedback');
        	isWaiting = false
        	game.scene.start('SceneMain', 
                {gameRound: gameRound
                    , trial: currentTrial
                    , mySocialInfo: mySocialInfo
                    , groupTotalScore: groupTotalScore
                    , horizon: horizon
                    , n: currentGroupSize
                    , taskType: taskType
                    , groupCumulativePayoff: groupCumulativePayoff[data.gameRound] 
                    // , currentChoiceFlag: currentChoiceFlag - 1
                });
        	//console.log('restarting the main scene!: mySocialInfo = '+data.socialFreq[data.trial-1]);
        }
        else {
            // End this session if the server wrongly sent the "proceed round message"
            $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
            $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
            $("#currentTrial").val(currentTrial);
            $("#gameRound").val(gameRound);
            $("#completed").val(1);
            // for (let i =1; i<numOptions+1; i++) {
            //     objects_feedbackStage['box'+i].destroy();
            // }
            game.scene.stop('SceneResultFeedback');
            isWaiting = false
            game.scene.start('SceneGoToQuestionnaire');
        }
    });


    socket.on('End this session', function(data) {
        // console.log('data.thisRoomStatus.gameRound ' + data.thisRoomStatus.gameRound);
        // console.log('data.config.numEnv ' + data.config.numEnv);
        // console.log('data.thisRoomStatus.taskType ' + data.thisRoomStatus.taskType);
        // when more gameRounds remain
        if (data.thisRoomStatus.gameRound < data.config.numEnv && data.thisRoomStatus.taskType === 'static') {
            currentTrial = 1; // reset trial
            $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
            $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
            $("#currentTrial").val(currentTrial);
            $("#gameRound").val(gameRound);
            game.scene.stop('SceneAskStillThere');
            game.scene.stop('SceneResultFeedback');
            game.scene.start('SceneNextRoundsInstruction', 
                {whatsNext: data.thisRoomStatus.taskType //data.thisRoomStatus.taskOrder[data.thisRoomStatus.gameRound]
                    , groupPayoffThisRound: data.thisRoomStatus.groupCumulativePayoff[data.thisRoomStatus.gameRound-1]
                    , horizon: data.thisRoomStatus.horizon
                    , gameRound: data.thisRoomStatus.gameRound
                });
        } else {
            $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
            $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
            $("#currentTrial").val(currentTrial);
            $("#gameRound").val(gameRound);
            $("#completed").val(1);
            game.scene.stop('SceneAskStillThere');
            game.scene.stop('SceneResultFeedback');
            isWaiting = false
            game.scene.start('SceneGoToQuestionnaire');
        }

        
    });

    socket.on('group became too small', function(data) {
        $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
        $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
        $("#currentTrial").val(currentTrial);
        $("#gameRound").val(gameRound);
        $("#completed").val("became_solo");
        $("#subjectID").val(subjectID);
        $("#form").submit();
        socket.disconnect();
    });

    socket.on('S_to_C_welcomeback', function(data) {
    	const completed = 'reconnected';
        // You could give them a chance to go back to the session;
        // However, for now I just redirect them to the questionnaire
        socket.io.opts.query = 'sessionName=already_finished';
        $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
        $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
        $("#currentTrial").val(currentTrial);
        $("#gameRound").val(gameRound);
        $("#completed").val(completed);
        $("#subjectID").val(subjectID);
        $("#form").submit();
        socket.disconnect();
    });

    socket.on('reconnected after the game started', function(data) {
        completed = 'reconnected';
        // You could give a change to the shortly disconnected client to go back to the session
        // However, for now I just redirect them to the questionnaire
        socket.io.opts.query = 'sessionName=already_finished';
        $("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
        $("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
        $("#currentTrial").val(currentTrial);
        $("#gameRound").val(gameRound);
        $("#completed").val("reconnected");
        $("#subjectID").val(subjectID);
        $("#form").submit();
        socket.disconnect();
        // socket.disconnect();
        // window.location.href = htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&info_share_cost='+info_share_cost+'&bonus_for_waiting='+waitingBonus+'&totalEarningInPence='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed='+completed+'&latency='+submittedLatency;
    });

} // window.onload -- end
