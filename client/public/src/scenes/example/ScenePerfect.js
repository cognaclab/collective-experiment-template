// ScenePerfect
class ScenePerfect extends Phaser.Scene {

	constructor (){
	    	super({ key: 'ScenePerfect', active: false });
	}

	preload(){
		}

	init (data) {
		this.n = data.n;
		this.room = data.room;
		this.exp_condition = data.exp_condition;
        this.optionOrder = data.optionOrder;
        this.maxChoiceStageTime = data.maxChoiceStageTime;
		this.horizon = data.horizon;
	}

	create(){
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'

		// start image
		let perfectImg = this.add.image(configWidth/2, configHeight/2+100, 'perfectImg').setAlpha(0);
		let tween;

		//  Texts
	    //let title = this.add.text(configWidth/2, configHeight/2, '5', { fontSize: '36px', fill: '#000', fontstyle: 'bold' });

	    tween = this.tweens.add({
	        targets: perfectImg,
	        alpha: { value: 0.9, duration: 1500, ease: 'Power1' },
	        scale: { value: 1.5, duration: 1500, ease: 'Power1' },
	        //delay: 5000,
	        yoyo: true,
	        loop: 0 //-1
	    });
        setTimeout(function(){
            socket.emit('test passed');
        },1500);
	}

	update(){}
};

export default ScenePerfect;