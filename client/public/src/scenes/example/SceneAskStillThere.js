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

		this.cameras.main.setBackgroundColor('#FFFFFF');

		const headingText = this.add.text(configWidth/2, configHeight/2 - 150,
			'Are you still there?',
			{ fontSize: '42px', fill: '#000000', fontStyle: 'bold' }
		).setOrigin(0.5);

		const messageText = this.add.text(configWidth/2, configHeight/2 - 50,
			'You exceeded the length of time for the previous trial.\nPlease press confirm to proceed.',
			{ fontSize: '26px', fill: '#000000', align: 'center' }
		).setOrigin(0.5);

		let buttonContainer_confirm = this.add.container(configWidth/2, configHeight/2 + 100);
		let buttonImage_confirm = this.add.sprite(0, 0, 'button')
			.setDisplaySize(250, 80)
			.setInteractive({ cursor: 'pointer' });
		let buttonText_confirm = this.add.text(0, 0, 'Confirm',
			{ fontSize: '28px', fill: '#000' }
		).setOrigin(0.5);

		buttonContainer_confirm.add([buttonImage_confirm, buttonText_confirm]);

	    buttonImage_confirm.on('pointerover', function (pointer) {
	    	buttonImage_confirm.setTint(0xa9a9a9);
	    }, this);

	    buttonImage_confirm.on('pointerout', function (pointer) {
	    	buttonImage_confirm.clearTint();
	    }, this);

	    buttonImage_confirm.on('pointerdown', function (pointer) {
	    	buttonContainer_confirm.visible = false;
	    	messageText.setText('Processing...');

			socket.emit('scene_complete', {
				scene: 'SceneAskStillThere'
			});
	    }, this);

		let timerBar_Y = 16 + 50 * 2;
		let confirmationTimer;

		let timerContainer = this.add.sprite(configWidth/2, timerBar_Y+18, 'energycontainer');
		let timerBar = this.add.sprite(timerContainer.x + 46, timerContainer.y, 'energybar');
		let timerMask = this.add.sprite(timerBar.x, timerBar.y, 'energybar');
		timerMask.visible = false;

		let timerContainer_originalWidth = timerContainer.displayWidth;
		let timerContainer_newWidth = 200;
		let container_bar_ratio = timerBar.displayWidth / timerContainer.displayWidth;

		timerContainer.displayWidth = timerContainer_newWidth;
		timerContainer.scaleY = timerContainer.scaleX;
		timerBar.displayWidth = timerContainer_newWidth * container_bar_ratio;
		timerBar.scaleY = timerBar.scaleX;
		timerBar.x = timerContainer.x + (46 * timerContainer_newWidth/timerContainer_originalWidth);
		timerMask.displayWidth = timerBar.displayWidth;
		timerMask.scaleY = timerMask.scaleX;
		timerMask.x = timerBar.x;
		timerBar.mask = new Phaser.Display.Masks.BitmapMask(this, timerMask);

		this.timeLeft = maxConfirmationWhenMissed / 1000;

		confirmationTimer = this.time.addEvent({
			delay: 1000,
			callback: function(){
				this.timeLeft --;
				let stepWidth = timerMask.displayWidth / (maxConfirmationWhenMissed/1000);
				timerMask.x -= stepWidth;

				if(this.timeLeft < 0){
					socket.io.opts.query = 'sessionName=already_finished';
					confirmationTimer.destroy();
					buttonContainer_confirm.visible = false;
					messageText.setText('Time was up!\nYou are redirected to the questionnaire...');
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
	}
	update(){}
};

export default SceneAskStillThere;