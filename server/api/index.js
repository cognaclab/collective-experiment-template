'use strict';

require('dotenv').config();

const express = require('express');
const router = express.Router();
const browser = require('browser-detect');
const { debugExceptions } = require('../../config/constants');
const { extractProlificParams } = require('../utils/prolificParams');

const subjectIdList = [];
const prob_indiv = 0;

router.get('/', function(req, res, next) {
	const { subjectID, studyID, prolificSessionID } = extractProlificParams(req.query);
	const flag = weightedRand2({0: prob_indiv, 1: (1 - prob_indiv)});

	if (!subjectID) {
		res.render('error', {
			title: 'Missing Subject ID',
			errorMessage: 'To access this experiment, a subject ID must be submitted.',
			participant_id: 'Not provided',
			support_contact: 'btcc.cognac@gmail.com'
		});
		return;
	}

	if (debugExceptions.indexOf(subjectID) > -1) {
		console.log('Accessed by debug ID: ' + subjectID);
		renderConsentForm(res, flag, { subjectID, studyID, prolificSessionID });
		return;
	}

	if (subjectIdList.indexOf(subjectID) > -1) {
		res.render('error', {
			title: 'Subject ID Already Used',
			errorMessage: 'This subject ID has already been used. Please use a different ID.',
			participant_id: subjectID,
			support_contact: 'btcc.cognac@gmail.com',
			showCompensationInfo: false
		});
		console.log('Blocked duplicate subjectID: ' + subjectID);
		return;
	}

	subjectIdList.push(subjectID);
	console.log('New subject registered: ' + subjectID);
	renderConsentForm(res, flag, { subjectID, studyID, prolificSessionID });
});

function renderConsentForm(res, flag, params) {
	const template = flag == 1 ? 'index' : 'index_indiv';
	res.render(template, {
		title: 'Online experiment',
		subjectID: params.subjectID,
		studyID: params.studyID,
		prolificSessionID: params.prolificSessionID,
		gameServerUrl: process.env.GAME_SERVER_URL || 'http://localhost:8181'
	});
}

function weightedRand2(spec) {
	let sum = 0;
	const r = Math.random();
	for (const i in spec) {
		sum += spec[i];
		if (r <= sum) return i;
	}
}

module.exports = router;
