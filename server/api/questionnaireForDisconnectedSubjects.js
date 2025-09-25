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
	if(typeof req.query.confirmationID!='undefined') {
		res.render('questionnaireForDisconnectedSubjects', { 
			title: 'Online experiment',
			subjectID: req.query.subjectID,
			completed: req.query.completed,
			bonus_for_waiting: req.query.bonus_for_waiting,
			totalEarningInPence: req.query.totalEarningInPence,
			confirmationID: req.query.confirmationID,
			exp_condition: req.query.exp_condition,
			indivOrGroup: req.query.indivOrGroup,
			info_share_cost: req.query.info_share_cost,
			latency: req.query.latency
		});  
	} else {
		res.render('reloadedPage');
		/*res.render('questionnaireForDisconnectedSubjects', { 
			title: 'Online experiment',
			subjectID: req.query.subjectID,
			completed: 0,
			bonus_for_waiting: req.query.bonus_for_waiting,
			totalEarning: req.query.totalEarning,
			confirmationID: 0,
			indivOrGroup: req.query.indivOrGroup,
			exp_condition: req.query.exp_condition
		}); */ 
	}
});

/* POST home page. */
/*router.post('/', function(req, res, next) {
	res.render('questionnaire', { 
		title: 'Online experiment',
		subjectID: req.body.subjectID,
		bonus_for_waiting: req.body.bonus_for_waiting,
		totalGamePayoff: req.body.totalGamePayoff,
		experimentalID: req.body.experimentalID,
		exp_condition: req.body.exp_condition
	}); 
		// get('/', function()~) you might wonder why '/' rather than 'questionnaire'? 
		// The path would lead the requester to the lower layer '/questionnaire/~'
		// So for example, if you want to have a debug mode, 
		// you can write '/debug' and put a function for debug
});*/

module.exports = router;
