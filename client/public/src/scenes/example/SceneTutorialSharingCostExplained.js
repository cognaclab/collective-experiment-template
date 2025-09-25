// SceneTutorialSharingCostExplained
class SceneTutorialSharingCostExplained extends Phaser.Scene {

	constructor (){
	    	super({ key: 'SceneTutorialSharingCostExplained', active: false });
	}

	preload(){
		}

	init (data) {
		this.tutorialPosition = data.tutorialPosition;
	}

	create(){
		this.cameras.main.setBackgroundColor(backgroundcolour_feedback);// #d9d9d9 #ffffff backgroundcolour_feedback

		// tutorial texts
	    let tutorialPosition = this.tutorialPosition;
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
	    let tutorialDiv = document.createElement('div');
	    tutorialDiv.style = tutorialTextStyle;
	    tutorialDiv.innerHTML = tutorialText[tutorialPosition];
	    tutorialDiv.id = 'tutorialDiv';
	    // Add the div
	    let tutorialElement = this.add.dom(configWidth/2, 100, tutorialDiv);

	    // ==== Insert a picture showing 96 - 20 = 76 =====
	    let net_contribution_picture = this.add.image(configWidth/2, configHeight/2, 'net_contribution' ).setDisplaySize((752/2)*1.3, (189/2)*1.3);

		// ========================
		// OK button
		let button_style = { fontSize: '24px', fill: '#000' , align: "center" };
		let buttonContainer_ok = this.add.container(configWidth/2, 500); //position
		let buttonImage_ok = this.add.sprite(0, 0, 'button').setDisplaySize(300, 100).setInteractive({ cursor: 'pointer' });
		let buttonText_ok = this.add.text(0, 0, 'Okay!\n(Go to next page)', button_style);
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
	    	// going back to the tutorial
	    	let updatedTutorialPosition = tutorialPosition + 1;
	    	this.scene.stop('SceneTutorialSharingCostExplained');
	    	this.scene.start('SceneTutorial', { indivOrGroup: indivOrGroup, exp_condition: exp_condition,tutorialPosition: updatedTutorialPosition });
	    }, this);

	}

	update(){}
};

export default SceneTutorialSharingCostExplained;
