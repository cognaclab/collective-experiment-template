// SceneWaitingRoom0

import {rand
	, isNotNegative
	, BoxMuller
	, sum
	, waitingBarCompleted
	, debug_pointerdown
	, sending_core_is_ready
	, goToQuestionnaire
	, settingConfirmationID
	, testFunction
} from '../../functions.js';


// SceneWaitingRoom0
class SceneWaitingRoom0 extends Phaser.Scene {

	// make it public so that other scene can access to it (?)
	//public sprite: Phaser.GameObjects.Sprite;

	constructor (){
	    super({ key: 'SceneWaitingRoom0', active: true });
	}

	preload(){
		// progress bar
		let progressBox = this.add.graphics();
		let progressBar = this.add.graphics();
		progressBox.fillStyle(0x222222, 0.8);
		progressBox.fillRect(240, 270, 320, 50);
		// loading text
		let width = this.cameras.main.width;
		let height = this.cameras.main.height;
		let loadingText = this.make.text({
		    x: width / 2,
		    y: height / 2 - 50,
		    text: 'Loading...',
		    style: {
		        font: '20px',
		        fill: nomalTextColor
		    }
		});
		loadingText.setOrigin(0.5, 0.5);
		// percent text
		let percentText = this.make.text({
		    x: width / 2,
		    y: height / 2 - 5,
		    text: '0%',
		    style: {
		        font: '18px monospace',
		        fill: '#ffffff'
		    }
		});
		percentText.setOrigin(0.5, 0.5);
		// loading stuff
		this.load.image('star', 'assets/star.png');
		this.load.image('star_self', 'assets/star_self.png');
		this.load.image('button', 'assets/button.001.png');
	    this.load.image('button_active', 'assets/button.active.png');
		this.load.image('bonusBarFrame', 'assets/bar.png');
		this.load.image('bonusBar', 'assets/scaleOrange.png');
		this.load.image('perfectImg', 'assets/PERFECT.png');
		this.load.image('startImg', 'assets/start.png');
		this.load.image('energycontainer', 'assets/energycontainer.png');
		this.load.image('energybar', 'assets/energybar.png');
		this.load.image('machine1_normal', 'assets/machine_normal_1.png');
		this.load.image('machine2_normal', 'assets/machine_normal_2.png');
		this.load.image('machine3_normal', 'assets/machine_normal_3.png');
		this.load.image('machine4_normal', 'assets/machine_normal_4.png');
		this.load.image('machine5_normal', 'assets/machine_normal_5.png');
		this.load.image('machine6_normal', 'assets/machine_normal_6.png');
		this.load.image('machine7_normal', 'assets/machine_normal_7.png');
		this.load.image('machine8_normal', 'assets/machine_normal_8.png');
		this.load.image('machine9_normal', 'assets/machine_normal_9.png');
		this.load.image('machine10_normal', 'assets/machine_normal_10.png');
		this.load.image('machine11_normal', 'assets/machine_normal_11.png');
		this.load.image('machine12_normal', 'assets/machine_normal_12.png');
		this.load.image('machine1_active', 'assets/machine_active_1.png');
		this.load.image('machine2_active', 'assets/machine_active_2.png');
		this.load.image('machine3_active', 'assets/machine_active_3.png');
		this.load.image('machine4_active', 'assets/machine_active_4.png');
		this.load.image('machine5_active', 'assets/machine_active_5.png');
		this.load.image('machine6_active', 'assets/machine_active_6.png');
		this.load.image('machine7_active', 'assets/machine_active_7.png');
		this.load.image('machine8_active', 'assets/machine_active_8.png');
		this.load.image('machine9_active', 'assets/machine_active_9.png');
		this.load.image('machine10_active', 'assets/machine_active_10.png');
		this.load.image('machine11_active', 'assets/machine_active_11.png');
		this.load.image('machine12_active', 'assets/machine_active_12.png');
		// this.load.image('instructionPictures_indiv_1', 'assets/instructionPictures_individual.001.png');
		// this.load.image('instructionPictures_indiv_2', 'assets/instructionPictures_individual.002.png');
		// this.load.image('instructionPictures_indiv_3', 'assets/instructionPictures_individual.003.png');
		// this.load.image('instructionPictures_indiv_4', 'assets/instructionPictures_individual.004.png');
		// this.load.image('instructionPictures_indiv_5', 'assets/instructionPictures_individual.005.png');

		this.load.image('instructionPictures_group_1', 'assets/instructionPictures_group.001.png');
		this.load.image('instructionPictures_group_2', 'assets/instructionPictures_group.002.png');
		this.load.image('instructionPictures_group_3', 'assets/instructionPictures_group.003.png');
		this.load.image('instructionPictures_group_4', 'assets/instructionPictures_group.004.png');
		this.load.image('instructionPictures_group_5', 'assets/instructionPictures_group.005.png');
		this.load.image('instructionPictures_group_6', 'assets/instructionPictures_group.006.png');
		this.load.image('instructionPictures_group_7', 'assets/instructionPictures_group.007.png');
		this.load.image('instructionPictures_group_8', 'assets/instructionPictures_group.008.png');
		this.load.image('instructionPictures_group_9', 'assets/instructionPictures_group.009.png');
		this.load.image('instructionPictures_group_10', 'assets/instructionPictures_group.010.png');
		this.load.image('instructionPictures_group_11', 'assets/instructionPictures_group.011.png');
		this.load.image('instructionPictures_group_12', 'assets/instructionPictures_group.012.png');

		this.load.image('instructionPictures_collective_1', 'assets/instructionPictures_collective.001.png');
		this.load.image('instructionPictures_collective_2', 'assets/instructionPictures_collective.002.png');
		this.load.image('instructionPictures_collective_3', 'assets/instructionPictures_collective.003.png');
		this.load.image('instructionPictures_collective_4', 'assets/instructionPictures_collective.004.png');
		this.load.image('instructionPictures_collective_5', 'assets/instructionPictures_collective.005.png');
		this.load.image('instructionPictures_collective_6', 'assets/instructionPictures_collective.006.png');
		this.load.image('instructionPictures_collective_7', 'assets/instructionPictures_collective.007.png');
		this.load.image('instructionPictures_collective_8', 'assets/instructionPictures_collective.008.png');
		this.load.image('instructionPictures_collective_9', 'assets/instructionPictures_collective.009.png');
		this.load.image('instructionPictures_collective_10', 'assets/instructionPictures_collective.010.png');
		this.load.image('instructionPictures_collective_11', 'assets/instructionPictures_collective.011.png');
		this.load.image('instructionPictures_collective_12', 'assets/instructionPictures_collective.012.png');
		this.load.image('instructionPictures_collective_13', 'assets/instructionPictures_collective.013.png');
		this.load.image('instructionPictures_collective_14', 'assets/instructionPictures_collective.014.png');
		this.load.image('instructionPictures_collective_15', 'assets/instructionPictures_collective.015.png');

		this.load.image('instructionPictures_individual_1', 'assets/instructionPictures_individual.001.png');
		this.load.image('instructionPictures_individual_2', 'assets/instructionPictures_individual.002.png');
		this.load.image('instructionPictures_individual_3', 'assets/instructionPictures_individual.003.png');
		this.load.image('instructionPictures_individual_4', 'assets/instructionPictures_individual.004.png');
		this.load.image('instructionPictures_individual_5', 'assets/instructionPictures_individual.005.png');
		this.load.image('instructionPictures_individual_6', 'assets/instructionPictures_individual.006.png');
		this.load.image('instructionPictures_individual_7', 'assets/instructionPictures_individual.007.png');
		this.load.image('instructionPictures_individual_8', 'assets/instructionPictures_individual.008.png');
		this.load.image('instructionPictures_individual_9', 'assets/instructionPictures_individual.009.png');
		this.load.image('instructionPictures_individual_10', 'assets/instructionPictures_individual.010.png');


		this.load.image('net_contribution', 'assets/net_contribution.png');
		this.load.image('pointing_finger', 'assets/pointing_finger.png');

		this.load.image('blackbox', 'assets/blackbox.png');
		// progress bar functions
		this.load.on('progress', function (value) {
		    ////console.log(value);
		    progressBar.clear();
		    progressBar.fillStyle(0xffffff, 1);
		    progressBar.fillRect(250, 280, 300 * value, 30);
		    percentText.setText(parseInt(value * 100) + '%');
		});
		this.load.on('fileprogress', function (file) {
		    //console.log(file.src);
		});
		this.load.on('complete', function () {
		    // console.log('preloading is completed!: core is ready');
		    isPreloadDone = true;
		    progressBar.destroy();
			progressBox.destroy();
			loadingText.destroy();
			percentText.destroy();
			sending_core_is_ready(isPreloadDone)
			// if(!isWaitingRoomStarted) {
			// 	socket.emit('loading completed');
			// }
			// execute if preload completed later than on.connection('this is your parameter')
			//if(isEnvironmentReady) game.scene.start('SceneWaitingRoom');
			//======== letting the server know latency with this client ==========
		    // after calculating the first average latency
		    // the client should be put into the individual condition
		    // sending_core_is_ready(isPreloadDone);
		    //socket.emit('core is ready', {latency: 0, maxLatencyForGroupCondition: maxLatencyForGroupCondition});

		    // setTimeout(function(){
		    //     submittedLatency = sum(averageLatency)/averageLatency.length;
		    //     socket.emit('core is ready', {latency: submittedLatency, maxLatencyForGroupCondition: maxLatencyForGroupCondition});
		    //     $("#latency").val(submittedLatency);
		    // }, averageLatency.length*1000+500);

		    //======== end: letting the server know latency with this client ==========
		});
	}

	create(){
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'
		// text styles
		const textStyle =
			{ fontSize: '24px', fill: nomalTextColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true } };
		const noteStyle =
			{ fontSize: '24px', fill: noteColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true }, fontstyle: 'bold' };
		//  Texts
	    let title = this.add.text(configWidth/2, 18, waitingRoomText0[0], { fontSize: '36px', fill: '#000', fontstyle: 'bold' });
	    let note1 = this.add.text(configWidth/2, 70, waitingRoomText0[1], textStyle);
	    let note2 = this.add.text(configWidth/2, 70+30*2, waitingRoomText0[2], textStyle);
	    let note3 = this.add.text(configWidth/2, 70+30*4, waitingRoomText0[3], noteStyle);
	    title.setOrigin(0.5, 0.5);
	    note1.setOrigin(0.5, 0.5);
	    note2.setOrigin(0.5, 0.5);
	    note3.setOrigin(0.5, 0.5);
	}

	update(){
		emitting_time += 1/(3*this.game.loop.actualFps) // incrementing every 3 seconds
		if (!isWaitingRoomStarted & emitting_time % 3 == 0) {
			sending_core_is_ready(isPreloadDone)
		}
	}
};

export default SceneWaitingRoom0;
