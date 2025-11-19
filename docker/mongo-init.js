// Switch to the experiments database
db = db.getSiblingDB('collective_experiments');

// Create the collections with indexes for better performance
db.createCollection('experiments');
db.createCollection('sessions');
db.createCollection('trials');

// Add indexes for experiments collection
db.experiments.createIndex({ "experimentName": 1 }, { unique: true });

// Add indexes for sessions collection
db.sessions.createIndex({ "sessionId": 1 }, { unique: true });
db.sessions.createIndex({ "experimentName": 1 });
db.sessions.createIndex({ "subjectId": 1 });
db.sessions.createIndex({ "roomId": 1 });

// Add indexes for trials collection
db.trials.createIndex({ "experimentName": 1, "sessionId": 1 });
db.trials.createIndex({ "experimentName": 1, "roomId": 1 });

print('MongoDB initialized with collections and indexes for collective experiments platform');