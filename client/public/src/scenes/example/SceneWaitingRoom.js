// SceneWaitingRoom
import {
	waitingBarCompleted
} from '../../functions.js';

class SceneWaitingRoom extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneWaitingRoom', active: false });
	}

	preload(){
	}

	create(){

		isWaitingRoomStarted = true;
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'
		// text styles
		const textStyle =
			{ fontSize: '24px', fill: nomalTextColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true } };
		const noteStyle =
			{ fontSize: '24px', fill: noteColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true }, fontstyle: 'bold' };
		//  Texts
	    let title = this.add.text(configWidth/2, 18, waitingRoomText[0], { fontSize: '36px', fill: '#000', fontstyle: 'bold' });
	    let note1 = this.add.text(configWidth/2, 70, waitingRoomText[1], textStyle);
	    let note2 = this.add.text(configWidth/2, 70+30*2, waitingRoomText[2], textStyle);
	    let note3 = this.add.text(configWidth/2, 70+30*4, waitingRoomText[3], noteStyle);
	    title.setOrigin(0.5, 0.5);
	    note1.setOrigin(0.5, 0.5);
	    note2.setOrigin(0.5, 0.5);
	    note3.setOrigin(0.5, 0.5);

        // waitingBonusBar
        this.restTime = restTime;
        waitingCountdown = this.time.delayedCall(restTime, waitingBarCompleted, [], this);
		waitingBox = this.add.graphics();
		waitingBar = this.add.graphics();
		waitingBox.fillStyle(0x000000, 0.7); // color, alpha
		waitingBox.fillRect(240, 270, 320, 50);
		bonusBox = this.add.graphics();
		bonusBar = this.add.graphics();
		bonusBox.fillStyle(0x000000, 0.7); // color, alpha
		bonusBox.fillRect(240, 380, 320, 50);
		// countdown texts
		countdownText = this.add.text(configWidth/2, 340, 'The study starts in ?? sec.' , textStyle);
		countdownText.setOrigin(0.5, 0.5);
		bonusText = this.add.text(configWidth/2, 450, 'Your waiting bonus: '+waitingBonus.toString().substr(0, 2)+' pence.' , textStyle);
		bonusText.setOrigin(0.5, 0.5);

	}

	update(){
		waitingBar.clear();
		waitingBar.fillStyle(0x00a5ff, 1);
	    waitingBar.fillRect(250, 280, 300 * waitingCountdown.getProgress(), 30);
		countdownText.setText('The study starts in ' + ( Math.floor(0.9+(this.restTime/1000)*(1-waitingCountdown.getProgress())) ).toString().substr(0, 3) + ' sec.');
		////console.log( 0.9+(restTime/1000)*(1-waitingCountdown.getProgress()) );
		////console.log(waitingCountdown.getProgress());
		waitingBonus += waitingBonus_per_6sec/(6*this.game.loop.actualFps)
		bonusBar.clear();
		bonusBar.fillStyle(0xff5a00, 1);
		if(waitingBonus*2<300) {
	    	bonusBar.fillRect(250, 390, waitingBonus*2, 30); //1.4 cents per 6 seconds = 8.4 USD per hour
		}else{
			bonusBar.fillRect(250, 390, 300, 30);
		}
		bonusText.setText('Your waiting bonus: '+waitingBonus.toString().substr(0, 2)+' pence.');
	}

};

export default SceneWaitingRoom;

