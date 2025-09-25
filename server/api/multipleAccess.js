'use strict';

const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	res.render('multipleAccess');
});

/* POST home page. */
router.post('/', function(req, res, next) {

	res.render('multipleAccess');
	
});

module.exports = router;
