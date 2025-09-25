// SceneGoToQuestionnaire

import {rand
	, goToQuestionnaire
} from '../../functions.js';

class SceneGoToQuestionnaire extends Phaser.Scene {

	constructor (){
	    super({ key: 'SceneGoToQuestionnaire', active: false });
	}

	preload(){
	}

	create(){
		// background colour
		this.cameras.main.setBackgroundColor('#FFFFFF'); //#FFFFFF == 'white'
		// text styles
		const textStyle =
			{ fontSize: '30px', fill: nomalTextColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true } };
		const noteStyle =
			{ fontSize: '36px', fill: noteColor, wordWrap: { width: configWidth-80, useAdvancedWrap: true }, fontstyle: 'bold' };
		//  Texts
		let totalEarning_GBP = Math.round((totalPayoff_perIndiv*cent_per_point))/100
		let waitingBunis_GBP = Math.round(waitingBonus)/100
	    let title = this.add.text(configWidth/2, 18, goToQuestionnaireText[0], { fontSize: '36px', fill: '#000', fontstyle: 'bold' });
	    let note1 = this.add.text(configWidth/2, 90, goToQuestionnaireText[1]+totalEarning_GBP, noteStyle);
	    let note2 = this.add.text(configWidth/2, 90+50*2, goToQuestionnaireText[2]+waitingBunis_GBP, noteStyle);
	    //let note3 = this.add.text(configWidth/2, 90+50*4, goToQuestionnaireText[3], noteStyle);
	    title.setOrigin(0.5, 0.5);
	    note1.setOrigin(0.5, 0.5);
	    note2.setOrigin(0.5, 0.5);
	    //note3.setOrigin(0.5, 0.5);

	    // isThisGameCompleted status changes
	    isThisGameCompleted = true;
	    completed = 1;
	    $("#completed").val(1);

	    // POST
	    let questionnaireStarts = document.getElementById('questionnaireStarts');

		questionnaireStarts.innerHTML = "<div class='btn2'><div id='connectBtn'>START SHORT SURVEY</div></div>";

		let connectBtn = document.getElementById('connectBtn');
		connectBtn.addEventListener('click', goToQuestionnaire, false); // execute function goToQuestionnaire()
	}

	update(){}
};

export default SceneGoToQuestionnaire;
