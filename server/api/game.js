'use strict';

const express = require('express');
const router = express.Router();
const { debugExceptions } = require('../../config/constants');
const { extractProlificParams } = require('../utils/prolificParams');

const subjectIdList = [];

/* GET handler for direct access and page refreshes */
router.get('/', function(req, res, next) {
	const { subjectID, studyID, prolificSessionID } = extractProlificParams(req.query);

	if (!subjectID) {
		res.status(400).send('Subject ID required. Please access this experiment through the consent form.');
		return;
	}

	// Register new (non-debug) subject IDs
	if (debugExceptions.indexOf(subjectID) === -1 && subjectIdList.indexOf(subjectID) === -1) {
		subjectIdList.push(subjectID);
		console.log('New subject registered via GET: ' + subjectID);
	}

	res.render('game', {
		title: 'Collective Reward Experiment',
		subjectID: subjectID,
		studyID: studyID,
		prolificSessionID: prolificSessionID
	});
});

/* POST handler for consent form submission */
router.post('/', function(req, res, next) {
	const subjectID = req.body.subjectID;

	if (!subjectID) {
		res.redirect('https://www.prolific.co/');
		return;
	}

	// Build redirect URL preserving all Prolific params
	const params = new URLSearchParams();
	params.set('subjectID', subjectID);
	if (req.body.studyID) params.set('studyID', req.body.studyID);
	if (req.body.prolificSessionID) params.set('prolificSessionID', req.body.prolificSessionID);
	const redirectUrl = '/?' + params.toString();

	if (subjectIdList.indexOf(subjectID) === -1) {
		subjectIdList.push(subjectID);
		res.redirect(redirectUrl);
	} else if (debugExceptions.indexOf(subjectID) > -1) {
		console.log('Accessed by debug ID: ' + subjectID);
		res.redirect(redirectUrl);
	} else {
		res.render('multipleAccess');
		console.log('Accessed by an already-existing ID: ' + subjectID);
	}
});

module.exports = router;
