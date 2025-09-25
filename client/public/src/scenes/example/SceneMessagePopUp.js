// SceneMessagePopUp
class SceneMessagePopUp extends Phaser.Scene {

	// constructor (handle, parent){
	//     super({ key: handle, active: false });

	//     this.parent = parent;
	// }
	constructor () {
		super({ key: 'SceneMessagePopUp', active: false });
	}

	init (data) {
		this.msg = data.msg;
	}

	create(){
		// background
		const window_width = configWidth;
		const window_height = 50;
		this.cameras.main.setViewport(0, 0, window_width, window_height); //#FFFFFF == 'white'
		this.cameras.main.setBackgroundColor('#000');
		// text styles
		this.textStyle =
			{ fontSize: '20px', fill: '#FFFF33' };
		//  Texts
		this.groupSizeText = this.add.text(configWidth/2, 10
			, this.msg
			, this.textStyle).setOrigin(0.5, 0);
	}

};

export default SceneMessagePopUp;
