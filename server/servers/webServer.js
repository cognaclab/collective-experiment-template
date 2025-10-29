'use strict';

// Load environment variables
require('dotenv').config();

// Experimental variables
const flatFeeValue = 2.0 // GBP
, completionFeeValue = 0
;

// Loading modules
const logger = require('../utils/logger')
const experimentModeHandler = require('../middleware/templateMode')
const mainJsRouter = require('../middleware/mainJsRouter')
const Session = require('../database/models/Session')
const createError = require('http-errors')
, express = require('express')
, path = require('path')
, cookieParser = require('cookie-parser')
, morgan = require('morgan')
, session = require('express-session')
, bodyParser = require("body-parser")
, csv = require("fast-csv")
, fs = require('fs')
, app = express()
;

// Start csv recording
let myD = new Date()
, myYear = myD.getFullYear()
, myMonth = myD.getMonth() + 1
, myDate = myD.getUTCDate()
, myHour = myD.getUTCHours()
, myMin = myD.getUTCMinutes()
;
if(myMonth<10){myMonth = '0'+myMonth;}
if(myDate<10){myDate = '0'+myDate;}
if(myHour<10){myHour = '0'+myHour;}
if(myMin<10){myMin = '0'+myMin;}

var csvStream
, dataName = "collective_reward_exp"+'_'+myYear+myMonth+myDate+'_'+myHour+myMin
;

csvStream = csv.format({headers: true, quoteColumns: true});
csvStream
      .pipe(fs.createWriteStream(path.resolve(process.env.CSV_OUTPUT_DIR || "./data/csv/", dataName+'.csv')))
      .on("end", process.exit);

// Routings
const indexRouter = require('../api/index')
, usersRouter = require('../api/users')
, helloRouter = require('../api/hello')
, gameRouter = require('../api/game')
, questionnaireRouter = require('../api/questionnaire')
, questionnaireForDisconnectedSubjectsRouter = require('../api/questionnaireForDisconnectedSubjects')
, multipleAccessRouter = require('../api/multipleAccess')
;

// Making express object
//const app = express();

// view engine setup
app.set('views', path.join(__dirname, '../../client/views'));
app.set('view engine', 'ejs');

// app use
const session_opt = {
  secret: 'baden baden',
  resave: false,
  saveUninitialized: false,
  cookie: {maxAge: 30 * 60 * 1000}
};
app.use(session(session_opt));

// Experiment mode middleware (must be before routes)
app.use(experimentModeHandler.middleware());

// Main.js routing middleware (must be before static files)
app.use(mainJsRouter.middleware());

// HTTP request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logHttpRequest(req, res, duration);
  });
  next();
});
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../../client/public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Assigning routers to Routing
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/hello', helloRouter);
app.use('/game', gameRouter);
app.use('/questionnaire', questionnaireRouter);
app.use('/questionnaireForDisconnectedSubjects', questionnaireForDisconnectedSubjectsRouter);
app.use('/multipleAccess', multipleAccessRouter);

