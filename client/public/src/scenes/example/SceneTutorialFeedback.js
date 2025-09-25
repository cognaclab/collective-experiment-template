// SceneTutorialFeedback

import {
	showStars_4ab
} from '../../functions.js';

class SceneTutorialFeedback extends Phaser.Scene {

	constructor (){
	    	super({ key: 'SceneTutorialFeedback', active: false });
	}

	preload(){
		}

	init (data) {
		this.choice = data.choice;
		this.tutorialPosition = data.tutorialPosition;
		this.taskOrder = data.taskOrder;
		this.taskType = data.taskType;
		console.log('SceneTutorialFeedback: received taskType =', data.taskType);
	}

	create(){
		// console.log('SceneTutorialFeedback started: choice = ' + this.choice +' and position = ' + this.tutorialPosition);
		// destroy previous texts
		// trialText_tutorial.destroy();
		// groupSizeText_tutorial.destroy();
		// timeText_tutorial.destroy();
		// background colour
		this.cameras.main.setBackgroundColor(backgroundcolour_feedback);// #d9d9d9 #ffffff

		// tutorial texts
	    let tutorialPosition = this.tutorialPosition;
	    let slotY_tutorial = 480//430
	    ,	socialInfoY = slotY_tutorial - 90
	    ,	payoffTextY = slotY_tutorial - 90
	    ,	trialText_tutorialY = 16+165
	    ,	groupSizeText_tutorialY = 65+165
		,	objects_resultStage = {}
		,	slotY_main = 400
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
	    if (tutorialTrial < 4) {
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

		//  Texts
		// objects_feedbackStage = {};
		// for (let i = 1; i < numOptions+1; i++) {
		// 	objects_feedbackStage['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_tutorial, 'machine'+i+'_active').setDisplaySize(optionWidth, optionHeight);
		// 	objects_feedbackStage['box'+i].visible = false;
		// }


		// stars
		let demoSocialInfo;
		if (indivOrGroup === 1) {
			demoSocialInfo = [[0,0,0,0],[0,3,1,0],[2,2,0,0],[1,0,1,0],[0,1,0,0]];
			demoSocialInfo[tutorialTrial][this.choice-1]++; // adding this guy's choice
			showStars_4ab.call(this, demoSocialInfo[tutorialTrial][0],demoSocialInfo[tutorialTrial][1],demoSocialInfo[tutorialTrial][2],demoSocialInfo[tutorialTrial][3], slotY_tutorial-90, this.choice-1);
		} else {
			demoSocialInfo = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
			demoSocialInfo[tutorialTrial][this.choice-1]++; // adding this guy's choice
			showStars_4ab.call(this, demoSocialInfo[tutorialTrial][0],demoSocialInfo[tutorialTrial][1],demoSocialInfo[tutorialTrial][2],demoSocialInfo[tutorialTrial][3], slotY_tutorial-90, this.choice-1);
		}

		// bandit objects
		for (let i=1; i<numOptions+1; i++) {
			objects_resultStage['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_tutorial, 'machine'+(i)+'_active').setDisplaySize(optionWidth, optionHeight);
			objects_resultStage['box'+i].visible = true;
		}

		// social information
	    let socialFreqNumbers = {};
	    if (indivOrGroup == 1) {
	    	for (let i = 1; i < numOptions+1; i++) {
				if(demoSocialInfo[tutorialTrial][i-1]!=1) {
					socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_tutorial-80, `${demoSocialInfo[tutorialTrial][i-1]} people`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
				} else {
					socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), slotY_tutorial-80, `1 person`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
				}
	    	}
	    } 

		
		// Next button
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };
		let buttonContainer_yes = this.add.container(configWidth/2, 290); //position
		let buttonImage_yes = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_yes = this.add.text(0, 0, 'Next', button_style);
		// if(tutorialTrial > 1) {
		// 	buttonText_yes.setText('YES\n(cost: '+20+' points)');
		// }
		buttonText_yes.setOrigin(0.5, 0.5);
		buttonContainer_yes.add(buttonImage_yes);
		buttonContainer_yes.add(buttonText_yes);
		buttonContainer_yes.visible = false;

		// NO button
		// let buttonContainer_no = this.add.container(600, 310); //position
		// let buttonImage_no;
		// let buttonText_no = this.add.text(0, 0, 'NO\n(No cost)', button_style);
		// if (tutorialTrial > 1) {
		// 	buttonImage_no = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		// } else {
		// 	buttonImage_no = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100);
		// }
		// buttonText_no.setOrigin(0.5, 0.5);
		// buttonContainer_no.add(buttonImage_no);
		// buttonContainer_no.add(buttonText_no);
		// buttonContainer_no.visible = false;

		// Conformation and Next page button
		let buttonContainerTutorial = this.add.container(400, 500);
		let buttonImageTutorial = this.add.sprite(0, 0, 'button').setDisplaySize(300,150).setInteractive({ cursor: 'pointer' });
		let buttonTextTutorial = this.add.text(0, 0, 'Yes, I am!', { fontSize: '28px', fill: '#000' });
		buttonTextTutorial.setOrigin(0.5, 0.5);
		buttonContainerTutorial.add(buttonImageTutorial);
		buttonContainerTutorial.add(buttonTextTutorial);
		buttonContainerTutorial.visible = false;

		// Pointing finger
		let pointing_finger = this.physics.add.image(configWidth/2, 340, 'pointing_finger').setDisplaySize(60, 60);
		pointing_finger.body.allowGravity = false;
		pointing_finger.body.immovable = true;
		pointing_finger.body.moves = false;
		pointing_finger.visible = false;
		this.tweens.add({
			targets: pointing_finger,
			// x: 200,
			y: 320,
			duration: 300,
			ease: 'Sine.easeInOut',
			repeat: -1,
			yoyo: true
		});

		// pointer over & out effects
	    buttonImage_yes.on('pointerover', function (pointer) {
	    	buttonImage_yes.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_yes.on('pointerout', function (pointer) {
	    	buttonImage_yes.clearTint();
	    }, this);

	    buttonImage_yes.on('pointerdown', function (pointer) {
	    	// going back to the tutorial
	    	let updatedTutorialPosition = tutorialPosition + 1;
	    	tutorialTrial++;
			this.scene.start('SceneTutorial', { 
				indivOrGroup: indivOrGroup
				, exp_condition: exp_condition
				, tutorialPosition: updatedTutorialPosition
				, socialInfo: demoSocialInfo[tutorialTrial]
				, myChoice: currentChoiceFlag
				, taskType: this.taskType
				, taskOrder: this.taskOrder
			});
	    	this.scene.stop('SceneTutorialFeedback');
	    	// if (tutorialTrial == 2) {
	    	// 	this.scene.start('SceneTutorialSharingCostExplained', { tutorialPosition: updatedTutorialPosition });
	    	// 	this.scene.sleep('SceneTutorialFeedback');
	    	// } else {
	    	// 	this.scene.start('SceneTutorial', { indivOrGroup: indivOrGroup, exp_condition: exp_condition,tutorialPosition: updatedTutorialPosition });
	    	// 	this.scene.sleep('SceneTutorialFeedback');
	    	// }
	    }, this);

	    // In the first tutorial-trial, participants have to choose "yes" button
	    // so the following tint function should be inactive on that trial
	    // if (tutorialTrial != 1) {
		//     buttonImage_no.on('pointerover', function (pointer) {
		//     	buttonImage_no.setTint(0xa9a9a9);
		//     }, this);
		//     buttonImage_no.on('pointerout', function (pointer) {
		//     	buttonImage_no.clearTint();
		//     }, this);
		//     buttonImage_no.on('pointerdown', function (pointer) {
		//     	// going back to the tutorial
		//     	let updatedTutorialPosition = tutorialPosition + 1;
		//     	tutorialTrial++;
		//     	this.scene.sleep('SceneTutorialFeedback');
		//     	this.scene.start('SceneTutorial', { indivOrGroup: indivOrGroup, exp_condition: exp_condition,tutorialPosition: updatedTutorialPosition, taskOrder: this.taskOrder });
		//     }, this);
		// }

		// click event
		buttonImageTutorial.on('pointerdown', function (pointer) {
			buttonImageTutorial.visible = false;
			//this.scene.start('SceneUnderstandingTest', { indivOrGroup: indivOrGroup });
			this.scene.start('SceneBeforeUnderstandingTest', { indivOrGroup: indivOrGroup , taskType: this.taskType});
			this.scene.stop('SceneTutorialFeedback');
		}, this);

		// pointer over & out effects
		buttonImageTutorial.on('pointerover', function (pointer) {
			buttonImageTutorial.setTint(0xa9a9a9);
		}, this);
		buttonImageTutorial.on('pointerout', function (pointer) {
			buttonImageTutorial.clearTint();
		}, this);

	    // ========================

		if (this.choice == -1) {
			feedbackTextPosition = missPositionX;

		} else if (this.choice == 1) {
			// objects_feedbackStage.box1.visible = true;
			feedbackTextPosition = option1_positionX + space_between_boxes*0;

		} else if (this.choice == 2) {
			// objects_feedbackStage.box2.visible = true;
			feedbackTextPosition = option1_positionX + space_between_boxes*1;

		} else if (this.choice == 3) {
			// objects_feedbackStage.box3.visible = true;
			feedbackTextPosition = option1_positionX + space_between_boxes*2;

		} else if (this.choice == 4) {
			// objects_feedbackStage.box4.visible = true;
			feedbackTextPosition = option1_positionX + space_between_boxes*3;
		}

		//let tutorialPayoff;
		// Tutorial team payoff demo
		switch (tutorialTrial) {
            // case 1:
            //     payoffText = this.add.text(feedbackTextPosition, payoffTextY, `100 points!`, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
            //     break;
            // case 2:
            //     payoffText = this.add.text(feedbackTextPosition, payoffTextY, `150 points!`, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
            //     break;
            // case 3:
            //     payoffText = this.add.text(feedbackTextPosition, payoffTextY, `Missed!`, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
            //     break;
            default:
                payoffText = this.add.text(feedbackTextPosition, payoffTextY, ``, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
                break;
        }

        if (indivOrGroup == 1 ) {
        	// ==== group condition ===
		    switch (tutorialTrial) {
				case 1:
					waitOthersText = this.add.text(configWidth/2, 190, 'Your team got 200 points!', { fontSize: '30px', fill: noteColor, align: "center", fontstyle: 'bold'}).setOrigin(0.5, 0.5);
					break;
				case 2:
					payoffText = this.add.text(configWidth/2, 190, 'Your team got 300 points!', { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
					break;
				case 3:
					payoffText = this.add.text(configWidth/2, 190, 'Your team got 100 points!', { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
					break;
				case 4:
					payoffText = this.add.text(configWidth/2, 190, 'Two people missed the trial: \nYour team got 0 points!', { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
					break;
				default:
					payoffText = this.add.text(configWidth/2, 190, ``, { fontSize: '30px', fill: noteColor, fontstyle: 'bold' }).setOrigin(0.5, 0.5);
					break;
			}
			setTimeout(function(){
				buttonContainer_yes.visible = true;
				if (tutorialTrial == 1) pointing_finger.visible = true;
			}.bind(this), 1000);
		    // ========================
		} else {
			// === individual condition ===
			waitOthersText = this.add.text(16, 170, '', { fontSize: '30px', fill: '#000', align: "center"});
			if (tutorialTrial < 3) {
				setTimeout(function(){
					let updatedTutorialPosition = tutorialPosition + 1;
		    		tutorialTrial++;
		    		this.scene.stop('SceneTutorialFeedback');
		    		this.scene.start('SceneTutorial', { 
						indivOrGroup: indivOrGroup
						, exp_condition: exp_condition
						,tutorialPosition: updatedTutorialPosition
						, taskOrder: this.taskOrder
						, taskType: this.taskType });
				}.bind(this), feedbackTime * 1000);
			} else {
				setTimeout(function(){
					waitOthersText = this.add.text(16, 270, 'You\'ve missed this round!\nAre you still there?', { fontSize: '30px', fill: '#000', align: "center"});
					buttonContainerTutorial.visible = true;
				}.bind(this), 1000);
			}
			// ===========================
		}


	}

	update(){}
};

export default SceneTutorialFeedback;