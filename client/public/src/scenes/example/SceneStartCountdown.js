// SceneStartCountdown
	class SceneStartCountdown extends Phaser.Scene {

		constructor (){
		    	super({ key: 'SceneStartCountdown', active: false });
		}

		preload(){
			}

		init (data) {
			this.gameRound = data.gameRound;
			this.trial = data.trial;
			this.horizon = data.horizon;
			this.gameType = data.gameType;
			this.groupCumulativePayoff = data.groupCumulativePayoff;
			this.n = data.n;
			this.taskType = data.taskType
		}

		create(){
			// background colour
			this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'

			// start image
			let startImg = this.add.image(configWidth/2, configHeight/2, 'startImg').setAlpha(0);
			let tween;

			//  Texts
		    let title = this.add.text(configWidth/2, configHeight/2, '5', { fontSize: '36px', fill: '#000', fontstyle: 'bold' });

		    // tween = this.tweens.add({
		    //     targets: startImg,
		    //     alpha: { value: 0.9, duration: 1500, ease: 'Power1' },
		    //     scale: { value: 3, duration: 1500, ease: 'Power1' },
		    //     delay: 5000,
		    //     yoyo: true,
		    //     loop: 0 //-1
		    // });

		    setTimeout(function(){
                title.setText('4');
            },1000);
            setTimeout(function(){
                title.setText('3');
            },2000);
            setTimeout(function(){
                title.setText('2');
            },3000);
            setTimeout(function(){
                title.setText('1');
            },4000);
            setTimeout(function(that){
            	//let startImg = this.add.sprite(configWidth/2, configHeight/2, 'startImg').setAlpha(0);
            	title.destroy();

            	tween = that.tweens.add({
			        targets: startImg,
			        alpha: { value: 0.9, duration: 1500, ease: 'Power1' },
			        scale: { value: 3, duration: 1500, ease: 'Power1' },
			        delay: 0,
			        yoyo: true,
			        loop: 0 //-1
			    });

            	//this.add.tween(startImg).to( { alpha: 1 }, 2000, Phaser.Easing.Linear.None, true, 0, 1000, true);
            }, 5000, this);
            setTimeout(function(){
            	tween.remove();
            	startImg.visible = false;
                this.scene.start('SceneMain', 
					{gameRound: this.gameRound
						, trial: this.trial
						, horizon: this.horizon
						, groupCumulativePayoff: this.groupCumulativePayoff
						, n: this.n
						, taskType: this.taskType
					});
                this.scene.stop('SceneStartCountdown');
                this.scene.stop('ScenePerfect');
                this.scene.stop('SceneWaitingRoom');
            }.bind(this), 6500);
		}

		update(){}
	};

export default SceneStartCountdown;