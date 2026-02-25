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

	create(data){

		// Support both config-driven (sceneData) and legacy (global variables)
		this.restTime = data?.restTime || window.restTime || 120000;
		this.maxWaitingTime = data?.maxWaitingTime || window.maxWaitingTime || 120000;
		this.maxGroupSize = data?.maxGroupSize || window.maxGroupSize || 4;
		this.currentGroupSize = data?.currentGroupSize || window.currentGroupSize || 0;
		this.waitingBonusRate = data?.waitingBonusRate || 10; // pence per minute
		this.roomReady = data?.roomReady || false; // Room is full and ready to start

		// Initialize waiting bonus if not already set (for legacy compatibility)
		if (typeof window.waitingBonus === 'undefined') {
			window.waitingBonus = 0;
		}

		isWaitingRoomStarted = true;
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'
		// text styles
		const textStyle =
			{ fontSize: '24px', fill: nomalTextColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true } };
		const noteStyle =
			{ fontSize: '24px', fill: noteColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true }, fontstyle: 'bold' };

		// Update title and note text based on room status
		const titleText = this.roomReady || this.restTime < 15000
			? 'All Players Ready!'
			: waitingRoomText[0];

		const note1Text = this.roomReady || this.restTime < 15000
			? 'The experiment will begin shortly...'
			: waitingRoomText[1];

		//  Texts
	    let title = this.add.text(configWidth/2, 18, titleText, { fontSize: '36px', fill: '#000', fontstyle: 'bold' });
	    let note1 = this.add.text(configWidth/2, 70, note1Text, textStyle);
	    let note2 = this.add.text(configWidth/2, 70+30*2, waitingRoomText[2], textStyle);
	    let note3 = this.add.text(configWidth/2, 70+30*4, waitingRoomText[3], noteStyle);
	    title.setOrigin(0.5, 0.5);
	    note1.setOrigin(0.5, 0.5);
	    note2.setOrigin(0.5, 0.5);
	    note3.setOrigin(0.5, 0.5);

        // waitingBonusBar
        // Create callback that emits scene_complete for config-driven experiments
        waitingCountdown = this.time.delayedCall(this.restTime, function() {
            // Legacy callback for console logging
            waitingBarCompleted();

            // For config-driven experiments: emit scene_complete to trigger next scene
            if (window.socket && window.experimentFlow) {
                console.log('Waiting period complete - emitting scene_complete to server');

                const sequence = window.experimentFlow.sequence || [];
                window.socket.emit('scene_complete', {
                    scene: 'SceneWaitingRoom',
                    sequence: sequence
                });
            }
        }, [], this);

		// Store references for cleanup
		this.titleText = title;
		this.note1Text = note1;

		// Formation queue listeners (for live group formation mode)
		this.formationQueueListener = (data) => {
			console.log('Formation queue update:', data);

			if (!this.scene.isActive()) return;

			const { totalWaiting, groupSize } = data;

			if (this.titleText) {
				this.titleText.setText('Finding Your Group...');
			}
			if (this.note1Text) {
				this.note1Text.setText(
					`${totalWaiting} participant${totalWaiting !== 1 ? 's' : ''} waiting (need ${groupSize} per group)`
				);
			}
		};

		this.formationTimeoutListener = (data) => {
			console.log('Formation timeout:', data);

			if (!this.scene.isActive()) return;

			if (this.titleText) {
				this.titleText.setText('Session Timed Out');
			}
			if (this.note1Text) {
				this.note1Text.setText(data.message || 'Not enough participants joined in time.');
			}

			// Stop the countdown timer
			if (waitingCountdown) {
				waitingCountdown.remove();
			}
		};

		window.socket.off('formation_queue_update', this.formationQueueListener);
		window.socket.on('formation_queue_update', this.formationQueueListener);
		window.socket.off('formation_timeout', this.formationTimeoutListener);
		window.socket.on('formation_timeout', this.formationTimeoutListener);

		// Apply initial queue status if provided in scene data
		if (data?.queueStatus) {
			this.formationQueueListener(data.queueStatus);
		}

		// Create bound listener function so we can remove it later
		this.waitingRoomUpdateListener = (data) => {
			console.log('Waiting room update received:', data);

			// Only update if scene is still active and objects exist
			if (!this.scene.isActive() || !this.titleText || !this.note1Text) {
				return;
			}

			this.currentGroupSize = data.n;
			this.roomReady = data.roomReady || false;

			// Update UI text dynamically
			const newTitleText = this.roomReady
				? 'All Players Ready!'
				: waitingRoomText[0];

			const newNote1Text = this.roomReady
				? 'The experiment will begin shortly...'
				: waitingRoomText[1];

			this.titleText.setText(newTitleText);
			this.note1Text.setText(newNote1Text);

			// If room is no longer ready, restart timer with full duration
			if (!this.roomReady && data.restTime) {
				this.restTime = data.restTime;

				// Cancel old timer and create new one
				if (waitingCountdown) {
					waitingCountdown.remove();
				}

				waitingCountdown = this.time.delayedCall(this.restTime, function() {
					waitingBarCompleted();

					if (window.socket && window.experimentFlow) {
						console.log('Waiting period complete - emitting scene_complete to server');
						const sequence = window.experimentFlow.sequence || [];
						window.socket.emit('scene_complete', {
							scene: 'SceneWaitingRoom',
							sequence: sequence
						});
					}
				}, [], this);

				console.log(`Timer reset to ${this.restTime}ms`);
			}
		};

		// Remove any existing listener before adding new one
		window.socket.off('waiting_room_update', this.waitingRoomUpdateListener);
		window.socket.on('waiting_room_update', this.waitingRoomUpdateListener);

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
		const bonusPounds = (waitingBonus / 100).toFixed(2);
		bonusText = this.add.text(configWidth/2, 450, `Your waiting bonus: £${bonusPounds}` , textStyle);
		bonusText.setOrigin(0.5, 0.5);

	}

	update(){
		waitingBar.clear();
		waitingBar.fillStyle(0x00a5ff, 1);
	    waitingBar.fillRect(250, 280, 300 * (1 - waitingCountdown.getProgress()), 30);
		countdownText.setText('The study starts in ' + ( Math.floor(0.9+(this.restTime/1000)*(1-waitingCountdown.getProgress())) ).toString().substr(0, 3) + ' sec.');

		// Update bonus based on configured rate (pence per minute)
		const bonusPerSecond = (this.waitingBonusRate || waitingBonus_per_6sec) / 60;
		waitingBonus += bonusPerSecond / this.game.loop.actualFps;

		bonusBar.clear();
		bonusBar.fillStyle(0xff5a00, 1);
		if(waitingBonus*2<300) {
	    	bonusBar.fillRect(250, 390, waitingBonus*2, 30);
		}else{
			bonusBar.fillRect(250, 390, 300, 30);
		}

		// Proper currency formatting
		const bonusPounds = (waitingBonus / 100).toFixed(2);
		bonusText.setText(`Your waiting bonus: £${bonusPounds}`);
	}

	shutdown() {
		if (this.waitingRoomUpdateListener) {
			window.socket.off('waiting_room_update', this.waitingRoomUpdateListener);
		}
		if (this.formationQueueListener) {
			window.socket.off('formation_queue_update', this.formationQueueListener);
		}
		if (this.formationTimeoutListener) {
			window.socket.off('formation_timeout', this.formationTimeoutListener);
		}
	}

};

export default SceneWaitingRoom;

