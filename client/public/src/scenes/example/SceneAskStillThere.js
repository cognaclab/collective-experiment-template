// SceneAskStillThere

import {rand
	, createCircle
} from '../../functions.js';

class SceneAskStillThere extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneAskStillThere', active: false });
	}

	preload(){
		}

	init (data) {
		this.didMiss = data.didMiss;
		this.flag = data.flag;
		this.horizon = data.horizon;
		this.prob_means = data.prob_means;
	}

	create(){

		// Safety timeout - if no server response within 10 seconds, show error
		const SAFETY_TIMEOUT = 10000; // 10 seconds
		this.safetyTimer = this.time.delayedCall(SAFETY_TIMEOUT, () => {
			console.error('SceneAskStillThere: No server response after 10 seconds (trial ' + currentTrial + ')');

			// Show error message to user
			if (this.waitOthersText) {
				this.waitOthersText.setText('Connection issue detected.\nPlease check console (F12) and report this bug.\nTrial: ' + currentTrial);
			}
		});

		// loading circle animation
		let CircleSpinContainer = this.add.container(configWidth/2, configHeight/2 - 50);
		createCircle(this, CircleSpinContainer, 0, 0, 48, 0xffc3b0); // background = 0xffd6c9, brighter 0xffe9e3
		CircleSpinContainer.visible = false;

		let timerBar_Y = 16 + 50 * 2 // 16 + 50 * 4
		,	confirmationTimer
	    ;
	    // ===== A looking-good timer ==========
		// the timer container. A simple sprite
		let timerContainer = this.add.sprite(400, timerBar_Y+18, 'energycontainer');
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
			if (i != this.flag) {
				objects_feedbackStage['box'+i].visible = false;
			} else {
				objects_feedbackStage['box'+i].visible = true;
			}
		}

		// button style
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };

		// Yes I am still there! button
		let buttonContainer_confirm = this.add.container(400, 200); //position
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
	    	// socket.emit('decision stage ended',
	    	// 		{ miss: true
	    	// 		, individual_payoff: 0
	    	// 		, num_choice: -1
	    	// 		, thisTrial: currentTrial
			// 		, disconnect: false
			// 	});
			socket.emit('choice made', 
				{chosenOptionFlag: -1 // chosen option's id
					, num_choice: -1 // location of the chosen option
					, individual_payoff: 0
					, subjectNumber: subjectNumber
					, thisTrial: currentTrial
					, miss: true
					, prob_means: this.prob_means
					, reactionTime: 0
				});
	    	buttonContainer_confirm.visible = false;
	    	if (indivOrGroup == 1) CircleSpinContainer.visible = true;
	    	confirmationTimer.destroy();

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
		} else {
	    	payoffText = this.add.text(feedbackTextPosition, slotY_main-80, `${payoff} points!`, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
	    	// console.log('individual payoff = ' + this.individual_payoff)
		}
		
		if (indivOrGroup == 1) {
			if(!this.didMiss) {
				// When this is a group condition,
				// "please wait" message
				this.waitOthersText = this.add.text(16, 60, 'Please wait for others...', { fontSize: '30px', fill: '#000', align: "center"});

				// setTimeout(function(){
			    // 	currentChoiceFlag = 0;
			    // 	socket.emit('decision stage ended'
		    	// 		, {share: -1 // <- no "sharing button in the last trial, so it's -1."
		    	// 		, payoff: payoff
		    	// 		, num_choice: this.flag
		    	// 		, info_share_cost: info_share_cost
		    	// 		, cost_paid: 0
		    	// 		, thisTrial: currentTrial
		    	// 	});
			    // }.bind(this), feedbackTime * 1000); 
			} else {
				// if missed
				setTimeout(function(){

					waitOthersText = this.add.text(16, 60, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"});
					buttonContainer_confirm.visible = true;

					//
					timerContainer.visible = true;
		    		timerBar.visible = true;

					// =============== Count down =================================
					this.timeLeft = maxConfirmationWhenMissed / 1000;
					// a boring timer.
					confirmationTimer = this.time.addEvent({
					    delay: 1000,
					    callback: function(){
					        this.timeLeft --;

					        // dividing timer bar width by 
							// the number of seconds gives us the amount
					        // of pixels we need to move 
							// the timer bar each second
					        let stepWidth = timerMask.displayWidth / (maxConfirmationWhenMissed/1000);

					        // moving the mask
					        timerMask.x -= stepWidth;

					        if(this.timeLeft < 0){

					            // You could give a change to 
								// the shortly disconnected client 
								// to go back to the session
								// However, for now I just redirect them 
								// to the questionnaire
								socket.io.opts.query = 'sessionName=already_finished';
								// socket.disconnect();
								// window.location.replace(htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&info_share_cost='+info_share_cost+'&bonus_for_waiting='+waitingBonus+'&totalEarningInCent='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed=no_response'+'&latency='+submittedLatency);
								confirmationTimer.destroy();
								buttonContainer_confirm.visible = false;
								waitOthersText.setText('Time was up! \nYou are redirected to the questionnaire...');
								timerContainer.visible = false;
					    		timerBar.visible = false;
					    		timerMask.visible = false;
								$("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
								$("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
								$("#currentTrial").val(currentTrial);
								$("#gameRound").val(gameRound);
								$("#completed").val("no_response");
								$("#subjectID").val(subjectID);
								$("#form").submit();
								socket.disconnect();
					        }
					    },
					    callbackScope: this,
					    loop: true
					});
					// ====== Count down ============

				}.bind(this),  1 * 400);

			}
		} else if (indivOrGroup == 0 && !this.didMiss) {
			// Individual condition, normal choice - just wait for server to proceed
			this.waitOthersText = this.add.text(16, 60, 'Please wait...', { fontSize: '30px', fill: '#000', align: "center"});
		} else if (indivOrGroup == 0 && this.didMiss == true) {
			// if missed
			setTimeout(function(){

				waitOthersText = this.add.text(16, 60, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"});
				buttonContainer_confirm.visible = true;

				//
				timerContainer.visible = true;
	    		timerBar.visible = true;

				// =============== Count down =================================
				this.timeLeft = maxConfirmationWhenMissed / 1000;
				// a boring timer.
				confirmationTimer = this.time.addEvent({
				    delay: 1000,
				    callback: function(){
				        this.timeLeft --;

				        // dividing timer bar width by 
						// the number of seconds gives us the amount
						// of pixels we need to move 
						// the timer bar each second
				        let stepWidth = timerMask.displayWidth / (maxConfirmationWhenMissed/1000);

				        // moving the mask
				        timerMask.x -= stepWidth;

				        if(this.timeLeft < 0){
				            // You could give a change to 
							// the shortly disconnected client 
							// to go back to the session
							// However, for now I just redirect them 
							// to the questionnaire
							socket.io.opts.query = 'sessionName=already_finished';
							// socket.disconnect();
							// window.location.replace('http://' + htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&info_share_cost='+info_share_cost+'&bonus_for_waiting='+waitingBonus+'&totalEarningInCent='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed=no_response'+'&latency='+submittedLatency);
							confirmationTimer.destroy();
							buttonContainer_confirm.visible = false;
							waitOthersText.setText('Time was up! \nYou are redirected to the questionnaire...');
							timerContainer.visible = false;
				    		timerBar.visible = false;
				    		timerMask.visible = false;
							$("#totalEarningInPence").val(Math.round((totalPayoff_perIndiv*cent_per_point)));
							$("#totalEarningInGBP").val(Math.round((totalPayoff_perIndiv*cent_per_point))/100);
							$("#currentTrial").val(currentTrial);
							$("#gameRound").val(gameRound);
							$("#completed").val("no_response");
							$("#subjectID").val(subjectID);
							$("#form").submit();
							socket.disconnect();
				        }
				    },
				    callbackScope: this,
				    loop: true
				});
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

export default SceneAskStillThere;