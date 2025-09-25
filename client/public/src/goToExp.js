'use strict';
//enchant();

//const gameServer = 'localhost:8080';
//const gameServer = '63-250-60-135.cloud-xip.io:8080';

window.onload = function() {

	$("#subjectID").val(subjectID);
    //console.log('my subjectID is ' + $("#subjectID").val() + '!! - by index.ejs');
    let isAgreed = false;
    let agreement = document.getElementById('agreement');
    //agreement.innerHTML = "<div class='btn3' id='agreed1'><div>I have read and understood the preceding information.</div></div> <br /> <div class='btn3' id='agreed2'><div>I understand that I can withdraw from the study without providing an explanation.</div></div> <br /> <div class='btn3' id='agreed3'><div>I understand how my processed data will be treated and anonymised.</div></div> <br /> <div class='btn3' id='agreed4'><div>I have been made fully aware of the potential risks associated with this research and am satisfied with the information provided.</div></div> <br /> <div class='btn3' id='agreed5'><div>I know that I can contact members of the research project in case of questions and concerns, even after my participation.</div></div> <br /> <div class='btn3' id='agreed6'><div>I agree to take part in the study.</div></div> <br />"
    agreement.innerHTML = "<div class='btn3' id='agreed1'><div>I have read and understood the preceding information.</div></div>  <br /> <div class='btn3' id='agreed2'><div>I am 18 yeas old or older.</div></div>  <br /> <div class='btn3' id='agreed3'><div>I understand how my processed data will be treated and anonymised.</div></div> <br /> <div class='btn3' id='agreed6'><div>I agree to take part in the study.</div></div> <br />"

    let isAgree1 = document.getElementById('agreed1')
    ,	isAgree2 = document.getElementById('agreed2')
    ,	isAgree3 = document.getElementById('agreed3')
    //,	isAgree4 = document.getElementById('agreed4')
    //,	isAgree5 = document.getElementById('agreed5')
    ,	isAgree6 = document.getElementById('agreed6')
    , 	flag1 = 0
    , 	flag2 = 0
    , 	flag3 = 0
    , 	flag4 = 1
    , 	flag5 = 1
    , 	flag6 = 0
    ,	countAgreed = 0
    ;

    isAgree1.addEventListener('click', agreeing1, false);
    isAgree2.addEventListener('click', agreeing2, false);
    isAgree3.addEventListener('click', agreeing3, false);
    //isAgree4.addEventListener('click', agreeing4, false);
    //isAgree5.addEventListener('click', agreeing5, false);
    isAgree6.addEventListener('click', agreeing6, false);

	let gameStart = document.getElementById('gameStart');

	gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";

	
	//let connectBtn = document.getElementById('connectBtn');
	//connectBtn.addEventListener('click', goToExp, false);

	function goToExp () {
		console.log('goToExp()');
		$("#form").submit();
		//window.open("http://" + gameServer + "/?subjectID=" + subjectID);
		//window.open('https://twitter.com/WataruToyokawa');
		//window.location.href = 'https://twitter.com/WataruToyokawa';
	    //window.location.href = "http://" + gameServer; 
	    //window.location.href = "http://" + gameServer +"/?subjectID=" + subjectID + "&exp_condition=" + exp_condition;
	}

	function agreeing1 () {
		if (flag1==0) {
			flag1++;
			isAgree1.style.opacity = 1.0;
			isAgree1.style.background = '#FFA500';
		} else {
			flag1--;
			isAgree1.style.opacity = 0.9;
			isAgree1.style.background = '#3B9FDD';
		}
		countAgreed = flag1 + flag2 + flag3 + flag4 + flag5 + flag6
		if (countAgreed == 6) {
			gameStart.innerHTML = "<div class='btn2'><div id='connectBtn'>GO TO THE TASK</div></div>";
			let connectBtn = document.getElementById('connectBtn');
			connectBtn.addEventListener('click', goToExp, false);
		} else {
			gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";
		}
	}
	function agreeing2 () {
		if (flag2==0) {
			flag2++;
			isAgree2.style.opacity = 1.0;
			isAgree2.style.background = '#FFA500';
		} else {
			flag2--;
			isAgree2.style.opacity = 0.9;
			isAgree2.style.background = '#3B9FDD';
		}
		countAgreed = flag1 + flag2 + flag3 + flag4 + flag5 + flag6
		if (countAgreed == 6) {
			gameStart.innerHTML = "<div class='btn2'><div id='connectBtn'>GO TO THE TASK</div></div>";
			let connectBtn = document.getElementById('connectBtn');
			connectBtn.addEventListener('click', goToExp, false);
		} else {
			gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";
		}
	}
	function agreeing3 () {
		if (flag3==0) {
			flag3++;
			isAgree3.style.opacity = 1.0;
			isAgree3.style.background = '#FFA500';
		} else {
			flag3--;
			isAgree3.style.opacity = 0.9;
			isAgree3.style.background = '#3B9FDD';
		}
		countAgreed = flag1 + flag2 + flag3 + flag4 + flag5 + flag6
		if (countAgreed == 6) {
			gameStart.innerHTML = "<div class='btn2'><div id='connectBtn'>GO TO THE TASK</div></div>";
			let connectBtn = document.getElementById('connectBtn');
			connectBtn.addEventListener('click', goToExp, false);
		} else {
			gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";
		}
	}
	/*function agreeing4 () {
		if (flag4==0) {
			flag4++;
			isAgree4.style.opacity = 1.0;
			isAgree4.style.background = '#FFA500';
		} else {
			flag4--;
			isAgree4.style.opacity = 0.9;
			isAgree4.style.background = '#3B9FDD';
		}
		countAgreed = flag1 + flag2 + flag3 + flag4 + flag5 + flag6
		if (countAgreed == 6) {
			gameStart.innerHTML = "<div class='btn2'><div id='connectBtn'>GO TO THE TASK</div></div>";
			let connectBtn = document.getElementById('connectBtn');
			connectBtn.addEventListener('click', goToExp, false);
		} else {
			gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";
		}
	}
	function agreeing5 () {
		if (flag5==0) {
			flag5++;
			isAgree5.style.opacity = 1.0;
			isAgree5.style.background = '#FFA500';
		} else {
			flag5--;
			isAgree5.style.opacity = 0.9;
			isAgree5.style.background = '#3B9FDD';
		}
		countAgreed = flag1 + flag2 + flag3 + flag4 + flag5 + flag6
		if (countAgreed == 6) {
			gameStart.innerHTML = "<div class='btn2'><div id='connectBtn'>GO TO THE TASK</div></div>";
			let connectBtn = document.getElementById('connectBtn');
			connectBtn.addEventListener('click', goToExp, false);
		} else {
			gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";
		}
	}*/
	function agreeing6 () {
		if (flag6==0) {
			flag6++;
			isAgree6.style.opacity = 1.0;
			isAgree6.style.background = '#FFA500';
		} else {
			flag6--;
			isAgree6.style.opacity = 0.9;
			isAgree6.style.background = '#3B9FDD';
		}
		countAgreed = flag1 + flag2 + flag3 + flag4 + flag5 + flag6
		if (countAgreed == 6) {
			gameStart.innerHTML = "<div class='btn2'><div id='connectBtn'>GO TO THE TASK</div></div>";
			let connectBtn = document.getElementById('connectBtn');
			connectBtn.addEventListener('click', goToExp, false);
		} else {
			gameStart.innerHTML = "<div class='btn4'>GO TO THE TASK</div>";
		}
	}


	function myCheck() {
		var flag = false; // 選択されているか否かを判定する変数
		var count = 0;

		for (var i = 0; i < document.agreement_form.agreement.length; i++) {

			// i番目のチェックボックスがチェックされているかを判定
			if (document.agreement_form.agreement[i].checked) {
				flag = true;    
				count++;
				//alert(document.agreement_form.agreement[i].value + "が選択されました。");
			}
			if(count == 6){
				let connectBtn = document.getElementById('connectBtn');
				connectBtn.addEventListener('click', goToExp, false);
			}
		}

		// 何も選択されていない場合の処理   
		if (!flag) {
			//alert("項目が選択されていません。");
		}
	}
	
}


