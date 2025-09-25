# Docker MongoDB Setup

## Quick Start

1. Start MongoDB:
   ```bash
   npm run docker:up
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start the application:
   ```bash
   npm run dev
   ```

Or run everything at once:
```bash
npm run dev:full
```

## Database Structure

The MongoDB instance includes:
- **Database:** `collective_bandit_dev` (development)
- **Database:** `collective_bandit_test` (testing)
- **Main Collection:** `default_experiment` (behavioural data)
- **Schema:** See `models/behaviouralData.js`

## Viewing Data

Connect with MongoDB Compass or mongosh:
```bash
mongosh mongodb://localhost:27017/collective_bandit_dev
```

Common queries:
```javascript
// View all subjects
db.default_experiment.distinct("subjectID")

// Find data for a specific subject
db.default_experiment.find({ subjectID: "wataruDebug" })

// Count total records
db.default_experiment.countDocuments()

// View recent experiments
db.default_experiment.find().sort({ date: -1, time: -1 }).limit(10)
```

## Docker Commands

- `npm run docker:up` - Start MongoDB
- `npm run docker:down` - Stop MongoDB
- `npm run docker:logs` - View logs
- `npm run docker:clean` - Remove all data
- `npm run docker:shell` - Access MongoDB shell

## Troubleshooting

### MongoDB won't start
```bash
# Check if port 27017 is already in use
lsof -i :27017

# Stop any existing MongoDB processes
brew services stop mongodb-community
```

### Can't connect to MongoDB
```bash
# Check container status
docker ps

# View MongoDB logs
npm run docker:logs

# Restart MongoDB
npm run docker:down && npm run docker:up
```

### Data persistence
Data is stored in a Docker volume named `collective_bandit_mongodb_data`. To completely reset:
```bash
npm run docker:clean  # This removes all data permanently
```

## Collection Configuration

The collection name can be changed via environment variable:
```bash
# In your .env file
MONGODB_COLLECTION=my_custom_experiment
```

Default collection: `default_experiment`