app.post('/endPage', function(req, res) {
  logger.info('End page submission', {
    subjectID: req.body.subjectID,
    totalEarning: req.body.totalEarning,
    exp_condition: req.body.exp_condition,
    indivOrGroup: req.body.indivOrGroup
  });
  
  let completionFee = 0; // no completion fee is paid when not completed
  //if (req.body.completed == 1) {
  if (req.body.totalEarning > 0) {
    completionFee = flatFeeValue + completionFeeValue;
  }
  let save_data = new Object();
  save_data.date = ''+myYear+myMonth+myDate+'_'+myHour+myMin;
  save_data.exp_condition = req.body.exp_condition;
  save_data.indivOrGroup = req.body.indivOrGroup;
  save_data.info_share_cost = req.body.info_share_cost;
  save_data.confirmationID = req.body.confirmationID;
  save_data.subjectID = req.body.subjectID;
  save_data.latency = req.body.latency;
  //save_data.bonus_for_waiting = req.body.bonus_for_waiting;
  //save_data.totalPayment = Math.round((parseInt(req.body.bonus_for_waiting)/100 + parseInt(req.body.totalEarning)/100 + 0.25)*100)/100;
  save_data.totalEarning = parseFloat(req.body.totalEarning).toFixed(2);//Math.round(parseInt(req.body.totalEarning))/100;
  save_data.bonus_for_waiting = Math.round(parseInt(req.body.bonus_for_waiting))/100;
  save_data.completionFee = completionFee;
  save_data.totalPayment = Math.round(10*(parseInt(req.body.bonus_for_waiting)/100 + parseFloat(req.body.totalEarning) + completionFee))/10;

  // if (req.body.completed == 1) {
  //   save_data.totalPayment = Math.round(10*(parseInt(req.body.bonus_for_waiting)/100 + parseFloat(req.body.totalEarning) + completionFee))/10;
  // } else {
  //   save_data.totalPayment = Math.round(10*(parseInt(req.body.bonus_for_waiting)/100 + parseFloat(req.body.totalEarning) + completionFee))/10;
  // }

  save_data.age = req.body.age;
  save_data.sex = req.body.sex;
  save_data.country = req.body.country;
  save_data.q1 = req.body.q1;
  save_data.q2 = req.body.q2;
  save_data.q3 = req.body.q3;
  save_data.q4 = req.body.q4;
  save_data.q5 = req.body.q5;
  csvStream.write(save_data);  // csvStream is defined in app.js

  logger.info('Data written to CSV', {
    subjectID: req.body.subjectID,
    totalPayment: save_data.totalPayment,
    confirmationID: req.body.confirmationID
  });

  // Update session record with completion data
  completeSessionRecord(req.body, save_data);
  // console.log('totalEarning = ' + Math.round(parseInt(req.body.totalEarning)));
  // console.log('bonus_for_waiting = ' + Math.round(parseInt(req.body.bonus_for_waiting))/100);
  // console.log('totalPayment = ' + Math.round(10*(parseInt(req.body.bonus_for_waiting)/100 + parseFloat(req.body.totalEarning) + completionFee))/10);
  //console.log(save_data);
  //console.log('save_data is: ');
  //console.log(save_data);

  res.render('endPage', { 
    title: 'Well done!',
    subjectID: req.body.subjectID,
    bonus_for_waiting: req.body.bonus_for_waiting,
    completionFee: completionFee,
    totalEarning: req.body.totalEarning,
    confirmationID: req.body.confirmationID,
    exp_condition: req.body.exp_condition,
    indivOrGroup: req.body.indivOrGroup,
    // info_share_cost: req.body.info_share_cost,
    latency: req.body.latency,
    age: req.body.age,
    sex: req.body.sex,
    country: req.body.country,
    q1: req.body.q1,
    q2: req.body.q2,
    q3: req.body.q3,
    q4: req.body.q4,
    q5: req.body.q5
  }); 
});
app.get('/endPage', function(req, res) {
  logger.info('End page GET accessed', {
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  res.render('endPage', {
    title: 'Experiment Complete',
    subjectID: 'N/A',
    bonus_for_waiting: 0,
    completionFee: 0,
    totalEarning: 0,
    confirmationID: 'N/A',
    exp_condition: 'N/A',
    indivOrGroup: 'N/A',
    latency: 0,
    age: 'N/A',
    sex: 'N/A',
    country: 'N/A',
    q1: 'N/A',
    q2: 'N/A',
    q3: 'N/A',
    q4: 'N/A',
    q5: 'N/A'
  });
});

// Handle favicon requests - return 204 (No Content)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  logger.error('Express error handler', {
    error: err.message,
    stack: err.stack,
    status: err.status || 500,
    url: req.originalUrl,
    method: req.method,
    userAgent: req.get('User-Agent')
  });

  // render the error page
  res.status(err.status || 500);
  res.render('error', {
    title: 'Error ' + (err.status || 500),
    message: res.locals.message,
    error: res.locals.error,
    errorMessage: res.locals.message,
    participant_id: 'Unknown',
    support_contact: 'btcc.cognac@gmail.com'
  });
});

/**
 * Complete session record when participant submits questionnaire
 * @param {Object} reqBody - Request body from questionnaire submission
 * @param {Object} saveData - Processed data object
 */
async function completeSessionRecord(reqBody, saveData) {
  try {
    const confirmationID = reqBody.confirmationID;

    // Find session by confirmationID (which maps to our client.session)
    // We need to find sessions where the sessionId contains this confirmationID
    const sessionQuery = {
      sessionId: { $regex: confirmationID }
    };

    const updateData = {
      endTime: new Date(),
      status: 'completed',
      'performance.finalPayment': saveData.totalPayment,
      'performance.waitingBonus': saveData.bonus_for_waiting * 100, // Convert back to pence
      'performance.totalPayoff': parseFloat(saveData.totalEarning),
      questionnaire: {
        age: reqBody.age,
        sex: reqBody.sex,
        country: reqBody.country,
        q1: reqBody.q1,
        q2: reqBody.q2,
        q3: reqBody.q3,
        q4: reqBody.q4,
        q5: reqBody.q5
      },
      'demographics.age': reqBody.age ? parseInt(reqBody.age) : null,
      'demographics.gender': reqBody.sex
    };

    // Calculate duration if we have startTime
    const session = await Session.findOne(sessionQuery);
    if (session && session.startTime) {
      const durationMs = new Date() - new Date(session.startTime);
      updateData.duration = durationMs;
    }

    const result = await Session.findOneAndUpdate(
      sessionQuery,
      { $set: updateData },
      { new: true }
    );

    if (result) {
      logger.info('Session completed and saved to database', {
        sessionId: result.sessionId,
        subjectId: reqBody.subjectID,
        finalPayment: saveData.totalPayment,
        duration: updateData.duration ? `${Math.round(updateData.duration / 1000)}s` : 'unknown'
      });
    } else {
      logger.warn('Session not found for completion update', {
        confirmationID: confirmationID,
        subjectID: reqBody.subjectID
      });
    }
  } catch (error) {
    logger.error('Failed to complete session record', {
      error: error.message,
      confirmationID: reqBody.confirmationID,
      subjectID: reqBody.subjectID
    });
  }
}

module.exports = app;
