'use strict';

window.onload = function() {

	$("#subjectID").val(config.subjectID);
	$("#bonus_for_waiting").val(config.bonus_for_waiting); //cents
    $("#confirmationID").val(config.confirmationID);
    $("#totalEarning").val(js_totalEarning);
    $('#exp_condition').val(config.exp_condition);
    $('#indivOrGroup').val(config.indivOrGroup);
    $('#info_share_cost').val(config.info_share_cost);
    $('#completed').val(config.completed);
    $('#latency').val(config.latency);

    /*console.log(subjectID);
    console.log(bonus_for_waiting);
    console.log(confirmationID);
    console.log(totalEarning);
    console.log(exp_condition);
    console.log(indivOrGroup);*/
    // console.log('completed = ' + config.completed);

    let note = document.getElementById('noteArea');
    let firstParagraph = document.getElementById('firstParagraph');
    let freeTextQ = document.getElementById('freeTextQuestion');
    let freeTextQ2 = document.getElementById('freeTextQuestion_2');
    switch (config.completed) {
        case 0:
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because of a technical error happened around the network connection and/or the server-side issue. The payoffs you have earned thus far will be paid. Please answer the following questions and click the submit button. Cheers!</span></p><br>";
            firstParagraph.innerHTML = "<p class='lead'>Please answer the following questions on how you perceived this task. </p>";
            freeTextQ.innerHTML = "Q4: Your honest feedback would be a big help to develop our future experimental task.<br> For example, any idea if your internet connection worked well?"
            freeTextQ2.innerHTML = ""
            break;
        case '0':
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because of a technical error happened around the network connection. The payoffs you have earned thus far will be paid. Please answer the following questions and click the submit button. Cheers!</span></p><br>";
            firstParagraph.innerHTML = "<p class='lead'>Please answer the following questions on how you perceived this task. </p>";
            freeTextQ.innerHTML = "Q4: Your honest feedback would be a big help to develop our future experimental task.<br> For example, any idea if your internet connection worked well?"
            freeTextQ2.innerHTML = ""
            break;
        case 'no_response':
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because you did not confirmed you were still there after the missed trial. The payoffs you have earned thus far will be paid. Please answer the following questions and click the submit button. Cheers!</span></p><br>";
            firstParagraph.innerHTML = "<p class='lead'>Please answer the following questions on how you perceived this task. </p>";
            freeTextQ.innerHTML = "Q4: If you have any comments or feedback related to our task, please write it down here!"
            freeTextQ2.innerHTML = ""
            break;
        case "maxChoiceStageTimeOver":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because you did not make a choice for 60 seconds.</span></p><br>";
            firstParagraph.innerHTML = "<p class='lead'>Please answer the following questions on how you perceived this task. </p>";
            freeTextQ.innerHTML = "Q4: Your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        case "browserHidden":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because you opened another window/tab during the decision-making task.</span></p><br>";
            firstParagraph.innerHTML = "<p class='lead'>Please answer the following questions on how you perceived this task. </p>";
            freeTextQ.innerHTML = "Q4: Your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        case "technicalIssueInWaitingRoom":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because of a technical issue in our program.</span> </p><br>";
            firstParagraph.innerHTML = "<p><span class='note'>Apologise for the inconvenience. Feel free to skip the following questionnaire and go directly to the next page to get your confirmation code.</span> </p>";
            freeTextQ.innerHTML = "Q4: Your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        case "droppedTestScene":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because you put the answer to the 'Comprehension quiz' incorrectly more than 3 times.</span></p><br>";
            firstParagraph.innerHTML = "<p class='lead'>Please answer the following questions on how you perceived this task. </p>";
            freeTextQ.innerHTML = "Q4: Your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        case "reconnected":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because of a technical issue in our server. Sorry about that!</span> </p><br>";
            firstParagraph.innerHTML = "<p><span class='note'>Apologise for the inconvenience. Feel free to skip the following questionnaire and go directly to the next page to get your confirmation code.</span> </p>";
            freeTextQ.innerHTML = "Q4: However, your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        case "solo":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because we couldn't find enough number of people to form a group of players. Sorry about that!</span> </p><br>";
            firstParagraph.innerHTML = "<p><span class='note'>Apologise for the inconvenience. Feel free to skip the following questionnaire and go directly to the next page to get your confirmation code to claim the compensation for your waiting time.</span> </p>";
            freeTextQ.innerHTML = "Q4: However, your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        case "became_solo":
            note.innerHTML = "<p><span class='note'>You were redirected to this questionnaire because your team mates were disconnected and we couldn't find enough number of people. Sorry about the inconvenience!</span> </p><br>";
            firstParagraph.innerHTML = "<p><span class='note'>Feel free to skip the following questionnaire and go directly to the next page to get your confirmation code to claim the compensation for your waiting time.</span> </p>";
            freeTextQ.innerHTML = "Q4: However, your honest feedback would be a big help to develop our future experimental task.<br> Please put any comments below if you fancy!"
            freeTextQ2.innerHTML = ""
            break;
        default:
            note.innerHTML = "";
            firstParagraph.innerHTML = "<p class='lead'>The decision-making task has been completed!<br> Please answer the following questions on how you perceived this task. </p> <p class='lead'>Your answers will be recorded anonymously, being disconnected to your Prolific ID right after the entire experiment is done. </p>";
            freeTextQ.innerHTML = "Q4: While working on the task, how did you decide which slot to choose? Could you guess which slot seemed to be a better one? Please describe freely in the form below: "
            freeTextQ2.innerHTML = "Q5: What was the most difficult part of the decision-making task? Please describe freely in the form below: "
    }
    



	let proceed = document.getElementById('proceed');

	proceed.innerHTML = "<div class='btn2'><div id='connectBtn'>SUBMIT</div></div>";

	// after document was read
	//document.ready = function () {
	let connectBtn = document.getElementById('connectBtn');
		//connectBtn.addEventListener('click', goToExp('https://twitter.com/WataruToyokawa'), false);
	//}

	connectBtn.addEventListener('click', goToEndPage, false);

	function goToEndPage () {
		$("#form").submit();
	}
	
}
