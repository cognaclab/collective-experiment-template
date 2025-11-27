/**
 * Questionnaire Route Handler
 * Routes to the appropriate questionnaire template based on experiment mode
 */
'use strict';

const express = require('express');
const router = express.Router();

/* GET - redirect to reloaded page (prevents direct access) */
router.get('/', function(req, res, next) {
	res.render('reloadedPage');
});

/* POST - render questionnaire after game completion */
router.post('/', function(req, res, next) {
	console.log('-- questionnaire.js launched: completed = ' + req.body.completed);

	const templateData = {
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
	};

	// In generated/deployed mode, use the unified questionnaire template
	// In example mode, use the legacy group/individual templates
	const experimentType = process.env.EXPERIMENT_TYPE || 'example';

	if (experimentType === 'generated' || experimentType === 'deployed') {
		// Use the new config-driven questionnaire template
		res.render('questionnaire', templateData);
	} else {
		// Legacy example mode: use separate group/individual templates
		if (req.body.indivOrGroup === 1) {
			res.render('questionnaire', templateData);
		} else {
			res.render('questionnaire_indiv', templateData);
		}
	}
});

module.exports = router;
