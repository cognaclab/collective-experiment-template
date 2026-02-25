'use strict';

const express = require('express');
const router = express.Router();
const { debugExceptions } = require('../../config/constants');
const subjectIdList = [];

/* GET home page. */
// router.get('/', function(req, res, next) {
// 	res.render('reloadedPage', {
// 		title: 'Questionnaire',
// 		amazonID: 'reloaded',
// 		bonus_for_waiting: 0,
// 		totalEarning: 0,
// 		exp_condition: -1,
// 		indivOrGroup: -1,
// 		confirmationID: 'ZZZ-RELOADED',
// 		completed: 0
// 		}); //'index' = './views/index.ejs'
// });

// router.get('/javascripts/CircleSpin', function(req, res, next) {
// 	res.sendFile('../public/javascripts/CircleSpin.js', { root: __dirname });
// });

/* GET handler for direct access and page refreshes */
router.get('/', function(req, res, next) {
	if(req.query.subjectID) {
		const subjectID = req.query.subjectID;
		const studyID = req.query.studyID || '';
		const prolificSessionID = req.query.prolificSessionID || '';

		const templateData = {
			title: 'Collective Reward Experiment',
			subjectID: subjectID,
			studyID: studyID,
			prolificSessionID: prolificSessionID
		};

		// Allow debug exceptions (can be reused multiple times)
		if(debugExceptions.indexOf(subjectID) > -1) {
			res.render('game', templateData);
		}
		// Allow if already registered via POST or previous GET
		else if(subjectIdList.indexOf(subjectID) > -1) {
			res.render('game', templateData);
		}
		// Allow new IDs via direct GET access (register them first)
		else {
			subjectIdList.push(subjectID);
			console.log('New subject registered via GET: ' + subjectID);
			res.render('game', templateData);
		}
	} else {
		// No subjectID provided - show error
		res.status(400).send('Subject ID required. Please access this experiment through the consent form.');
	}
});


/* POST home page. */
router.post('/', function(req, res, next) {
	if(typeof req.body.subjectID != 'undefined') {
		// Build redirect URL preserving all Prolific params
		const params = new URLSearchParams();
		params.set('subjectID', req.body.subjectID);
		if (req.body.studyID) params.set('studyID', req.body.studyID);
		if (req.body.prolificSessionID) params.set('prolificSessionID', req.body.prolificSessionID);
		const redirectUrl = '/?' + params.toString();

		if(subjectIdList.indexOf(req.body.subjectID) == -1) {
			subjectIdList.push(req.body.subjectID);
			res.redirect(redirectUrl);
		} else if (debugExceptions.indexOf(req.body.subjectID) > -1) {
			console.log('Accessed by debug ID: ' + req.body.subjectID);
			res.redirect(redirectUrl);
		} else {
			res.render('multipleAccess');
			console.log('Accessed by an already-existing ID: ' + req.body.subjectID);
		}
	} else {
		res.redirect('https://www.prolific.co/');
	}
		// get('/', function()~) you might wonder why '/' rather than 'questionnaire'? 
		// The path would lead the requester to the lower layer '/questionnaire/~'
		// So for example, if you want to have a debug mode, 
		// you can write '/debug' and put a function for debug
});

/* GET home page. */
/*router.get('/', function(req, res, next) {
	const data = {
		title: 'Game!'
	};
	res.render('game', data);
});*/

module.exports = router;
