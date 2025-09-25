// ScenePayoffFeedback

import {rand
	, isNotNegative
	, BoxMuller
	, sum
	, waitingBarCompleted
	, debug_pointerdown
	, sending_core_is_ready
	, goToQuestionnaire
	, settingConfirmationID
	, madeChoice
	, createCircle
} from '../../functions.js';

class ScenePayoffFeedback extends Phaser.Scene {

	constructor (){
	    super({ key: 'ScenePayoffFeedback', active: false });
	}

	preload(){
		}

	init (data) {
		this.didMiss = data.didMiss;
		this.flag = data.flag;
		this.horizon = data.horizon
	}

	create(){

		// loading circle animation
		let CircleSpinContainer = this.add.container(configWidth/2, configHeight/2 - 50);
		createCircle(this, CircleSpinContainer, 0, 0, 48, 0xffc3b0); // background = 0xffd6c9, brighter 0xffe9e3
		CircleSpinContainer.visible = false;

		let energyBar_Y = 16 + 50 * 2 // 16 + 50 * 4
		,	confirmationTimer
	    ;
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
		energyContainer.visible = false;
		energyBar.visible = false;
		// =============== A looking-good timer =================================

		// background colour
		this.cameras.main.setBackgroundColor(backgroundcolour_feedback);//#d9d9d9 = grey #ffffff = white
		//  Texts
		let slotY_main = 400;
		objects_feedbackStage = {};
		for (let i=1; i<numOptions+1; i++) {
			objects_feedbackStage['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_main, 'machine'+(i+numOptions*gameRound)+'_active').setDisplaySize(optionWidth, optionHeight);
			if (i != this.flag) {
				objects_feedbackStage['box'+i].visible = false;
				// console.log('option '+ i +' is invisible because thisflag = '+this.flag);
			} else {
				objects_feedbackStage['box'+i].visible = true;
				// console.log('option '+ i +' is visible because thisflag = '+this.flag);
			}
		}

		// YES button
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };
		let buttonContainer_yes = this.add.container(200, 200); //position
		let buttonImage_yes = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_yes = this.add.text(0, 0, 'YES\n(cost: ' + info_share_cost + ' points)', button_style);
		buttonText_yes.setOrigin(0.5, 0.5);
		buttonContainer_yes.add(buttonImage_yes);
		buttonContainer_yes.add(buttonText_yes);
		buttonContainer_yes.visible = false;

		// NO button
		let buttonContainer_no = this.add.container(600, 200); //position
		let buttonImage_no = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_no = this.add.text(0, 0, 'NO\n(No cost)', button_style);
		buttonText_no.setOrigin(0.5, 0.5);
		buttonContainer_no.add(buttonImage_no);
		buttonContainer_no.add(buttonText_no);
		buttonContainer_no.visible = false;

		// Yes I am still there! button
		let buttonContainer_confirm = this.add.container(400, 200); //position
		let buttonImage_confirm = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_confirm = this.add.text(0, 0, 'Yes, I am!', button_style);
		buttonText_confirm.setOrigin(0.5, 0.5);
		buttonContainer_confirm.add(buttonImage_confirm);
		buttonContainer_confirm.add(buttonText_confirm);
		buttonContainer_confirm.visible = false;

		// pointer over && out effects
	    buttonImage_yes.on('pointerover', function (pointer) {
	    	buttonImage_yes.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_yes.on('pointerout', function (pointer) {
	    	buttonImage_yes.clearTint();
	    }, this);
	    buttonImage_no.on('pointerover', function (pointer) {
	    	buttonImage_no.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_no.on('pointerout', function (pointer) {
	    	buttonImage_no.clearTint();
	    }, this);
	     buttonImage_confirm.on('pointerover', function (pointer) {
	    	buttonImage_confirm.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_confirm.on('pointerout', function (pointer) {
	    	buttonImage_confirm.clearTint();
	    }, this);

	    buttonImage_yes.on('pointerdown', function (pointer) {
	    	currentChoiceFlag = 0;
	    	didShare = 1;
	    	score -= info_share_cost; // <- The cost of sharing information
	    	info_share_cost_total += info_share_cost;
	    	waitOthersText.setText('Please wait for others...');
	    	socket.emit('result stage ended'
	    			, {share: didShare
	    			, payoff: payoff
	    			, num_choice: this.flag
	    			, info_share_cost: info_share_cost
	    			// , totalEarning: (payoff - didShare * info_share_cost)
	    			// , what_produced: payoff
	    			, cost_paid: 1 * info_share_cost
	    			, thisTrial: currentTrial
	    		});
	    	buttonContainer_yes.visible = false;
	    	buttonContainer_no.visible = false;
	    	if (indivOrGroup == 1) CircleSpinContainer.visible = true;
	    }, this);

	    buttonImage_no.on('pointerdown', function (pointer) {
	    	currentChoiceFlag = 0;
	    	didShare = 0;
	    	waitOthersText.setText('Please wait for others...');
	    	socket.emit('result stage ended'
	    			, {share: didShare
	    			, payoff: payoff
	    			, num_choice: this.flag
	    			, info_share_cost: info_share_cost
	    			// , totalEarning: (payoff - didShare * info_share_cost)
	    			// , what_produced: payoff
	    			, cost_paid: 0
	    			, thisTrial: currentTrial
	    		});
	    	buttonContainer_yes.visible = false;
	    	buttonContainer_no.visible = false;
	    	if (indivOrGroup == 1) CircleSpinContainer.visible = true;
	    }, this);

	    buttonImage_confirm.on('pointerdown', function (pointer) {
	    	currentChoiceFlag = 0;
	    	didShare = 0;
	    	waitOthersText.setText('Please wait for others...');
	    	socket.emit('result stage ended'
	    			, {share: didShare
	    			, payoff: payoff
	    			, num_choice: this.flag
	    			, info_share_cost: info_share_cost
	    			// , totalEarning: (payoff - didShare * info_share_cost)
	    			// , what_produced: payoff
	    			, cost_paid: 0
	    			, thisTrial: currentTrial
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
	    	// payoffText.setFontSize(10 + 1.5*Math.sqrt(1/2 * payoff)); //originally: 1*Math.sqrt(2/3 * payoff)
		}
		console.log('didmiss = ' + this.didMiss);
		console.log('currentTrial = ' + currentTrial);
		console.log('horizon = ' + this.horizon);

		if (indivOrGroup == 1) {
			if(!this.didMiss && currentTrial < this.horizon) {
				// When this is a group condition, sharing choice will appear
				setTimeout(function(){
					waitOthersText = this.add.text(16, 60, 'Do you want to share this information\nwith other members?', { fontSize: '30px', fill: '#000', align: "center"});
					buttonContainer_yes.visible = true;
					buttonContainer_no.visible = true;
				}.bind(this),  1 * 1000);
			} else if (currentTrial >= this.horizon) {
				waitOthersText = this.add.text(16, 60, 'Please wait for others...', { fontSize: '30px', fill: '#000', align: "center"});
				setTimeout(function(){
			    	currentChoiceFlag = 0;
			    	socket.emit('result stage ended'
		    			, {share: -1 // <- no "sharing button in the last trial, so it's -1."
		    			, payoff: payoff
		    			, num_choice: this.flag
		    			, info_share_cost: info_share_cost
		    			, cost_paid: 0
		    			, thisTrial: currentTrial
		    		});
			    }.bind(this), feedbackTime * 1000); //2.5 * 1000 ms was the original
			} else {
				console.log('somehow this is executed')
				// if missed
				setTimeout(function(){

					waitOthersText = this.add.text(16, 60, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"});
					buttonContainer_confirm.visible = true;

					//
					energyContainer.visible = true;
		    		energyBar.visible = true;

					// =============== Count down =================================
					this.timeLeft = maxConfirmationWhenMissed / 1000;
					// a boring timer.
					confirmationTimer = this.time.addEvent({
					    delay: 1000,
					    callback: function(){
					        this.timeLeft --;

					        // dividing energy bar width by the number of seconds gives us the amount
					        // of pixels we need to move the energy bar each second
					        let stepWidth = energyMask.displayWidth / (maxConfirmationWhenMissed/1000);

					        // moving the mask
					        energyMask.x -= stepWidth;

					        if(this.timeLeft < 0){
					            // You could give a change to the shortly disconnected client to go back to the session
								// However, for now I just redirect them to the questionnaire
								socket.io.opts.query = 'sessionName=already_finished';
								socket.disconnect();
								window.location.href = htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&info_share_cost='+info_share_cost+'&bonus_for_waiting='+waitingBonus+'&totalEarningInCent='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed=no_response'+'&latency='+submittedLatency;
								confirmationTimer.destroy();
								buttonContainer_confirm.visible = false;
								waitOthersText.setText('Time was up! \nYou are redirected to the questionnaire...');
								energyContainer.visible = false;
					    		energyBar.visible = false;
					    		energyMask.visible = false;
					        }
					    },
					    callbackScope: this,
					    loop: true
					});
					// =============== Count down =================================

				}.bind(this),  1 * 400);

			}
		} else if (indivOrGroup == 0 && this.didMiss == true) {
			// if missed
			setTimeout(function(){

				waitOthersText = this.add.text(16, 60, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"});
				buttonContainer_confirm.visible = true;

				//
				energyContainer.visible = true;
	    		energyBar.visible = true;

				// =============== Count down =================================
				this.timeLeft = maxConfirmationWhenMissed / 1000;
				// a boring timer.
				confirmationTimer = this.time.addEvent({
				    delay: 1000,
				    callback: function(){
				        this.timeLeft --;

				        // dividing energy bar width by the number of seconds gives us the amount
				        // of pixels we need to move the energy bar each second
				        let stepWidth = energyMask.displayWidth / (maxConfirmationWhenMissed/1000);

				        // moving the mask
				        energyMask.x -= stepWidth;

				        if(this.timeLeft < 0){
				            // You could give a change to the shortly disconnected client to go back to the session
							// However, for now I just redirect them to the questionnaire
							socket.io.opts.query = 'sessionName=already_finished';
							socket.disconnect();
							window.location.href = htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&info_share_cost='+info_share_cost+'&bonus_for_waiting='+waitingBonus+'&totalEarningInCent='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed=no_response'+'&latency='+submittedLatency;
							confirmationTimer.destroy();
							buttonContainer_confirm.visible = false;
							waitOthersText.setText('Time was up! \nYou are redirected to the questionnaire...');
							energyContainer.visible = false;
				    		energyBar.visible = false;
				    		energyMask.visible = false;
				        }
				    },
				    callbackScope: this,
				    loop: true
				});
				// =============== Count down =================================

			}.bind(this),  1 * 400);

		} else {
			waitOthersText = this.add.text(16, 60, '', { fontSize: '30px', fill: '#000', align: "center"});
			setTimeout(function(){
		    	//payoffText.destroy();
		    	//this.scene.stop('ScenePayoffFeedback');
		    	// isWaiting = false
		    	//this.scene.start('SceneMain', {gameRound:gameRound, round:currentTrial});
		    	//console.log('emitting result stage ended!');
		    	currentChoiceFlag = 0;
		    	socket.emit('result stage ended'
	    			, {share: 0
	    			, payoff: payoff
	    			, num_choice: this.flag
	    			, info_share_cost: info_share_cost
	    			// , totalEarning: (payoff - 0)
	    			// , what_produced: payoff
	    			, cost_paid: 0
	    			, thisTrial: currentTrial
	    		});
		    }.bind(this), feedbackTime * 1000); //2.5 * 1000 ms was the original
		}


	}
	update(){}
};

export default ScenePayoffFeedback;