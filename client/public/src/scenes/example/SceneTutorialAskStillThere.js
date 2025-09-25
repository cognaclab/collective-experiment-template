// SceneTutorialAskStillThere

import {rand
	, createCircle
} from '../../functions.js';

class SceneTutorialAskStillThere extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneTutorialAskStillThere', active: false });
	}

	preload(){
		}

	init (data) {
		this.choice = data.choice;
		this.didMiss = true;
		this.tutorialPosition = data.tutorialPosition;
		this.taskOrder = data.taskOrder;
		this.taskType = data.taskType;
	}

	create(){

		// tutorial texts
	    let tutorialPosition = this.tutorialPosition;
	    let slotY_tutorial = 480//430
	    ,	socialInfoY = slotY_tutorial - 90
	    ,	payoffTextY = slotY_tutorial - 90
	    ,	trialText_tutorialY = 16+165
	    ,	groupSizeText_tutorialY = 65+165
		,	objects_resultStage = {}
		,	energyBar_tutorialY = 96+165
	    ;

		// indivOrGroup
	    let tutorialText;
	    if (indivOrGroup == 0) {
	    	tutorialText = tutorialText_indiv;
	    } else {
	    	tutorialText = tutorialText_group;
	    }
	    const tutorialTextStyle = 'background-color: rgba(51,51,51,0.1); width: 700px; height: 150px; font: 25px Arial; position: relative;';
	    const tutorialTextStyle_large = 'background-color: rgba(51,51,51,0.1); width: 700px; height: 250px; font: 25px Arial; position: relative;';
	    // let tutorialDiv = document.getElementById('tutorialDiv');
	    let tutorialDiv = document.createElement('div');
	    if (tutorialTrial < 3) {
		    tutorialDiv.style = tutorialTextStyle;
		} else {
			tutorialDiv.style = tutorialTextStyle_large;
		}
	    tutorialDiv.innerHTML = tutorialText[tutorialPosition];
	    tutorialDiv.id = 'tutorialDiv';
	    // Add the div
	    if(tutorialPosition < 6) {
		    let tutorialElement = this.add.dom(configWidth/2, 100, tutorialDiv);
		} else {
			let tutorialElement = this.add.dom(configWidth/2, 130, tutorialDiv);
		}

		// loading circle animation
		let CircleSpinContainer = this.add.container(configWidth/2, configHeight/2 - 50);
		createCircle(this, CircleSpinContainer, 0, 0, 48, 0xffc3b0); // background = 0xffd6c9, brighter 0xffe9e3
		CircleSpinContainer.visible = false;

		let confirmationTimer
	    ;
	    // ===== A looking-good timer ==========
		// the timer container. A simple sprite
		let timerContainer = this.add.sprite(400, 300, 'energycontainer');
		// the timer bar. Another simple sprite
		let timerBar = this.add.sprite(timerContainer.x + 46, timerContainer.y, 'energybar');
		// a copy of the timer bar to be used as a mask. 
		// Another simple sprite but...
		let timerMask = this.add.sprite(timerBar.x, timerBar.y, 'energybar');
		// ...it's not visible...
		timerMask.visible = false;
		// resize them
		let timerContainer_originalWidth = timerContainer.displayWidth
		,	timerContainer_newWidth = 200
		,	container_bar_ratio = timerBar.displayWidth / timerContainer.displayWidth
		;
		timerContainer.displayWidth = timerContainer_newWidth;
		timerContainer.scaleY = timerContainer.scaleX;
		timerBar.displayWidth = timerContainer_newWidth * container_bar_ratio;
		timerBar.scaleY = timerBar.scaleX;
		timerBar.x = timerContainer.x + (46 * timerContainer_newWidth/timerContainer_originalWidth);
		timerMask.displayWidth = timerBar.displayWidth;
		timerMask.scaleY = timerMask.scaleX;
		timerMask.x = timerBar.x;
		// and we assign it as timerBar's mask.
		timerBar.mask = new Phaser.Display.Masks.BitmapMask(this, timerMask);
		timerContainer.visible = false;
		timerBar.visible = false;

		// === background colour ===
		this.cameras.main.setBackgroundColor(backgroundcolour_feedback);//#d9d9d9 = grey #ffffff = white
		//  === Texts ===
		let slotY_main = 400;
		objects_feedbackStage = {};
		for (let i=1; i<numOptions+1; i++) {
			objects_feedbackStage['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_main, 'machine'+(i+numOptions*gameRound)+'_active').setDisplaySize(optionWidth, optionHeight);
			// Only the chosen option is made visible
			if (i != this.choice) {
				objects_feedbackStage['box'+i].visible = false;
			} else {
				objects_feedbackStage['box'+i].visible = true;
			}
		}

		// button style
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };

		// Yes I am still there! button
		let buttonContainer_confirm = this.add.container(400, 450); //position
		let buttonImage_confirm = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_confirm = this.add.text(0, 0, 'Yes, I am!', button_style);
		buttonText_confirm.setOrigin(0.5, 0.5);
		buttonContainer_confirm.add(buttonImage_confirm);
		buttonContainer_confirm.add(buttonText_confirm);
		buttonContainer_confirm.visible = false;

	    buttonImage_confirm.on('pointerover', function (pointer) {
	    	buttonImage_confirm.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_confirm.on('pointerout', function (pointer) {
	    	buttonImage_confirm.clearTint();
	    }, this);

	    
	    buttonImage_confirm.on('pointerdown', function (pointer) {
	    	currentChoiceFlag = -1;
	    	waitOthersText.setText('Please wait for others...');
			tutorialPosition++;
			if (indivOrGroup === 0 && tutorialTrial === 3) {
				this.scene.start('SceneBeforeUnderstandingTest', { indivOrGroup: indivOrGroup , taskType: this.taskType});
				this.scene.stop('SceneTutorialFeedback');
			} 
			else {
				this.scene.start('SceneTutorialFeedback', { 
								indivOrGroup: indivOrGroup
								, choice: -1
								, taskOrder: this.taskOrder
								, taskType: this.taskType
								, tutorialPosition: tutorialPosition });
			}

	    	buttonContainer_confirm.visible = false;
	    	if (indivOrGroup == 1) CircleSpinContainer.visible = true;
	    	confirmationTimer?.destroy();

	    }, this);


		if(this.flag == -1) {
			feedbackTextPosition = missPositionX;
			//this.flag = 0;
			// console.log('feedbackTextPosition set is done: feedbackTextPosition == '+ feedbackTextPosition);
		} else {
			// console.log('scenefeedbackstage: this.flag == '+ this.flag);
			// for(let i=1; i<numOptions+1; i++) {
			// 	if(i == this.flag){
			// 		objects_feedbackStage['box'+this.flag].visible = true;
			// 	}else{
			// 		objects_feedbackStage['box'+this.flag].visible = false;
			// 	}
			// }
			// objects_feedbackStage['box'+this.flag].visible = true;
			feedbackTextPosition = option1_positionX + space_between_boxes * (this.flag - 1);
			//this.flag = 0;
			// console.log('feedbackTextPosition set is done: feedbackTextPosition == '+ feedbackTextPosition);
		}

		if (this.didMiss) {
			payoffText = this.add.text(feedbackTextPosition, slotY_main-80, `Missed!`, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
		} 
		
		if (indivOrGroup == 1) {
			if (this.didMiss) {
				// if missed
				setTimeout(function(){

					waitOthersText = this.add.text(configWidth/2, 360, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"}).setOrigin(0.5, 0.5);
					buttonContainer_confirm.visible = true;

					//
					timerContainer.visible = true;
		    		timerBar.visible = true;

					// ====== Count down ============
					// this.timeLeft = maxConfirmationWhenMissed / 1000;
					// // a boring timer.
					// confirmationTimer = this.time.addEvent({
					//     delay: 1000,
					//     callback: function(){
					//         this.timeLeft --;

					//         // dividing timer bar width by 
					// 		// the number of seconds gives us the amount
					//         // of pixels we need to move 
					// 		// the timer bar each second
					//         let stepWidth = timerMask.displayWidth / (maxConfirmationWhenMissed/1000);

					//         // moving the mask
					//         timerMask.x -= stepWidth;

					        
					//     },
					//     callbackScope: this,
					//     loop: true
					// });
					// ====== Count down ============

				}.bind(this),  1 * 400);

			}
		} else if (indivOrGroup == 0 && this.didMiss == true) {
			// if missed
			setTimeout(function(){

				waitOthersText = this.add.text(16, 260, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"});
				buttonContainer_confirm.visible = true;

				//
				timerContainer.visible = false;
	    		timerBar.visible = false;

				// =============== Count down =================================
				// this.timeLeft = maxConfirmationWhenMissed / 1000;
				// // a boring timer.
				// confirmationTimer = this.time.addEvent({
				//     delay: 1000,
				//     callback: function(){
				//         this.timeLeft --;

				//         // dividing timer bar width by 
				// 		// the number of seconds gives us the amount
				// 		// of pixels we need to move 
				// 		// the timer bar each second
				//         let stepWidth = timerMask.displayWidth / (maxConfirmationWhenMissed/1000);

				//         // moving the mask
				//         timerMask.x -= stepWidth;

				//     },
				//     callbackScope: this,
				//     loop: true
				// });
				// =============== Count down =================================

			}.bind(this),  1 * 400);

		} else {
			waitOthersText = this.add.text(16, 60, '', { fontSize: '30px', fill: '#000', align: "center"});
			// setTimeout(function(){
		    // 	currentChoiceFlag = 0;
			// 	// tell the server it's missed 
			// 	socket.emit('choice made', 
			// 		{chosenOptionFlag: -1 // chosen option's id
			// 			, num_choice: -1 // location of the chosen option
			// 			, individual_payoff: 0
			// 			, subjectNumber: subjectNumber
			// 			, thisTrial: currentTrial
			// 			, miss: false
			// 		});
		    // }.bind(this), feedbackTime * 1000);
		}
	}
	update(){}
};

export default SceneTutorialAskStillThere;