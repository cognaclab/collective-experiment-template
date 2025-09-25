'use strict';

const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
	const data = {
		title: 'Hello!',
		content: 'This is a sample content. <br /> Have fun!'
	};
	res.render('hello', data);
});

module.exports = router;
