// SceneTutorial

// import {rand
// 	, showStars_4ab
// } from '../../functions.js';

class SceneTutorial extends Phaser.Scene {

	constructor (){
	    	super({ key: 'SceneTutorial', active: false });
	}

	preload(){}

	init (data) {
		this.exp_condition = data.exp_condition;
		this.tutorialPosition = data.tutorialPosition; // default = 0
		this.socialInfo = data.socialInfo
		this.myPreviousCohice = data.myChoice
		this.taskOrder = data.taskOrder
		this.taskType = data.taskType
	}

	create(){
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'

	    // tutorial texts
	    tutorialPosition = this.tutorialPosition;
	    // indivOrGroup
	    let tutorialText;
	    if (indivOrGroup == 0) {
	    	tutorialText = tutorialText_indiv;
	    } else {
	    	tutorialText = tutorialText_group;
	    }

	    const tutorialTextStyle = 'background-color: rgba(51,51,51,0.1); width: 700px; height: 150px; font: 25px Arial; position: relative;';
	    // let tutorialDiv = document.getElementById('tutorialDiv');
	    let tutorialDiv = document.createElement('div');
	    tutorialDiv.style = tutorialTextStyle;
	    tutorialDiv.innerHTML = tutorialText[tutorialPosition];
	    tutorialDiv.id = 'tutorialDiv';
	    // Add the div
	    let tutorialElement = this.add.dom(configWidth/2, 100, tutorialDiv);

	    // slot machines and goToTest button
	    let tutorialFlag = 0;
	    //let objects = {};
	    let slotY_tutorial = 480
	    ,	socialInfoY = slotY_tutorial - 90
	    ,	payoffTextY = slotY_tutorial + 100
	    ,	trialText_tutorialY = 16+165
	    ,	groupSizeText_tutorialY = 56+165
	    ,	energyBar_tutorialY = 96+165
	    ;


	    // slot machines
	    this.options = {}
	    for (let i=1; i<numOptions+1; i++) {
	    	this.options['box'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_tutorial, 'machine'+i+'_normal');
	    	this.options['box_active'+i] = this.add.sprite(option1_positionX+space_between_boxes*(i-1), slotY_tutorial, 'machine'+i+'_active');
	    	this.options['box'+i].setDisplaySize(optionWidth, optionHeight);
	    	this.options['box_active'+i].setDisplaySize(optionWidth, optionHeight);
	    	this.options['box_active'+i].visible = false;
	    	if ((indivOrGroup === 1 && tutorialTrial < 4)||(indivOrGroup === 0 && tutorialTrial < 3)) {
				this.options['box'+i].setInteractive({ cursor: 'pointer' });
				this.options['box_active'+i].setInteractive({ cursor: 'pointer' });
			}
	    }

		// text
		trialText_tutorial = this.add.text(16, trialText_tutorialY, 'Tutorial trial: ' + tutorialTrial + ' / 4', { fontSize: '25px', fill: '#000' });
		if (indivOrGroup == 1) {
	    	groupSizeText_tutorial = this.add.text(16, groupSizeText_tutorialY, 'Number of players: 5', { fontSize: '25px', fill: '#000' });
		} else {
			groupSizeText_tutorial = this.add.text(16, groupSizeText_tutorialY, 'Number of players: 1', { fontSize: '25px', fill: '#000' });
		}
	    timeText_tutorial = this.add.text(16, energyBar_tutorialY, 'Remaining time: ', { fontSize: '25px', fill: '#000' });
	    payoffText = this.add.text(missPositionX, payoffTextY, ``, { fontSize: '25px', fill: noteColor }).setOrigin(0.5, 0.5);
	    // if (tutorialTrial == 1) {
	    // 	payoffText.visible = false;
	    // } else if (tutorialTrial == 2) {
	    // 	if (choice_tutorial == 1) payoffText.x = option1_positionX;
	    // 	if (choice_tutorial == 2) payoffText.x = option1_positionX + space_between_boxes * 1;
	    // 	if (choice_tutorial == 3) payoffText.x = option1_positionX + space_between_boxes * 2;
	    // 	if (choice_tutorial == 4) payoffText.x = option1_positionX + space_between_boxes * 3;
	    // 	payoffText.setText('You got 30')
	    // } else if (tutorialTrial == 3) {
	    // 	if (choice_tutorial == 1) payoffText.x = option1_positionX;
	    // 	if (choice_tutorial == 2) payoffText.x = option1_positionX + space_between_boxes * 1;
	    // 	if (choice_tutorial == 3) payoffText.x = option1_positionX + space_between_boxes * 2;
	    // 	if (choice_tutorial == 4) payoffText.x = option1_positionX + space_between_boxes * 3;
	    // 	payoffText.setText('You got 50')
	    // }
	    payoffText.visible = false;

		// confirmation text
		let confirmationContainer = this.add.container(175, slotY_tutorial+20);
		let confirmationImage = this.add.sprite(0, 0, 'button').setDisplaySize(160,100).setAlpha(0.7);
		let confirmationText = this.add.text(0, 0, `Click again\nto confirm \nyour choice`, { fontSize: '20px', fill: '#000' }).setOrigin(0.5, 0.5);
		confirmationContainer.add(confirmationImage);
		confirmationContainer.add(confirmationText);
		confirmationContainer.visible = false; // it's hidden in default

		// ===== A looking-good timer ==============
		// the energy container. A simple sprite
		let energyContainer = this.add.sprite(350, energyBar_tutorialY+15, 'energycontainer');
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
    	// ==== A looking-good timer ==========

		// click event if tutorialTrial < 3
		if ((indivOrGroup === 1 && tutorialTrial === 4) || (indivOrGroup === 0 && tutorialTrial === 3)) {
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
	                if(this.timeLeft < 0){
	                    // this.scene.start("PlayGame")
	                    tutorialPosition++;
						tutorialDiv.innerHTML = tutorialText[tutorialPosition];
						// this.scene.start('SceneTutorialFeedback', { indivOrGroup: indivOrGroup
						// 	, choice: -1
						// 	, taskOrder: this.taskOrder
						// 	, tutorialPosition: tutorialPosition });
						this.scene.start('SceneTutorialAskStillThere', { indivOrGroup: indivOrGroup
							, choice: -1
							, taskOrder: this.taskOrder
							, taskType: this.taskType
							, tutorialPosition: tutorialPosition });
						gameTimer.destroy();
	                }
	            },
	            callbackScope: this,
	            loop: true
	        }, this);
		} else if ((indivOrGroup === 1 && tutorialTrial < 4)||(indivOrGroup === 0 && tutorialTrial < 3)) {

			for (let i = 1; i < numOptions+1; i++) {
				this.options['box'+i].on('pointerdown', function (pointer) {
					confirmationContainer.x = option1_positionX + space_between_boxes*(i-1);
					confirmationContainer.visible = true;
					this.options['box'+i].visible = false;
					this.options['box_active'+i].visible = true;
			    	tutorialFlag = i;
			    	for (let j = 1; j < numOptions+1; j++) {
						if(tutorialFlag > 0 & tutorialFlag != j) {
							this.options['box_active'+j].visible = false;
							this.options['box'+j].visible = true;
						}
					}
			    }, this);
			    this.options['box_active'+i].on('pointerdown', function (pointer) {
			    	for (let m = 1; m < numOptions+1; m++) this.options['box'+m].visible = false;
		    		this.options['box_active'+i].visible = false;

		    		confirmationContainer.visible = false;
		    		energyContainer.visible = false;
		    		energyBar.visible = false;
		    		energyMask.vsible = false;
		    		if (tutorialPosition == 0) {
		    			score_tutorial += 30
		    		} else {
		    			score_tutorial += 50
		    		}
		    		tutorialPosition++;
			    	tutorialDiv.innerHTML = tutorialText[tutorialPosition];
			    	tutorialFlag = 0;
			    	if (tutorialPosition < tutorialText.length) {
			    		choice_tutorial = i;
			    		//this.scene.stop('SceneTutorial');
			    		this.scene.start('SceneTutorialFeedback', { indivOrGroup: indivOrGroup, choice: i, tutorialPosition: tutorialPosition, taskOrder: this.taskOrder, taskType: this.taskType});
			    		this.scene.stop('SceneTutorial');
			    	} else {
			    		this.scene.start('SceneUnderstandingTest', { indivOrGroup: indivOrGroup, taskOrder: this.taskOrder, taskType: this.taskType });
			    	}
			    }, this);
			}

		} else { // the final trial (i.e. the transition to the understanding quiz)
			for (let m = 1; m < numOptions+1; m++) this.options['box'+m].visible = false;
	    	trialText_tutorial.visible = false;
	    	groupSizeText_tutorial.visible = false;
	    	timeText_tutorial.visible = false;
	    	energyContainer.visible = false;
	    	energyBar.visible = false;
			let buttonContainerTutorial = this.add.container(400, 500);
			let buttonImageTutorial = this.add.sprite(0, 0, 'button').setDisplaySize(300,150).setInteractive({ cursor: 'pointer' });
			let buttonTextTutorial = this.add.text(0, 0, 'Go to the quiz', { fontSize: '28px', fill: '#000' });
			buttonTextTutorial.setOrigin(0.5, 0.5);
			buttonContainerTutorial.add(buttonImageTutorial);
			buttonContainerTutorial.add(buttonTextTutorial);
			//buttonContainerTutorial.visible = true; // it's hidden in default

			// click event
		    buttonImageTutorial.on('pointerdown', function (pointer) {
		    	buttonImageTutorial.visible = false;
		    	this.scene.start('SceneUnderstandingTest', { indivOrGroup: indivOrGroup, taskOrder: this.taskOrder, taskType: this.taskType });
		    }, this);

		    // pointer over & out effects
		    buttonImageTutorial.on('pointerover', function (pointer) {
		    	buttonImageTutorial.setTint(0xa9a9a9);
		    }, this);
		    buttonImageTutorial.on('pointerout', function (pointer) {
		    	buttonImageTutorial.clearTint();
		    }, this);
		}

		if (typeof this.options != 'undefined') {
		    // pointer over & out effects
		    for (let i = 1; i < numOptions+1; i++) {
		    	this.options['box'+i].on('pointerover', function (pointer) {
			    	this.options['box'+i].setTint(0xb8860b); //B8860B ff0000
			    }, this);
			    this.options['box'+i].on('pointerout', function (pointer) {
			    	this.options['box'+i].clearTint();
			    }, this);
		    }
		}

		// social information
	    let socialFreqNumbers = {}
	    ,	numberOfPreviousChoice = [0,0,0,0]
		,	tutorialChoiceFlag = -1
	    ;
	    if (indivOrGroup == 1 & tutorialTrial == 1) {
	    	// for (let i = 1; i < numOptions+1; i++) {
	    	// 	socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), socialInfoY, ``, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
	    	// 	socialFreqNumbers['option'+i].visible = false;
	    	// 	numberOfPreviousChoice[i-1] = 0;
	    	// }

		} else if (indivOrGroup == 1 & tutorialTrial == 2) {
		    // socialFreqNumbers.option1 = this.add.text(option1_positionX+space_between_boxes*0, socialInfoY, ``, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
		    // socialFreqNumbers.option2 = this.add.text(option1_positionX+space_between_boxes*1, socialInfoY, `200`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
		    // // function.call(what_is_this, ...) method can specify what you mean by "this" in the function
		    // showStars_4ab.call(this, numberOfPreviousChoice[0], numberOfPreviousChoice[1], numberOfPreviousChoice[2], numberOfPreviousChoice[3], socialInfoY, tutorialChoiceFlag-1);
		} else if (indivOrGroup == 1 & tutorialTrial == 3) {
		    // socialFreqNumbers.option1 = this.add.text(option1_positionX+space_between_boxes*0, socialInfoY, ``, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
		    // socialFreqNumbers.option2 = this.add.text(option1_positionX+space_between_boxes*1, socialInfoY, ``, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);

		} else if (tutorialTrial != 4) {
			// for (let i = 1; i < numOptions+1; i++) {
	  //   		socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), socialInfoY, `You chose this`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
	  //   		if (choice_tutorial == i) {
	  //   			socialFreqNumbers['option'+i].visible = true;
	  //   			numberOfPreviousChoice[i-1] = 1;
	  //   		} else {
	  //   			socialFreqNumbers['option'+i].visible = false;
	  //   			numberOfPreviousChoice[i-1] = 0;
	  //   		}
	  //   	}

		} else {
			// for (let i = 1; i < numOptions+1; i++) {
	  //   		socialFreqNumbers['option'+i] = this.add.text(option1_positionX + space_between_boxes*(i-1), socialInfoY, `You chose this`, { fontSize: '25px', fill: noteColor }).setOrigin(0.5,0.5);
	  //   		socialFreqNumbers['option'+i].visible = false;
	  //   		numberOfPreviousChoice[i-1] = 0;
	  //   	}

		}

		// the shadowed boxes to hide slots
	    let shadow1 = this.add.image(400, slotY_tutorial - 30, 'blackbox' ).setDisplaySize(780, 310)
	    ,	shadow2 = this.add.image(400, groupSizeText_tutorialY - 10, 'blackbox' ).setDisplaySize(780, 90)
	    ;
	    if ((indivOrGroup === 1 && tutorialTrial === 4) || (indivOrGroup === 0 && tutorialTrial === 3)) {
	    	shadow1.visible = true;
			shadow2.visible = true;
		} else {
			shadow1.visible = false;
			shadow2.visible = false;
		}

	}

	update(){}
};
export default SceneTutorial;
