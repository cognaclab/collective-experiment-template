// SceneGoToQuestionnaire
class SceneGoToNewGameRound extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneGoToNewGameRound', active: false });
	}

	preload(){
	}

	init (data) {
		this.taskType = data.taskType;
	}

	create(){
		payoffText.visible = false;
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'
		// text styles
		const textStyle =
			{ fontSize: '30px', fill: nomalTextColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true } };
		const noteStyle =
			{ fontSize: '36px', fill: noteColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true }, fontstyle: 'bold' };
		//  Texts
		// let totalEarning_USD = Math.round((totalPayoff_perIndiv*cent_per_point))/100
		let totalEarning_USD = Math.round((totalPayoff_perIndiv*cent_per_point))/100
		let waitingBunis_USD = Math.round(waitingBonus)/100
	    let title = this.add.text(configWidth/2, 18, goToNewGameRoundText[0], { fontSize: '36px', fill: '#000', fontstyle: 'bold' });
	    let note1 = this.add.text(configWidth/2, 90, goToNewGameRoundText[1] + (gameRound + 1), noteStyle);
	    let note2 = this.add.text(configWidth/2, 90+50*2, goToNewGameRoundText[2], noteStyle);
	    //let note3 = this.add.text(configWidth/2, 90+50*4, goToNewGameRoundText[3], noteStyle);
	    title.setOrigin(0.5, 0.5);
	    note1.setOrigin(0.5, 0.5);
	    note2.setOrigin(0.5, 0.5);
	    //note3.setOrigin(0.5, 0.5);

	    // Next game round button
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };
		let buttonContainer_nextGameRound = this.add.container(configWidth/2, 400); //position
		let buttonImage_nextGameRound = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_nextGameRound = this.add.text(0, 0, 'Go to ' +' Period ' + (gameRound+2), button_style);
		buttonText_nextGameRound.setOrigin(0.5, 0.5);
		buttonContainer_nextGameRound.add(buttonImage_nextGameRound);
		buttonContainer_nextGameRound.add(buttonText_nextGameRound);
		buttonContainer_nextGameRound.visible = true;

		// pointer over & out effects
	    buttonImage_nextGameRound.on('pointerover', function (pointer) {
	    	buttonImage_nextGameRound.setTint(0xa9a9a9);
	    }, this);
	    buttonImage_nextGameRound.on('pointerout', function (pointer) {
	    	buttonImage_nextGameRound.clearTint();
	    }, this);

	    buttonImage_nextGameRound.on('pointerdown', function (pointer) {
	    	// this.scene.stop('SceneMain');
	    	// this.scene.stop('ScenePerfect');
	    	// this.scene.stop('SceneStartCountdown');
	    	// currentTrial = 1;
	    	socket.emit('new gameRound ready', {taskType: this.taskType});
	    	buttonContainer_nextGameRound.visible = false;
	    }, this);

	}

	update(){}
};

export default SceneGoToNewGameRound;
