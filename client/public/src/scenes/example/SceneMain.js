// SceneMain -- main scene; experimental task

import {rand
	, madeChoice
	, showStars_4ab
} from '../../functions.js';

class SceneMain extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneMain', active: false });

	    this.count = 0;
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
		this.groupCumulativePayoff = data.groupCumulativePayoff
		this.taskType = data.taskType
	}

	create(){

		// console.log('scene main: gameRound = ' + this.gameRound + ' trial = ' + this.trial)
		// console.log('scene main: social info = ' + this.mySocialInfo)
		// console.log('scene main: groupCumulativePayoff = ' + this.groupCumulativePayoff)

		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF');
		//console.log('SceneMain started. currentTrial: ' + currentTrial);
		// options
		// slot machines and choice button
	    let options = {};
	    let isChoiceMade = false;
	    let slotY_main = 400;

	    let trialText_Y = 16
	    ,	groupTotalScoreText_Y = 16 + 50 * 1
	    ,	scoreText_Y = 16 + 50 * 3
	    ,	energyBar_Y = 16 + 50 * 2 // 16 + 50 * 4
		,	point_or_points = ' point'
	    ;

		// Creating options
	    for (let i=1; i<numOptions+1; i++) {
			// console.log('creating machine'+(i + numOptions*this.gameRound)+'_normal');
	    	options['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_main, 'machine'+(i + numOptions*this.gameRound)+'_normal');
	    	options['box_active'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_main, 'machine'+(i + numOptions*this.gameRound)+'_active');
	    	options['box'+i].setDisplaySize(optionWidth, optionHeight).setInteractive({ cursor: 'pointer' });
	    	options['box_active'+i].setDisplaySize(optionWidth, optionHeight).setInteractive({ cursor: 'pointer' });
	    	options['box_active'+i].visible = false;
	    }

		// Time stamp
		let time_created = new Date();

		// confirmation text
		let confirmationContainer = this.add.container(175, slotY_main+20);
		let confirmationImage = this.add.sprite(0, 0, 'button').setDisplaySize(160,100).setAlpha(0.7);
		let confirmationText = this.add.text(0, 0, `Click again\nto confirm \nyour choice`, { fontSize: '20px', fill: '#000' }).setOrigin(0.5, 0.5);
		confirmationContainer.add(confirmationImage);
		confirmationContainer.add(confirmationText);
		confirmationContainer.visible = false; // it's hidden in default

		// =============== A looking-good timer =================================
			// the energy container. A simple sprite
		let energyContainer = this.add.sprite(400, energyBar_Y+18, 'energycontainer');
			// the energy bar. Another simple sprite
    	let energyBar = this.add.sprite(energyContainer.x + 46, energyContainer.y, 'energybar');
    		// a copy of the energy bar to be used as a mask. Another simple sprite but...
    	let energyMask = this.add.sprite(energyBar.x, energyBar.y, 'energybar');
    		// ...it's not visible...
    	energyMask.visible = false;
    		// resize them
    	let energyContainer_originalWidth = energyContainer.displayWidth
    	,	energyContainer_newWidth = 200
    	,	container_bar_ratio = energyBar.displayWidth / energyContainer.displayWidth
    	;
		energyContainer.displayWidth = energyContainer_newWidth;
		energyContainer.scaleY = energyContainer.scaleX;
		energyBar.displayWidth = energyContainer_newWidth * container_bar_ratio;
    	energyBar.scaleY = energyBar.scaleX;
    	energyBar.x = energyContainer.x + (46 * energyContainer_newWidth/energyContainer_originalWidth);
    	energyMask.displayWidth = energyBar.displayWidth;
    	energyMask.scaleY = energyMask.scaleX;
    	energyMask.x = energyBar.x;
    	// and we assign it as energyBar's mask.
    	energyBar.mask = new Phaser.Display.Masks.BitmapMask(this, energyMask);
    	// =============== A looking-good timer =================================

    	// =============== Count down =================================
    	this.timeLeft = maxChoiceStageTime / 1000;
		// a boring timer.
        let gameTimer = this.time.addEvent({
            delay: 1000,
            callback: function(){
                this.timeLeft --;

                // dividing energy bar width by the number of seconds gives us the amount
                // of pixels we need to move the energy bar each second
                let stepWidth = energyMask.displayWidth / (maxChoiceStageTime/1000);

                // moving the mask
                energyMask.x -= stepWidth;
                if (this.timeLeft < 1) {
                	// By setting "isChoiceMade" a bit earlier than
                	// the time is actually up, the two conflicting inputs,
                	// a "miss" and an "actual choice" won't be executed at the same time
                	isChoiceMade = true;
                }
                if(this.timeLeft < 0){
                    currentChoiceFlag = -1
                    for (let i=1; i<numOptions+1; i++) {
                    	options['box'+i].visible = false;
                    	options['box_active'+i].visible = false;
                    }
	    //             options.box1.visible = false;
					// options.box1_active.visible = false;
	    //             options.box2.visible = false;
					// options.box2_active.visible = false;
					let time_madeChoice = new Date();
					madeChoice(currentChoiceFlag, 'miss', optionOrder, time_madeChoice - time_created);
					this.scene.start('SceneAskStillThere', {didMiss: true, flag: currentChoiceFlag, horizon: this.horizon, prob_means: [prob_means[0][currentTrial-1], prob_means[1][currentTrial-1], prob_means[2][currentTrial-1]]});
					isWaiting = true;
					gameTimer.destroy();
                }
            },
            callbackScope: this,
            loop: true
        });
        // =============== Count down =================================

        for (let i=1; i<numOptions+1; i++) {
        	// pointerdown - normal option
        	options['box'+i].on('pointerdown', function (pointer) {
				options['box'+i].visible = false;
				options['box_active'+i].visible = true;
				confirmationContainer.x = option1_positionX + space_between_boxes*(i-1);
				confirmationContainer.visible = true;
				currentChoiceFlag = i;
				for (let j=1; j<numOptions+1; j++) {
					if(currentChoiceFlag > 0 && currentChoiceFlag != j) {
						options['box_active'+j].visible = false;
						options['box'+j].visible = true;
					}
				}
		    }, this);
        	// pointerdown - activated option
        	options['box_active'+i].on('pointerdown', function (pointer) {
		    	if(!isChoiceMade) {
					let time_madeChoice = new Date();
		    		madeChoice(currentChoiceFlag, exp_condition, optionOrder, time_madeChoice - time_created);

					gameTimer.destroy();

		    		isWaiting = true;
		    		isChoiceMade = true;

					// Disable all interactive elements to prevent double-clicks
		    		for (let j=1; j<numOptions+1; j++) {
		    			options['box'+j].visible = false;
						options['box'+j].disableInteractive();
		    		}
		    		options['box_active'+i].visible = false;
					options['box_active'+i].disableInteractive();
		    		confirmationContainer.visible= false;

					// Show waiting message in this scene
					if (!this.waitingText) {
						if (indivOrGroup == 1) {
							this.waitingText = this.add.text(configWidth/2, configHeight/2 - 100, 'Please wait for others...',
								{ fontSize: '30px', fill: '#000', align: "center" }).setOrigin(0.5);
						} else {
							this.waitingText = this.add.text(configWidth/2, configHeight/2 - 100, 'Please wait...',
								{ fontSize: '30px', fill: '#000', align: "center" }).setOrigin(0.5);
						}
					}
		    	}
		    }, this);
		    // pointerover
			options['box'+i].on('pointerover', function (pointer) {
		    	options['box'+i].setTint(0xb8860b); //B8860B ff0000
		    }, this);
		    // pointerout
			options['box'+i].on('pointerout', function (pointer) {
		    	options['box'+i].clearTint();
		    }, this);
        }

	    // ------------ Texts appear above the slots
	    if (this.taskType === 'static') {
			trialText = this.add.text(16, trialText_Y
				, `Current trial: ${currentTrial} / ${this.horizon} (Period ${this.gameRound + 1})`
				// , 'Current trial: ' + this.trial + ' / ' + this.horizon
				// , ''
				, { fontSize: '30px', fill: nomalTextColor });
		} 
		else {
			trialText = this.add.text(16, trialText_Y
				, `Current trial: ${currentTrial} / ${this.horizon}`
				// , 'Current trial: ' + this.trial + ' / ' + this.horizon
				// , ''
				, { fontSize: '30px', fill: nomalTextColor });
		} 
		
		if (this.groupCumulativePayoff != 1) point_or_points = ' points'

	    groupTotalScoreText = this.add.text(16, groupTotalScoreText_Y
	    	, 'Total team score so far: ' + this.groupCumulativePayoff + point_or_points
	    	, { fontSize: '30px', fill: nomalTextColor });

	    this.groupSizeText = this.add.text(16, scoreText_Y
	    	// , 'Total score: ' + score
	    	, 'Number of players: ' + currentGroupSize.toString()
	    	// , 'Your net score: ' + (totalPayoff_perIndiv - info_share_cost_total)
	    	, { fontSize: '30px', fill: nomalTextColor });
	    timeText = this.add.text(16, energyBar_Y
	    	, 'Remaining time: '
	    	, { fontSize: '30px', fill: nomalTextColor });

	    payoffText = this.add.text(feedbackTextPosition, slotY_main+100
	    	, ``
	    	, { fontSize: '25px', fill: nomalTextColor, align: 'center' }).setOrigin(0.5, 0.5);

	    // payoffText.setText(`You produced\n${payoff}`);

	    // // The following 'You earned $??' might be misleading as this is a group-optimization task
	    // if (didShare != 1) {
		   //  payoffText.setText(`You earned \n${payoff}`);
	    // } else {
	    // 	payoffText.setText(`You earned \n${payoff} - ${info_share_cost}`);
	    // }
	    // // ==============================================================================

	    // if(currentTrial === 1) {
	    // 	payoffText.visible = false;
	    // } else {
	    // 	payoffText.visible = false; //true;
	    // }
	    // payoffText.visible = false;
	    // --------------------------------------------

	    // social information
	    let socialFreqNumbers = {};
	    if (indivOrGroup === 1) { // group condition
	    	for (let i = 1; i < numOptions+1; i++) {
				if (mySocialInfoList['option'+i] !== 1) {
					socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_main-80, `${mySocialInfoList['option'+i]} people`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
				} else if (mySocialInfoList['option'+i] === 1) {
					socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_main-80, `1 person`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
				}
				socialFreqNumbers['option'+i].visible = false;
	    	}
	    } else if(currentTrial > 1) { // individual condition
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
	    if(currentTrial > 1 && indivOrGroup === 1) { //-> if(currentTrial==1) {
	    	for (let i = 1; i < numOptions+1; i++) {
	    		socialFreqNumbers['option'+i].visible = true;
	    	}
	    }
	    //  Stars that are evenly spaced 70 pixels apart along the x axis
	    let numberOfPreviousChoice = [];
	    
	    for (let i = 1; i < numOptions+1; i++) {
	    	numberOfPreviousChoice[i-1] = mySocialInfoList['option'+i]
	    }

	    // --- Social frequency information (used in Toyokawa & Gaissmaier 2020)
	    // Turn this on when you want to show the frequency-information
	    // and turn off the 'publicInfo.call' in this case
	    //
		if (this.trial > 1) {
			showStars_4ab.call(this, numberOfPreviousChoice[0], numberOfPreviousChoice[1], numberOfPreviousChoice[2], numberOfPreviousChoice[3], slotY_main-90, currentChoiceFlag-1);
		}
		
	}

	update(){
		this.groupSizeText.setText('Number of players: ' + currentGroupSize?.toString());
	}

};

export default SceneMain;
