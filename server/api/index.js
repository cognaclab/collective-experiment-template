/*

Consent page
- In the background:
- give each participant a session ID
- assign each participant an unique "pay-off landscape" 
- 

*/
'use strict';

// Load environment variables
require('dotenv').config();

const express = require('express');
const router = express.Router();
const browser = require('browser-detect');
const { debugExceptions } = require('../../config/constants');
const subjectIdList = [];
const prob_indiv = 0;//0.05; // One of five individuals (on average) will go directly to the individual condition

/* GET home page. */
router.get('/', function(req, res, next) {
	let flag = 1;
	flag = weightedRand2({0:prob_indiv, 1:(1-prob_indiv)});
	if(typeof req.query.subjectID != 'undefined') {
		const subjectID = req.query.subjectID;

		// Allow debug exceptions (can be reused multiple times)
		if (debugExceptions.indexOf(subjectID) > -1) {
			console.log('Accessed by debug ID: ' + subjectID);
			renderConsentForm(res, flag, subjectID);
		}
		// Block if ID already used (not a debug exception)
		else if (subjectIdList.indexOf(subjectID) > -1) {
			res.render('error', {
				title: 'Subject ID Already Used',
				errorMessage: 'This subject ID has already been used. Please use a different ID.',
				participant_id: subjectID,
				support_contact: 'btcc.cognac@gmail.com',
				showCompensationInfo: false
			});
			console.log('Blocked duplicate subjectID: ' + subjectID);
		}
		// Allow new IDs (register them first)
		else {
			subjectIdList.push(subjectID);
			console.log('New subject registered: ' + subjectID);
			renderConsentForm(res, flag, subjectID);
		}
	} else {
		res.render('error', {
			title: 'Missing Subject ID',
			errorMessage: 'To access this experiment, a subject ID must be submitted.',
			participant_id: 'Not provided',
			support_contact: 'btcc.cognac@gmail.com'
		});
	}
});

function renderConsentForm(res, flag, subjectID) {
	const template = flag == 1 ? 'index' : 'index_indiv';
	res.render(template, {
		title: 'Online experiment',
		subjectID: subjectID,
		gameServerUrl: process.env.GAME_SERVER_URL || 'http://localhost:8181'
	});
}

module.exports = router;

function weightedRand2 (spec) {
  var i, sum=0, r=Math.random();
  for (i in spec) {
    sum += spec[i];
    if (r <= sum) return i;
  }
}
