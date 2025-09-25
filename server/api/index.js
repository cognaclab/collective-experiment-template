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
		if(subjectIdList.indexOf(req.query.subjectID) == -1) {
			// inserting subjectID to the list
			subjectIdList.push(req.query.subjectID);
			// rendering
			if(flag == 1) {
				res.render('index', { 
					title: 'Online experiment',
					subjectID: req.query.subjectID,
					gameServerUrl: process.env.GAME_SERVER_URL || 'http://localhost:8181'
					}); //'index' = './views/index.ejs'
			} else {
				res.render('index_indiv', { 
					title: 'Online experiment',
					subjectID: req.query.subjectID,
					gameServerUrl: process.env.GAME_SERVER_URL || 'http://localhost:8181'
					}); //'index' = './views/index.ejs'
			}
		} else if (debugExceptions.indexOf(req.query.subjectID) > -1) {
			console.log('Accessed by debug ID: ' + req.query.subjectID);
			// rendering
			if(flag == 1) {
				res.render('index', { 
					title: 'Online experiment',
					subjectID: req.query.subjectID,
					gameServerUrl: process.env.GAME_SERVER_URL || 'http://localhost:8181'
					}); //'index' = './views/index.ejs'
			} else {
				res.render('index_indiv', { 
					title: 'Online experiment',
					subjectID: req.query.subjectID,
					gameServerUrl: process.env.GAME_SERVER_URL || 'http://localhost:8181'
					}); //'index' = './views/index.ejs'
			}
		} else {
			res.render('error', {
				title: 'Subject ID Already Used',
				errorMessage: 'This subject ID has already been used. Please use a different ID.',
				participant_id: req.query.subjectID,
				support_contact: 'btcc.cognac@gmail.com'
			});
			console.log('Accessed by an already-existing subjectID: ' + req.query.subjectID);
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

module.exports = router;

function weightedRand2 (spec) {
  var i, sum=0, r=Math.random();
  for (i in spec) {
    sum += spec[i];
    if (r <= sum) return i;
  }
}
