// SceneBeforeUnderstandingTest
class SceneBeforeUnderstandingTest extends Phaser.Scene {

	constructor (){
	    	super({ key: 'SceneBeforeUnderstandingTest', active: false });
	}

	preload(){
		}

	init (data) {
		this.taskType = data.taskType;
		console.log('SceneBeforeUnderstandingTest: received taskType =', data.taskType);
	}

	create(){
		this.cameras.main.setBackgroundColor(backgroundcolour_feedback);// #d9d9d9 #ffffff

		// tutorial texts
	    let slotY_tutorial = 480//430
	    //,	socialInfoY = slotY_tutorial - 90
	    ,	payoffTextY = slotY_tutorial - 90
	    //,	trialText_tutorialY = 16+165
	    //,	groupSizeText_tutorialY = 65+165
	    ;
	    // indivOrGroup
	    let tutorialText;
	    if (indivOrGroup == 0) {
	    	tutorialText = tutorialText_indiv;
	    } else {
	    	tutorialText = tutorialText_group;
	    }
	    const tutorialTextStyle = 'background-color: rgba(51,51,51,0.1); width: 700px; height: 150px; font: 25px Arial; position: relative;';
	    // let instructionDiv = document.getElementById('instructionDiv');
	    let instructionDiv = document.createElement('div');
	    instructionDiv.style = tutorialTextStyle;
	    instructionDiv.innerHTML = '<br>The tutorial is done. <br><br>Next, you will proceed to a short quiz about the task!';

		// ========================
		// OK button
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };
		let buttonContainer_ok = this.add.container(configWidth/2, 500); //position
		let buttonImage_ok = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_ok = this.add.text(0, 0, 'Proceed to the quiz!', button_style);
		buttonText_ok.setOrigin(0.5, 0.5);
		buttonContainer_ok.add(buttonImage_ok);
		buttonContainer_ok.add(buttonText_ok);
		buttonContainer_ok.visible = true;

		// pointer over & out effects
	    buttonImage_ok.on('pointerover', function (pointer) {
	    	buttonImage_ok.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_ok.on('pointerout', function (pointer) {
	    	buttonImage_ok.clearTint();
	    }, this);

	    buttonImage_ok.on('pointerdown', function (pointer) {
	    	// proceeding to the quiz
	    	this.scene.stop('SceneBeforeUnderstandingTest');
	    	this.scene.start('SceneUnderstandingTest', { indivOrGroup: indivOrGroup, taskType: this.taskType });
	    }, this);

	    // ========================
	}

	update(){}
};

export default SceneBeforeUnderstandingTest;
