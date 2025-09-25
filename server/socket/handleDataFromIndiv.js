'use strict';
// ./modules/handleDataFromIndiv.js

const { createWorker } = require('../utils/helpers');

function handleDataFromIndiv(client, data) {
	console.log(' - Client ' + client.session + ' (subNo = ' + client.subjectNumber + ') ended the task.');
  
	for (let i = 0; i < data.length; i++) {
	  const worker = createWorker(
		'./worker_threads/savingBehaviouralData_indiv.js',
		data[i],
		client.session
	  );
	}
  }
  
  module.exports = { handleDataFromIndiv };