// Switch to the development database
db = db.getSiblingDB('collective_bandit_dev');

// Create the collections that the app expects
db.createCollection('default_experiment');  // New default collection name
db.createCollection('behaviours');          // Standard collection name

// Add indexes for better query performance
db.default_experiment.createIndex({ "subjectID": 1 });
db.default_experiment.createIndex({ "confirmationID": 1 });
db.default_experiment.createIndex({ "date": 1, "time": 1 });

// Create test database
db = db.getSiblingDB('collective_bandit_test');
db.createCollection('default_experiment');
db.createCollection('behaviours');

print('MongoDB initialized with collections and indexes');