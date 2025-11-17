const winston = require('winston');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Ensure logs directory exists
const logDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'data', 'logs');
require('fs').mkdirSync(logDir, { recursive: true });

// Get log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'collective-experiment' },
  transports: [
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error' 
    }),
    // Write all logs to 'combined.log'
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log') 
    }),
    // Write debug logs to separate file
    new winston.transports.File({ 
      filename: path.join(logDir, 'debug.log'), 
      level: 'debug' 
    })
  ]
});

// In development, also log to console with simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for common logging patterns
logger.logConnection = (event, data) => {
  logger.info('Socket connection event', {
    event,
    socketId: data.socketId,
    subjectID: data.subjectID,
    timestamp: new Date().toISOString()
  });
};

logger.logGameEvent = (event, data) => {
  logger.info('Game event', {
    event,
    subjectID: data.subjectID,
    roomId: data.roomId,
    data: data.payload,
    timestamp: new Date().toISOString()
  });
};

logger.logDatabaseOperation = (operation, collection, data) => {
  logger.debug('Database operation', {
    operation,
    collection,
    data: JSON.stringify(data, null, 2),
    timestamp: new Date().toISOString()
  });
};

logger.logHttpRequest = (req, res, duration) => {
  logger.info('HTTP request', {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userAgent: req.get('User-Agent'),
    subjectID: req.body?.subjectID || req.query?.subjectID,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;