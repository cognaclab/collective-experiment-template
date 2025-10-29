// SceneResultFeedback

import {rand
	, showStars_4ab
} from '../../functions.js';

class SceneResultFeedback extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneResultFeedback', active: false });
	}

	preload(){
		}

	init (data) {
		this.gameRound = data.gameRound
		this.trial = data.trial
		this.mySocialInfo = data.mySocialInfo
		this.groupTotalScore = data.groupTotalScore
		this.horizon = data.horizon
		this.n = data.n
		this.taskType = data.taskType
	}

	create(){

		// background colour
		this.cameras.main.setBackgroundColor(backgroundcolour_feedback);//#d9d9d9 = grey #ffffff = white
		//  Texts
		let slotY_main = 400
		,	trialText_Y = 16
		,	groupTotalScoreText_Y = 16 + 100 * 1
		,	objects_resultStage = {}
		,	point_or_points = ' point!!'
		;

		// Texts appear above the slots
		if (this.taskType === 'static') {
			trialText = this.add.text(16, trialText_Y
				, `Current trial: ${this.trial} / ${this.horizon} (Round ${this.gameRound + 1})`
				, { fontSize: '30px', fill: nomalTextColor });
		}
		else {
			trialText = this.add.text(16, trialText_Y
				, `Current trial: ${this.trial} / ${this.horizon}`
				, { fontSize: '30px', fill: nomalTextColor });
		} 
		
		if (this.groupTotalScore != 1) point_or_points = ' points!!'
		
		if (indivOrGroup === 1) {
			groupTotalScoreText = this.add.text(110, groupTotalScoreText_Y
				, 'Your team got ' + this.groupTotalScore + point_or_points
				, { fontSize: '40px', fill: noteColor });
		} else {
			groupTotalScoreText = this.add.text(110, groupTotalScoreText_Y
				, 'You got ' + this.groupTotalScore + point_or_points
				, { fontSize: '40px', fill: noteColor });
		}
		

		// bandit objects
		for (let i=1; i<numOptions+1; i++) {
			objects_resultStage['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_main, 'machine'+(i+numOptions*gameRound)+'_active').setDisplaySize(optionWidth, optionHeight);
			objects_resultStage['box'+i].visible = true;
		}

		// social information
	    let socialFreqNumbers = {};
	    if (indivOrGroup === 1) {
	    	for (let i = 1; i < numOptions+1; i++) {
				if (mySocialInfoList['option'+i] != 1) {
					socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_main-80, `${mySocialInfoList['option'+i]} people`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
				} else if (mySocialInfoList['option'+i] == 1) {
					socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_main-80, `1 person`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
				}
	    	}
	    } else { // individual condition
	    	for (let i = 1; i < numOptions+1; i++) {
	    		socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_main-80, `You chose this`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
	    		if (mySocialInfoList['option'+i] > 0) {
	    			// console.log('mySocialInfoList option '+ i +' is visible');
	    			socialFreqNumbers['option'+i].visible = true;
	    		} else {
	    			// console.log('mySocialInfoList option '+ i +' is NOT visible');
	    			socialFreqNumbers['option'+i].visible = false;
	    		}
	    	}
	    }
	    // No social info visible
	    // (change inside of the if() when you want to show "?? people" info)
	    if(currentTrial > 0 && indivOrGroup === 1) { //-> if(currentTrial==1) {
	    	for (let i = 1; i < numOptions+1; i++) {
	    		socialFreqNumbers['option'+i].visible = true;
	    	}
	    }
	    //  Stars that are evenly spaced 70 pixels apart along the x axis
	    let numberOfPreviousChoice = [];
	    // let shared_payoff = [];
	    // let shared_option_position = [];
	    // for (let i = 0; i < maxGroupSize; i++) {
	    // 	if (typeof subjectNumber != 'undefined' && share_or_not[i] != null) {
	    // 		if (i+1 != subjectNumber && share_or_not[i].share == 1) { // <- only info shared by others will be shown
	    // 			shared_payoff.push(share_or_not[i].payoff);
	    // 			// shared_option_position.push( optionOrder.indexOf(optionsKeyList.indexOf(mySocialInfo[i])) )
	    // 			shared_option_position.push(share_or_not[i].position);
	    // 		}
	    // 	}
	    // }
	    for (let i = 1; i < numOptions+1; i++) {
	    	numberOfPreviousChoice[i-1] = mySocialInfoList['option'+i]
	    }

	    // --- Social frequency information (used in Toyokawa & Gaissmaier 2020)
	    // Turn this on when you want to show the frequency-information
	    // and turn off the 'publicInfo.call' in this case
	    //
		
	    showStars_4ab.call(this, numberOfPreviousChoice[0], numberOfPreviousChoice[1], numberOfPreviousChoice[2], numberOfPreviousChoice[3], slotY_main-90, currentChoiceFlag-1);
	    //
	    // --------------------------------------------------------------------
	    // if(this.trial > 1) {
	    // 	showPublicInfo.call(this, shared_payoff, shared_option_position, slotY_main-90);
	    // } else {
	    // 	// console.log('No public info should be shown!')
	    // }

		// === moving to the next trial ===
		// =============== Count down =================================
    	this.timeLeft = 1.5*1000 / 1000; // 1.5 sec for the results feedback
		// a boring timer.
        let gameTimer = this.time.addEvent({
            delay: 1000,
            callback: function(){
                this.timeLeft --;

                if(this.timeLeft < 0){
					if (window.socket && window.experimentFlow) {
						window.socket.emit('scene_complete', {
							scene: 'SceneResultFeedback',
							sequence: window.experimentFlow.sequence
						});
					} else {
						socket.emit('result feedback ended',
							{thisTrial: currentTrial}
						);
					}

					isWaiting = false;
					gameTimer.destroy();
                }
            },
            callbackScope: this,
            loop: true
        });
        // =============== Count down =================================


	}

	update(){}
};

export default SceneResultFeedback;