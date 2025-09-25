'use strict';

exports.rand = function (max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

exports.proceedRound = function (room, roomStatus, numTrial, io) {
  roomStatus[room]['round']++;
  if(roomStatus[room]['round'] <= numTrial) {
    ////console.log(roomStatus[room]['round']);
    //console.log(numTrial);
    io.to(room).emit('Proceed to next round', roomStatus[room]);
  } else {
    io.to(room).emit('End this session', roomStatus[room]);
  }
}

exports.countDown = function (room, roomStatus, maxNumPlayer, io) {
  //console.log('rest time of ' + room + ' is ' + roomStatus[room]['restTime']);
  roomStatus[room]['restTime'] -= 500;
  if (roomStatus[room]['restTime'] < 0) {
    //setTimeout(function(){ startSession(room) }, 1500); // this delay allows the 'start' text's effect
    if(roomStatus[room]['n'] < maxNumPlayer && roomStatus[room]['indivOrGroup'] != 0) {
      roomStatus[room]['starting'] = 1;
      io.to(room).emit('you guys are individual condition');
    } else {
      startSession(room);
    }
    //clearTimeout(countDownWaiting[room]);
  } else {
    let room2 = room;
    countDownWaiting[room] = setTimeout(function(){ countDown(room2) }, 500);
  }
}

exports.startSession = function (room, countDownWaitingm, io) {
  if(typeof countDownWaiting[room] != 'undefined') {
    clearTimeout(countDownWaiting[room]);
  }
  roomStatus[room]['starting'] = 1;
  if (roomStatus[room]['n'] < maxNumPlayer) {
    roomStatus[room]['indivOrGroup'] = 0; // individual condition
  } else {
    roomStatus[room]['indivOrGroup'] = 1; // group condition
  }
  io.to(room).emit('this room gets started', {room:room, n:roomStatus[room]['n'], exp_condition:roomStatus[room]['exp_condition'], indivOrGroup:roomStatus[room]['indivOrGroup']});
  var now814 = new Date(),
      logdate814 = '['+now814.getUTCFullYear()+'/'+(now814.getUTCMonth()+1)+'/';
      logdate814 += now814.getUTCDate()+'/'+now814.getUTCHours()+':'+now814.getUTCMinutes()+':'+now814.getUTCSeconds()+']';
  console.log(logdate814+' - session started in '+room);
  //startChoiceStage(room, 1);
  //setTimeout(function(){ startChoiceStage(room, 1) }, 500);
}

exports.startWaitingStageClock = function (room) {
    var now823 = new Date(),
        logtxt823 = '['+now823.getUTCFullYear()+'/'+(now823.getUTCMonth()+1)+'/';
        logtxt823 += now823.getUTCDate()+'/'+now823.getUTCHours()+':'+now823.getUTCMinutes()+':'+now823.getUTCSeconds()+']';
        logtxt823 += ' - Waiting room opened at '+ room;
    console.log(logtxt823);
    countDown(room);
}

exports.stopAndResetClock = function (room) {
  clearTimeout(countDownWaiting[room]);
  roomStatus[room]['restTime'] = maxWaitingTime;
}

exports.calculatePayoff = function (counter, choices, numOptions, room, choiceOrder, socialInfo, session, subjectNumber, amazonID) {
  let payoffs = []
  ,   frequencies = new Array(numOptions).fill(0)
  ,   individualPayoffs = []
  ;
  let chocieArray = eval('['+socialInfo+']');
  let saveDataThisRound;
  // summarising choice frequencies
  for(let i=0; i<numOptions; i++){
    let num = -1;
    let tempAry = []; // a temporary array in which option i enters
    while (true) {
      num = choices.indexOf(i, num + 1);
      if(num == -1) break;
      tempAry.push(num);
    }
    frequencies[i] = tempAry.length;
  }
  // global payoffs (that is before divided by choices)
  individualPayoffs = payoffCalculator(choices, numOptions, frequencies, choiceOrder, exp_condition); // condition should be assigned when the server is launched
  roomStatus[room]['publicInfo'][roomStatus[room]['round']-1] = individualPayoffs;
  roomStatus[room]['choiceOrder'][roomStatus[room]['round']-1] = roomStatus[room]['doneNo'][roomStatus[room]['round']-1];
  while(roomStatus[room]['choiceOrder'][roomStatus[room]['round']-1].length < maxNumPlayer){
    roomStatus[room]['choiceOrder'][roomStatus[room]['round']-1].push(-1);
  }

  // Save the data to csv
  let thisCounter = counter;
  for (let k = 0; k < roomStatus[room]['saveDataThisRound'].length; k++) {
    saveDataThisRound = roomStatus[room]['saveDataThisRound'][k];
    // if no one has disconnected or this guy is not listed in the disconnected list, save the data
    if(roomStatus[room]['disconnectedList'].length === 0 || roomStatus[room]['disconnectedList'].indexOf(saveDataThisRound.confirmationID) === -1) {
      saveDataThisRound.localPayoff = individualPayoffs[thisCounter];
      thisCounter++;
      saveDataThisRound.groupSize = roomStatus[room]['n'];
      if(typeof saveDataThisRound != 'undefined' && room != 'finishedRoom') {
        let savingCsv = new Promise(function(resolve, reject){
          resolve(csvStream.write(saveDataThisRound)); 
        });
        //csvStream.write(saveDataThisRound); 
      }
      if(thisCounter+1 == roomStatus[room]['saveDataThisRound'].length){
        // Going to next round or end the task
        var now877 = new Date()
        ,   logtxt877 = '['+now877.getUTCFullYear()+'/'+(now877.getUTCMonth()+1)+'/'
        ;
        logtxt877 += now877.getUTCDate()+'/'+now877.getUTCHours()+':'+now877.getUTCMinutes()+':'+now877.getUTCSeconds()+']';
        logtxt877 += ' - Room '+ room + ' proceeds to the next round from ' + roomStatus[room]['round'] + '.';
        console.log(logtxt877);
        roomStatus[room]['round']++;
        //saveDataThisRound = [];
        if(roomStatus[room]['round'] <= numTrial) {
          savingCsv.then( io.to(room).emit('Proceed to next round', roomStatus[room]) );
          //io.to(room).emit('Proceed to next round', roomStatus[room]);
        } else {
          savingCsv.then( io.to(room).emit('End this session', roomStatus[room]) );
          //io.to(room).emit('End this session', roomStatus[room]);
        }
        // Going to next round or end the task -- END
      }
    }
  }
}

exports.payoffCalculator = function (choices, numOptions, frequencies, choiceOrder, condition, maxNumPlayer, payoffMeans) {
  let globalPayoffs = [];
  //let individualPayoffs = new Array(choices.length).fill(0);
  let individualPayoffs = new Array(maxNumPlayer).fill(-1);
  // We need to fix the payoff function 
  // For now, this is just an example
  for (let i = 0; i < numOptions; i++) {
    // calculating the global payoff
    //globalPayoffs.push(BoxMuller(payoffMeans[condition][i], sigmaGlobal));
    globalPayoffs.push(payoffMeans[condition][i]); // global payoff is drawn deterministically
  }
  // calculating payoffs for each individual/choice
  if (condition == 0) { // distributive condition 
    for (let i = 0; i < choices.length; i++) {
      if (frequencies[choices[i]] > 1) {
        individualPayoffs[i] = globalPayoffs[choices[i]]/frequencies[choices[i]] + BoxMuller(0,sigmaIndividual);
      } else if (frequencies[choices[i]] == 1) {
        //individualPayoffs[i] = globalPayoffs[choices[i]];
        individualPayoffs[i] = Math.round(globalPayoffs[choices[i]] + BoxMuller(0,sigmaIndividual));
      }
      if (individualPayoffs[i] != 0) individualPayoffs[i] = Math.round(100*individualPayoffs[i])/100;
      if (individualPayoffs[i] < 0) individualPayoffs[i] = 0;
    }
  } else {
    // if condition == 1 i.e., additive condition
    for (let i = 0; i < choices.length; i++) {
      individualPayoffs[i] = Math.round(BoxMuller(payoffMeans[condition][choices[i]], sigmaIndividual));
      if (individualPayoffs[i] != 0) individualPayoffs[i] = Math.round(100*individualPayoffs[i])/100;
      if (individualPayoffs[i] < 0) individualPayoffs[i] = 0;
    }
  }

  return individualPayoffs;
}

// function generating a Gaussien random variable
exports.BoxMuller = function (m, sigma) {
    let a = 1 - Math.random();
    let b = 1 - Math.random();
    let c = Math.sqrt(-2 * Math.log(a));
    if(0.5 - Math.random() > 0) {
        return c * Math.sin(Math.PI * 2 * b) * sigma + m;
    }else{
        return c * Math.cos(Math.PI * 2 * b) * sigma + m;
    }
};
