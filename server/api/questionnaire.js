/*

Consent page
- In the background:
- give each participant a session ID
- assign each participant an unique "pay-off landscape" 
- 

*/
'use strict';

const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
 
	res.render('reloadedPage');

	/* DEBUGGING */
	//res.render('questionnaire', { title: 'Online experiment'} );
});

/* POST home page. */
router.post('/', function(req, res, next) {

	console.log('-- questionnaire.js launched: completed = '+req.body.completed);

	if (req.body.indivOrGroup === 1) {

		res.render('questionnaire', { 
			title: 'Online experiment',
			subjectID: req.body.subjectID,
			completed: req.body.completed,
			bonus_for_waiting: req.body.bonus_for_waiting,
			totalEarningInPence: req.body.totalEarningInPence,
			confirmationID: req.body.confirmationID,
			exp_condition: req.body.exp_condition,
			indivOrGroup: req.body.indivOrGroup,
			info_share_cost: req.body.info_share_cost,
			latency: req.body.latency
		}); 
	}

	else {
		
		res.render('questionnaire_indiv', { 
			title: 'Online experiment',
			subjectID: req.body.subjectID,
			completed: req.body.completed,
			bonus_for_waiting: req.body.bonus_for_waiting,
			totalEarningInPence: req.body.totalEarningInPence,
			confirmationID: req.body.confirmationID,
			exp_condition: req.body.exp_condition,
			indivOrGroup: req.body.indivOrGroup,
			info_share_cost: req.body.info_share_cost,
			latency: req.body.latency
		}); 
	}

		// get('/', function()~) you might wonder why '/' rather than 'questionnaire'? 
		// The path would lead the requester to the lower layer '/questionnaire/~'
		// So for example, if you want to have a debug mode, 
		// you can write '/debug' and put a function for debug
});

module.exports = router;
