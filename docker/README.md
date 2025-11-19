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
- **Database:** `collective_experiments` (single database for all experiments)
- **Collections:**
  - `experiments` - Experiment metadata and configuration
  - `sessions` - Per-participant session data
  - `trials` - Trial-level choice and outcome data

## Viewing Data

Connect with MongoDB Compass or mongosh:
```bash
mongosh mongodb://localhost:27017/collective_experiments
```

Or use the npm script:
```bash
npm run db:shell
```

Common queries:
```javascript
// List all experiments
db.experiments.find({}, { experimentName: 1, status: 1 })

// View sessions for an experiment
db.sessions.find({ experimentName: "Quick Test" })

// View trials for a specific session
db.trials.find({ sessionId: "your-session-id" })

// Count total trials
db.trials.countDocuments()

// View recent trials
db.trials.find().sort({ timestamp: -1 }).limit(10)
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
Data is stored in a Docker volume named `collective_exp_mongodb_data`. To completely reset:
```bash
npm run docker:clean  # This removes all data permanently
```

## Database Configuration

The database name is configured via environment variable:
```bash
# In your .env file
MONGODB_URI=mongodb://localhost:27017/collective_experiments
```

All experiments share the same database. Individual experiment data is differentiated by the `experimentName` field in each collection.