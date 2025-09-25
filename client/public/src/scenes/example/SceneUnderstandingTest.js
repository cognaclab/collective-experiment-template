// SceneUnderstandingTest

import {rand
	, isNotNegative
} from '../../functions.js';

class SceneUnderstandingTest extends Phaser.Scene {

	constructor (){
	    	super({ key: 'SceneUnderstandingTest', active: false });
	}

	preload(){
		}
	
	init (data) {
		this.taskOrder = data.taskOrder;
		this.taskType = data.taskType;
	}

	create(){
		understandingCheckStarted = 1;
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'
		
		console.log('SceneUnderstandingTest: indivOrGroup =', indivOrGroup);
		console.log('SceneUnderstandingTest: taskType =', this.taskType);

		const quiz_correct_answers_group = [3,0,0,0,1]
		,	quiz_correct_answers_indiv = [3,0,0,-1,-1]
		,	quiz_correct_answers_dynamic = [3,1,1,0,1]
		,	quiz_correct_answers_static = [3,0,1,0,1]
		;

		// indivOrGroup
	    let understandingCheckText
		;
		// console.log('firstTask == '  + firstTask);
	    // if (indivOrGroup == 0) {
	    // 	understandingCheckText = understandingCheckText_indiv;
	    // } else {
	    // 	understandingCheckText = understandingCheckText_group;
	    // }
		if (indivOrGroup === 1 && this.taskType === 'dynamic') {
			understandingCheckText = understandingCheckText_dynamic;
			console.log('Selected: understandingCheckText_dynamic, length =', understandingCheckText_dynamic.length);
		} else if (indivOrGroup === 1 && this.taskType === 'static') {
			understandingCheckText = understandingCheckText_static;
			console.log('Selected: understandingCheckText_static, length =', understandingCheckText_static.length);
		} else if (indivOrGroup === 1 && this.taskType === undefined) {
			// During tutorial phase, taskType is undefined but we're in group mode
			// Default to static questions for group mode
			understandingCheckText = understandingCheckText_static;
			console.log('Selected: understandingCheckText_static (default for undefined taskType), length =', understandingCheckText_static.length);
		} else {
			understandingCheckText = understandingCheckText_indiv;
			console.log('Selected: understandingCheckText_indiv, length =', understandingCheckText_indiv.length);
		}
	    const understandingCheckTextStyle = 'background-color: rgba(51,51,51,0.1); width: 700px; height: 60px; font: 25px Arial; position: relative;';
	    let instructionDiv = document.createElement('div');
	    instructionDiv.style = understandingCheckTextStyle;
	    instructionDiv.innerHTML = understandingCheckText[0];
	    instructionDiv.id = 'instructionDiv';
	    let instructionElement = this.add.dom(configWidth/2, 80, instructionDiv);

		//
		let buttonContainerTest = this.add.container(450, 570); //position
		let buttonImageTest = this.add.sprite(0, 0, 'button').setDisplaySize(300, 50).setInteractive({ cursor: 'pointer' });
		let buttonTextTest = this.add.text(0, 0, 'Check your answers', { fontSize: '24px', fill: '#000' });
		buttonTextTest.setOrigin(0.5, 0.5);
		buttonContainerTest.add(buttonImageTest);
		buttonContainerTest.add(buttonTextTest);
		buttonContainerTest.visible = false;

		// text
		// create a new 'div' for the instruction texts
	    const questionTextStyle = 'background-color: rgba(255,255,255,0); width: 700px; height: 30px; font: 20px Arial; position: relative;';
	    let questionDiv = []
	    ,	questionElement = []
	    ;
	    for (let i=1; i<understandingCheckText.length; i++) {
			questionDiv[i] = document.createElement('div');
			questionDiv[i].style = questionTextStyle;
	    	questionDiv[i].innerHTML = understandingCheckText[i];
	    	questionDiv[i].id = 'questionDiv'+i;
	    	if (i < 5) {
	    		questionElement[i] = this.add.dom(configWidth/2, 60+ 80*i, questionDiv[i]);
	    	} else {
	    		questionElement[i] = this.add.dom(configWidth/2, 60+ 80*4+105*(i-4), questionDiv[i]);
	    	}

		}

		/**********************************************
		//
		// Options for the understanding checks
		//
		**********************************************/
		// Question 0
		const optionButtonsA0 = []
		,	optionButtonsA0Image = []
		,	optionButtonsA0Text = []
		,	optionButtonsA0Image_active = []
		// ,	question0_options = [10,20,40,60,99]
		;
		let question0_options = [10,30,50,76,99];
		if ( this.taskType === 'dynamic') {
			question0_options = [10,30,50,76,99]
		} else if ( this.taskType === 'static') {
			question0_options = [10,30,50,76,99] //[5,10,20,30,50]
		}
		for (let i=0; i<5; i++) {
			optionButtonsA0[i] = this.add.container(80 + 60*i, 180+80*0); //position
			// optionButtonsA0Text[i] = this.add.text(0, 0, 40+20*i, { fontSize: '23px', fill: '#000' });
			optionButtonsA0Text[i] = this.add.text(0, 0, question0_options[i], { fontSize: '23px', fill: '#000' });
			optionButtonsA0Image[i] = this.add.sprite(0, 0, 'button').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
			optionButtonsA0Image_active[i] = this.add.sprite(0, 0, 'button_active').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
			optionButtonsA0Text[i].setOrigin(0.5, 0.5);
			optionButtonsA0[i].add(optionButtonsA0Image_active[i]);
			optionButtonsA0[i].add(optionButtonsA0Image[i]);
			optionButtonsA0[i].add(optionButtonsA0Text[i]);
			optionButtonsA0[i].visible = true; // it's hidden in default
			optionButtonsA0Image[i].on('pointerdown', function (pointer) {
				if (answers[0] >= 0 & answers[0] != i) {
					// remove and add other active button images
					optionButtonsA0[answers[0]].remove(optionButtonsA0Image_active[answers[0]]);
					optionButtonsA0[answers[0]].remove(optionButtonsA0Text[answers[0]]);
					optionButtonsA0[answers[0]].add(optionButtonsA0Image[answers[0]]);
					optionButtonsA0[answers[0]].add(optionButtonsA0Text[answers[0]]);
					optionButtonsA0Image_active[answers[0]].visible = false;
					optionButtonsA0Image[answers[0]].visible = true;
					// remove and add a new active image
					answers[0] = i;
					optionButtonsA0[i].remove(optionButtonsA0Image[i]);
					optionButtonsA0[i].remove(optionButtonsA0Text[i]);
					optionButtonsA0[i].add(optionButtonsA0Image_active[i]);
					optionButtonsA0[i].add(optionButtonsA0Text[i]);
					optionButtonsA0Image[i].visible = false;
					optionButtonsA0Image_active[i].visible = true;
				} else {
					answers[0] = i;
					optionButtonsA0[i].remove(optionButtonsA0Image[i]);
					optionButtonsA0[i].remove(optionButtonsA0Text[i]);
					optionButtonsA0[i].add(optionButtonsA0Image_active[i]);
					optionButtonsA0[i].add(optionButtonsA0Text[i]);
					optionButtonsA0Image[i].visible = false;
					optionButtonsA0Image_active[i].visible = true;
				}
				if ( (indivOrGroup == 0 & answers.filter(isNotNegative).length == 3) | (indivOrGroup == 1 & answers.filter(isNotNegative).length == 5)) {
					buttonContainerTest.visible = true;
				}
				//console.log('answers = ' + answers);
		    });
		    optionButtonsA0Image[i].on('pointerover', function (pointer) {
		    	optionButtonsA0Image[i].setTint(0xa9a9a9);
		    }, this);
		    optionButtonsA0Image[i].on('pointerout', function (pointer) {
		    	optionButtonsA0Image[i].clearTint();
		    }, this);
		    optionButtonsA0Image_active[i].on('pointerover', function (pointer) {
		    	optionButtonsA0Image_active[i].setTint(0xa9a9a9);
		    }, this);
		    optionButtonsA0Image_active[i].on('pointerout', function (pointer) {
		    	optionButtonsA0Image_active[i].clearTint();
		    }, this);
		}

		// Question A1
		const optionButtonsA1 = []
		,	optionButtonsA1Image = []
		,	optionButtonsA1Text = []
		,	optionButtonsA1Image_active = []
		;
		optionButtonsA1Text[0] = this.add.text(0, 0, 'YES', { fontSize: '23px', fill: '#000' });
		optionButtonsA1Text[1] = this.add.text(0, 0, 'NO', { fontSize: '23px', fill: '#000' });
		for (let i=0; i<2; i++) {
			optionButtonsA1[i] = this.add.container(180 + 100*i, 185+80*1); //position
			optionButtonsA1Image[i] = this.add.sprite(0, 0, 'button').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
			optionButtonsA1Image_active[i] = this.add.sprite(0, 0, 'button_active').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
			optionButtonsA1Text[i].setOrigin(0.5, 0.5);
			optionButtonsA1[i].add(optionButtonsA1Image_active[i]);
			optionButtonsA1[i].add(optionButtonsA1Image[i]);
			optionButtonsA1[i].add(optionButtonsA1Text[i]);
			optionButtonsA1[i].visible = true; // it's hidden in default
			optionButtonsA1Image[i].on('pointerdown', function (pointer) {
				if (answers[1] >= 0 & answers[1] != i) {
					// remove and add other active button images
					optionButtonsA1[answers[1]].remove(optionButtonsA1Image_active[answers[1]]);
					optionButtonsA1[answers[1]].remove(optionButtonsA1Text[answers[1]]);
					optionButtonsA1[answers[1]].add(optionButtonsA1Image[answers[1]]);
					optionButtonsA1[answers[1]].add(optionButtonsA1Text[answers[1]]);
					optionButtonsA1Image_active[answers[1]].visible = false;
					optionButtonsA1Image[answers[1]].visible = true;
					// remove and add a new active image
					answers[1] = i;
					optionButtonsA1[i].remove(optionButtonsA1Image[i]);
					optionButtonsA1[i].remove(optionButtonsA1Text[i]);
					optionButtonsA1[i].add(optionButtonsA1Image_active[i]);
					optionButtonsA1[i].add(optionButtonsA1Text[i]);
					optionButtonsA1Image[i].visible = false;
					optionButtonsA1Image_active[i].visible = true;
				} else {
					answers[1] = i;
					optionButtonsA1[i].remove(optionButtonsA1Image[i]);
					optionButtonsA1[i].remove(optionButtonsA1Text[i]);
					optionButtonsA1[i].add(optionButtonsA1Image_active[i]);
					optionButtonsA1[i].add(optionButtonsA1Text[i]);
					optionButtonsA1Image[i].visible = false;
					optionButtonsA1Image_active[i].visible = true;
				}
				if ( (indivOrGroup == 0 & answers.filter(isNotNegative).length == 3) | (indivOrGroup == 1 & answers.filter(isNotNegative).length == 5)) {
					buttonContainerTest.visible = true;
				}
				//console.log('answers = ' + answers);
		    });
		    optionButtonsA1Image[i].on('pointerover', function (pointer) {
		    	optionButtonsA1Image[i].setTint(0xa9a9a9);
		    }, this);
		    optionButtonsA1Image[i].on('pointerout', function (pointer) {
		    	optionButtonsA1Image[i].clearTint();
		    }, this);
		    optionButtonsA1Image_active[i].on('pointerover', function (pointer) {
		    	optionButtonsA1Image_active[i].setTint(0xa9a9a9);
		    }, this);
		    optionButtonsA1Image_active[i].on('pointerout', function (pointer) {
		    	optionButtonsA1Image_active[i].clearTint();
		    }, this);
		}

		// Question A2
		const optionButtonsA2 = []
		,	optionButtonsA2Image = []
		,	optionButtonsA2Text = []
		,	optionButtonsA2Image_active = []
		;
		optionButtonsA2Text[0] = this.add.text(0, 0, 'YES', { fontSize: '23px', fill: '#000' });
		optionButtonsA2Text[1] = this.add.text(0, 0, 'NO', { fontSize: '23px', fill: '#000' });
		for (let i=0; i<2; i++) {
			optionButtonsA2[i] = this.add.container(180 + 100*i, 185+80*2); //position
			optionButtonsA2Image[i] = this.add.sprite(0, 0, 'button').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
			optionButtonsA2Image_active[i] = this.add.sprite(0, 0, 'button_active').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
			optionButtonsA2Text[i].setOrigin(0.5, 0.5);
			optionButtonsA2[i].add(optionButtonsA2Image_active[i]);
			optionButtonsA2[i].add(optionButtonsA2Image[i]);
			optionButtonsA2[i].add(optionButtonsA2Text[i]);
			optionButtonsA2[i].visible = true; // it's hidden in default
			optionButtonsA2Image[i].on('pointerdown', function (pointer) {
				if (answers[2] >= 0 & answers[2] != i) {
					// remove and add other active button images
					optionButtonsA2[answers[2]].remove(optionButtonsA2Image_active[answers[2]]);
					optionButtonsA2[answers[2]].remove(optionButtonsA2Text[answers[2]]);
					optionButtonsA2[answers[2]].add(optionButtonsA2Image[answers[2]]);
					optionButtonsA2[answers[2]].add(optionButtonsA2Text[answers[2]]);
					optionButtonsA2Image_active[answers[2]].visible = false;
					optionButtonsA2Image[answers[2]].visible = true;
					// remove and add a new active image
					answers[2] = i;
					optionButtonsA2[i].remove(optionButtonsA2Image[i]);
					optionButtonsA2[i].remove(optionButtonsA2Text[i]);
					optionButtonsA2[i].add(optionButtonsA2Image_active[i]);
					optionButtonsA2[i].add(optionButtonsA2Text[i]);
					optionButtonsA2Image_active[i].visible = true;
					optionButtonsA2Image[i].visible = false;
				} else {
					answers[2] = i;
					optionButtonsA2[i].remove(optionButtonsA2Image[i]);
					optionButtonsA2[i].remove(optionButtonsA2Text[i]);
					optionButtonsA2[i].add(optionButtonsA2Image_active[i]);
					optionButtonsA2[i].add(optionButtonsA2Text[i]);
					optionButtonsA2Image_active[i].visible = true;
					optionButtonsA2Image[i].visible = false;
				}
				if ( (indivOrGroup == 0 & answers.filter(isNotNegative).length == 3) | (indivOrGroup == 1 & answers.filter(isNotNegative).length == 5)) {
					buttonContainerTest.visible = true;
				}
				//console.log('answers = ' + answers);
		    });
		    optionButtonsA2Image[i].on('pointerover', function (pointer) {
		    	optionButtonsA2Image[i].setTint(0xa9a9a9);
		    }, this);
		    optionButtonsA2Image[i].on('pointerout', function (pointer) {
		    	optionButtonsA2Image[i].clearTint();
		    }, this);
		    optionButtonsA2Image_active[i].on('pointerover', function (pointer) {
		    	optionButtonsA2Image_active[i].setTint(0xa9a9a9);
		    }, this);
		    optionButtonsA2Image_active[i].on('pointerout', function (pointer) {
		    	optionButtonsA2Image_active[i].clearTint();
		    }, this);
		}
		if (indivOrGroup == 1) {
			// Question A3
			const optionButtonsA3 = []
			,	optionButtonsA3Image = []
			,	optionButtonsA3Text = []
			,	optionButtonsA3Image_active = []
			;
			optionButtonsA3Text[0] = this.add.text(0, 0, 'YES', { fontSize: '23px', fill: '#000' });
			optionButtonsA3Text[1] = this.add.text(0, 0, 'NO', { fontSize: '23px', fill: '#000' });
			for (let i=0; i<2; i++) {
				optionButtonsA3[i] = this.add.container(180 + 100*i, 100+80*3 + 110); //position
				optionButtonsA3Image[i] = this.add.sprite(0, 0, 'button').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
				optionButtonsA3Image_active[i] = this.add.sprite(0, 0, 'button_active').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
				optionButtonsA3Text[i].setOrigin(0.5, 0.5);
				optionButtonsA3[i].add(optionButtonsA3Image_active[i]);
				optionButtonsA3[i].add(optionButtonsA3Image[i]);
				optionButtonsA3[i].add(optionButtonsA3Text[i]);
				optionButtonsA3[i].visible = true; // it's hidden in default
				optionButtonsA3Image[i].on('pointerdown', function (pointer) {
					if (answers[3] >= 0 & answers[3] != i) {
						// remove and add other active button images
						optionButtonsA3[answers[3]].remove(optionButtonsA3Image_active[answers[3]]);
						optionButtonsA3[answers[3]].remove(optionButtonsA3Text[answers[3]]);
						optionButtonsA3[answers[3]].add(optionButtonsA3Image[answers[3]]);
						optionButtonsA3[answers[3]].add(optionButtonsA3Text[answers[3]]);
						optionButtonsA3Image_active[answers[3]].visible = false;
						optionButtonsA3Image[answers[3]].visible = true;
						// remove and add a new active image
						answers[3] = i;
						optionButtonsA3[i].remove(optionButtonsA3Image[i]);
						optionButtonsA3[i].remove(optionButtonsA3Text[i]);
						optionButtonsA3[i].add(optionButtonsA3Image_active[i]);
						optionButtonsA3[i].add(optionButtonsA3Text[i]);
						optionButtonsA3Image_active[i].visible = true;
						optionButtonsA3Image[i].visible = false;
					} else {
						answers[3] = i;
						optionButtonsA3[i].remove(optionButtonsA3Image[i]);
						optionButtonsA3[i].remove(optionButtonsA3Text[i]);
						optionButtonsA3[i].add(optionButtonsA3Image_active[i]);
						optionButtonsA3[i].add(optionButtonsA3Text[i]);
						optionButtonsA3Image_active[i].visible = true;
						optionButtonsA3Image[i].visible = false;
					}
					if ( (indivOrGroup == 0 & answers.filter(isNotNegative).length == 3) | (indivOrGroup == 1 & answers.filter(isNotNegative).length == 5)) {
						buttonContainerTest.visible = true;
					}
					//console.log('answers = ' + answers);
			    });
			    optionButtonsA3Image[i].on('pointerover', function (pointer) {
			    	optionButtonsA3Image[i].setTint(0xa9a9a9);
			    }, this);
			    optionButtonsA3Image[i].on('pointerout', function (pointer) {
			    	optionButtonsA3Image[i].clearTint();
			    }, this);
			    optionButtonsA3Image_active[i].on('pointerover', function (pointer) {
			    	optionButtonsA3Image_active[i].setTint(0xa9a9a9);
			    }, this);
			    optionButtonsA3Image_active[i].on('pointerout', function (pointer) {
			    	optionButtonsA3Image_active[i].clearTint();
			    }, this);
			}
			// Question A4
			const optionButtonsA4 = []
			,	optionButtonsA4Image = []
			,	optionButtonsA4Text = []
			,	optionButtonsA4Image_active = []
			;
			optionButtonsA4Text[0] = this.add.text(0, 0, 'YES', { fontSize: '23px', fill: '#000' });
			optionButtonsA4Text[1] = this.add.text(0, 0, 'NO', { fontSize: '23px', fill: '#000' });
			for (let i=0; i<2; i++) {
				optionButtonsA4[i] = this.add.container(180 + 100*i, 100+80*3 + 190); //position
				optionButtonsA4Image[i] = this.add.sprite(0, 0, 'button').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
				optionButtonsA4Image_active[i] = this.add.sprite(0, 0, 'button_active').setDisplaySize(50, 30).setInteractive({ cursor: 'pointer' });
				optionButtonsA4Text[i].setOrigin(0.5, 0.5);
				optionButtonsA4[i].add(optionButtonsA4Image_active[i]);
				optionButtonsA4[i].add(optionButtonsA4Image[i]);
				optionButtonsA4[i].add(optionButtonsA4Text[i]);
				optionButtonsA4[i].visible = true; // it's hidden in default
				optionButtonsA4Image[i].on('pointerdown', function (pointer) {
					if (answers[4] >= 0 & answers[4] != i) {
						// remove and add other active button images
						optionButtonsA4[answers[4]].remove(optionButtonsA4Image_active[answers[4]]);
						optionButtonsA4[answers[4]].remove(optionButtonsA4Text[answers[4]]);
						optionButtonsA4[answers[4]].add(optionButtonsA4Image[answers[4]]);
						optionButtonsA4[answers[4]].add(optionButtonsA4Text[answers[4]]);
						optionButtonsA4Image_active[answers[4]].visible = false;
						optionButtonsA4Image[answers[4]].visible = true;
						// remove and add a new active image
						answers[4] = i;
						optionButtonsA4[i].remove(optionButtonsA4Image[i]);
						optionButtonsA4[i].remove(optionButtonsA4Text[i]);
						optionButtonsA4[i].add(optionButtonsA4Image_active[i]);
						optionButtonsA4[i].add(optionButtonsA4Text[i]);
						optionButtonsA4Image_active[i].visible = true;
						optionButtonsA4Image[i].visible = false;
					} else {
						answers[4] = i;
						optionButtonsA4[i].remove(optionButtonsA4Image[i]);
						optionButtonsA4[i].remove(optionButtonsA4Text[i]);
						optionButtonsA4[i].add(optionButtonsA4Image_active[i]);
						optionButtonsA4[i].add(optionButtonsA4Text[i]);
						optionButtonsA4Image_active[i].visible = true;
						optionButtonsA4Image[i].visible = false;
					}
					if ( (indivOrGroup == 0 & answers.filter(isNotNegative).length == 3) | (indivOrGroup == 1 & answers.filter(isNotNegative).length == 5)) {
						buttonContainerTest.visible = true;
					}
					//console.log('answers = ' + answers);
			    });
			    optionButtonsA4Image[i].on('pointerover', function (pointer) {
			    	optionButtonsA4Image[i].setTint(0xa9a9a9);
			    }, this);
			    optionButtonsA4Image[i].on('pointerout', function (pointer) {
			    	optionButtonsA4Image[i].clearTint();
			    }, this);
			    optionButtonsA4Image_active[i].on('pointerover', function (pointer) {
			    	optionButtonsA4Image_active[i].setTint(0xa9a9a9);
			    }, this);
			    optionButtonsA4Image_active[i].on('pointerout', function (pointer) {
			    	optionButtonsA4Image_active[i].clearTint();
			    }, this);
			}
		}
		/**********************************************
		//
		// END -- Options for the understanding checks
		//
		**********************************************/

		// click event
	    buttonImageTest.on('pointerdown', function (pointer) {
	    	instructionDiv.style = 'background-color: rgba(0,0,0,0)';
	    	instructionDiv.innerHTML = '';
	    	for (let i=1; i<understandingCheckText.length; i++) {
				questionDiv[i].innerHTML = '';
			}
			for (let i=0; i<5; i++) {
				optionButtonsA0[i].destroy();
			}
			for (let i=0; i<2; i++) {
				optionButtonsA1[i].destroy();
			}
			for (let i=0; i<2; i++) {
				optionButtonsA2[i].destroy();
			}
	    	
	    	if (indivOrGroup == 0) {
	    		if (JSON.stringify(answers) == JSON.stringify(quiz_correct_answers_indiv)) {
	    			// Turn the whole UI off but keep it around
					buttonContainerTest.setVisible(false);
					buttonContainerTest.list.forEach(child => child.disableInteractive());
	    			this.scene.launch('ScenePerfect');
	    		} else {
	    			incorrectCount++;
	    			// console.log('incorrectCount = '+incorrectCount);
	    			isInstructionRevisit = true;
	    			instructionPosition = 0;
	    			if (incorrectCount<4) {
		    			// When you want to go back to previous scene,
		    			// you have to 'stop' scenes which are above the target scene
		    			// Otherwise, objects defined in those above scenes would hid the target scene
		    			this.scene.stop('SceneUnderstandingTest');
		    			this.scene.stop('SceneTutorialFeedback');
		    			this.scene.stop('SceneTutorial');
		    			this.scene.start('SceneInstruction', {indivOrGroup:indivOrGroup, taskOrder:this.taskOrder, taskType: this.taskType});
		    		} else {
		    			// completed = 'droppedTestScene';
		    			// window.location.href = htmlServer + portnumQuestionnaire +'/questionnaireForDisconnectedSubjects?subjectID='+subjectID+'&bonus_for_waiting='+waitingBonus+'&totalEarningInCent='+Math.round((totalPayoff_perIndiv*cent_per_point))+'&confirmationID='+confirmationID+'&exp_condition='+exp_condition+'&indivOrGroup='+indivOrGroup+'&completed='+'droppedTestScene'+'&latency='+submittedLatency;
						$("#subjectID").val(subjectID);
						$("#currentTrial").val(currentTrial);
						$("#gameRound").val(gameRound);
						$("#indivOrGroup").val(indivOrGroup);
						$("#bonus_for_waiting").val(Math.round(waitingBonus));
						$("#completed").val("droppedTestScene");
						$("#form").submit();
						socket.disconnect();
		    		}
	    		}
	    	} else { // group condition
	    		if ( this.taskType === 'dynamic' && JSON.stringify(answers) === JSON.stringify(quiz_correct_answers_dynamic)) {
	    			//socket.emit('test passed');
	    			// Turn the whole UI off but keep it around
					buttonContainerTest.setVisible(false);
					buttonContainerTest.list.forEach(child => child.disableInteractive());
	    			this.scene.launch('ScenePerfect');
	    		} else if ( this.taskType === 'static' && JSON.stringify(answers) === JSON.stringify(quiz_correct_answers_static)) {
	    			//socket.emit('test passed');
	    			// Turn the whole UI off but keep it around
					buttonContainerTest.setVisible(false);
					buttonContainerTest.list.forEach(child => child.disableInteractive());
	    			this.scene.launch('ScenePerfect');
	    		} else {
	    			incorrectCount++;
	    			isInstructionRevisit = true;
	    			instructionPosition = 0;
	    			if (incorrectCount<4) {
		    			this.scene.stop('SceneUnderstandingTest');
		    			this.scene.stop('SceneTutorialFeedback');
		    			this.scene.stop('SceneTutorial');
		    			this.scene.start('SceneInstruction', {indivOrGroup:indivOrGroup, taskOrder:this.taskOrder, taskType: this.taskType});
		    		} else {
		    			$("#subjectID").val(subjectID);
						$("#currentTrial").val(currentTrial);
						$("#gameRound").val(gameRound);
						$("#indivOrGroup").val(indivOrGroup);
						$("#bonus_for_waiting").val(Math.round(waitingBonus));
						$("#completed").val("droppedTestScene");
						$("#form").submit();
						socket.disconnect();
		    		}
	    		}
	    	}
			buttonContainerTest.destroy();
	    	//socket.emit('test passed');
	    }, this);

	    // pointer over & out effects
	    buttonImageTest.on('pointerover', function (pointer) {
	    	buttonImageTest.setTint(0xa9a9a9);
	    }, this);
	    buttonImageTest.on('pointerout', function (pointer) {
	    	buttonImageTest.clearTint();
	    }, this);
	}

	update(){}
};

export default SceneUnderstandingTest;
