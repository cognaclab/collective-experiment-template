// SceneNextRoundsInstruction
class SceneNextRoundsInstruction extends Phaser.Scene {

	constructor () {
	    super({ key: 'SceneNextRoundsInstruction', active: false });
	}

	preload () {
	}

	init (data) {
		this.taskType = data.whatsNext;
		this.groupPayoffLastRound = data.groupPayoffThisRound;
		this.horizon = data.horiozn;
		this.gameRound = data.gameRound;
	}

	create () {
		// console.log('whatsNext = '+ this.taskType);
		// console.log('groupPayoffLastRound = '+ this.groupPayoffLastRound);
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'

		// initialise
		mySocialInfoList = {option1:0, option2:0, option3:0, option4:0};


	    // Instruction length
	    let instructionLength
		, transitionTextPosition = 0
		, instructionText
		;
	    // create a new 'div' for the instruction texts
	    const instructionTextStyle = 'background-color: rgba(51,51,51,0.1); width: 700px; height: 400px; font: 25px Arial;';
	    let transitionDiv = document.createElement('div');
	    transitionDiv.style = instructionTextStyle;

	    if (this.taskType === 'dynamic') {
			instructionLength = transitionText_staticToDynamic.length;
			instructionText = transitionText_staticToDynamic;
	    	transitionDiv.innerHTML = instructionText[transitionTextPosition];
	    } else {
			instructionLength = transitionText_dynamicToStatic.length;
			// instructionText = transitionText_dynamicToStatic;
			instructionText = transitionText_static[this.gameRound-1];
	    	transitionDiv.innerHTML = instructionText[transitionTextPosition];
	    }
	    transitionDiv.id = 'transitionDiv';
	    // Add the div
	    let instructionElement = this.add.dom(configWidth/2, 220, transitionDiv);

	    // instruction Picture
	    // let currentInstructionPicture = [];
	    // if (this.indivOrGroup == 0) {
	    // 	for (let i=0; i<7; i++) {
		//     	currentInstructionPicture[i] = this.add.image(configWidth/2, configHeight/2, 'instructionPictures_indiv_'+i ).setDisplaySize((1024/3)*1.3, (768/3)*1.3);
		//     	currentInstructionPicture[i].visible = false;
		//     }
	    // } else {
	    // 	for (let i=0; i<14; i++) {
	    // 		if (i != 12 & i != 8) {
		//     		currentInstructionPicture[i] = this.add.image(configWidth/2, configHeight/2 - 20, 'instructionPictures_group_'+i ).setDisplaySize((1024/3)*1.4, (768/3)*1.4);
		//     	} else if (i == 8) {
		//     		currentInstructionPicture[i] = this.add.image(configWidth/2, configHeight/2, 'instructionPictures_group_'+i ).setDisplaySize((1024/3)*1.31, (768/3)*1.31);
	    // 		} else if (i == 12) {
		//     		currentInstructionPicture[i] = this.add.image(configWidth/2, configHeight/2 + 10, 'instructionPictures_group_'+i ).setDisplaySize((1024/3)*1.31, (768/3)*1.31);
		//     	}
		//     	currentInstructionPicture[i].visible = false;
		//     }
	    // }


	    // next button
	    this.nextButtonContainer = this.add.container(550, 520);
		let nextButtonImage = this.add.sprite(0, 0, 'button').setDisplaySize(200,150).setInteractive({ cursor: 'pointer' });
		let nextButtonText = this.add.text(0, 0, 'Next', { fontSize: '32px', fill: '#000' });
		nextButtonText.setOrigin(0.5, 0.5);
		this.nextButtonContainer.add(nextButtonImage);
		this.nextButtonContainer.add(nextButtonText);
	    nextButtonImage.on('pointerdown', function (pointer) {
	    	if(transitionTextPosition < instructionLength - 1){
	    		transitionTextPosition += 1;
	    		transitionDiv.innerHTML = instructionText[transitionTextPosition];
	    		backButtonImage.visible = true;
	    		backButtonText.visible = true;
	    		// if (transitionTextPosition == instructionLength - 1 & isInstructionRevisit) {
	    		// 	transitionDiv.innerHTML = revisitingInstructionText[1];
	    		// }
	    		// if (transitionTextPosition < instructionLength - 1) {
	    		// 	currentInstructionPicture[transitionTextPosition - 1].visible = false;
	    		// 	currentInstructionPicture[transitionTextPosition].visible = true;
				// } else {
				// 	currentInstructionPicture[transitionTextPosition - 1].visible = false;
				// 	if(typeof currentInstructionPicture[transitionTextPosition] != 'undefined') {
	    		// 		currentInstructionPicture[transitionTextPosition].visible = false;
				// 	}
				// }
	    	} else {
	    		this.scene.start('SceneGoToNewGameRound', { taskType: this.taskType });
				nextButtonImage.visible = false;
				backButtonImage.visible = false;
	    	}
	    }, this);
	    // back button
	    this.backButtonContainer = this.add.container(250, 520);
		let backButtonImage = this.add.sprite(0, 0, 'button').setDisplaySize(200,150).setInteractive({ cursor: 'pointer' });
		let backButtonText = this.add.text(0, 0, 'back', { fontSize: '32px', fill: '#000' });
		backButtonText.setOrigin(0.5, 0.5);
		this.backButtonContainer.add(backButtonImage);
		this.backButtonContainer.add(backButtonText);
		backButtonImage.visible = false;
		backButtonText.visible = false;
	    backButtonImage.on('pointerdown', function (pointer) {
	    	if(transitionTextPosition>0){
	    		transitionTextPosition -= 1;
	    		transitionDiv.innerHTML = instructionText[transitionTextPosition];
	    		// if (transitionTextPosition > 0) {
	    		// 	if(typeof currentInstructionPicture[transitionTextPosition + 1] != 'undefined') {
	    		// 		currentInstructionPicture?.[transitionTextPosition + 1]?.visible = false;
	    		// 	}
	    		// 	currentInstructionPicture[transitionTextPosition].visible = true;
				// } else {
				// 	backButtonImage.visible = false;
				// 	backButtonText.visible = false;
				// 	currentInstructionPicture[transitionTextPosition + 1].visible = false;
	    		// 	currentInstructionPicture[transitionTextPosition].visible = false;
				// }
	    	}
	    });
	    // pointerover
		backButtonImage.on('pointerover', function (pointer) {
	    	backButtonImage.setTint(0x4c4c4c); //B8860B ff0000
	    }, this);
	    nextButtonImage.on('pointerover', function (pointer) {
	    	nextButtonImage.setTint(0x4c4c4c); //008B8B
	    }, this);
	    // pointerout
		backButtonImage.on('pointerout', function (pointer) {
	    	backButtonImage.clearTint();
	    }, this);
	    nextButtonImage.on('pointerout', function (pointer) {
	    	nextButtonImage.clearTint();
	    }, this);
	}

	update(){
	}
};

export default SceneNextRoundsInstruction;
