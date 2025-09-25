# Deployment Guide

This guide helps you deploy your experiment for real data collection with participants.

⚠️ **Important**: Only deploy experiments that you've thoroughly tested locally!

## 🎯 Deployment Overview

### Local Development vs Production

| Aspect | Local Development | Production Deployment |
|--------|-------------------|---------------------|
| **URL** | http://localhost:8000 | https://your-domain.com |
| **Database** | Docker MongoDB | Hosted MongoDB (Atlas/VPS) |
| **Participants** | You (testing) | Real participants |
| **Data** | Test data | Real research data |
| **Reliability** | Can crash/restart | Must be stable |
| **Security** | Not critical | Very important |

## 🏗️ Pre-Deployment Checklist

### ✅ Test Your Experiment Thoroughly
```bash
# 1. Test individual participation
npm run example
# Visit: http://localhost:8000/?subjectID=test1

# 2. Test group formation (open multiple tabs)
http://localhost:8000/?subjectID=alice
http://localhost:8000/?subjectID=bob
http://localhost:8000/?subjectID=carol

# 3. Complete full experiment workflow
# - Consent → Waiting → Tutorial → Main task → Survey → Thank you

# 4. Check data collection
npm run docker:shell
use collective_bandit_dev
db.behaviouraldatas.find().pretty()

# 5. Test different browsers and devices
```

### ✅ Prepare Your Configuration

#### Update .env for Production
```bash
# Copy your current .env
cp .env .env.production

# Edit for production
nano .env.production
```

```bash
# Production Environment Configuration

# Application URLs - UPDATE THESE!
APP_URL=https://your-experiment.university.edu
GAME_SERVER_URL=https://your-experiment.university.edu:8181

# Server Ports (may need to change for your server)
WEB_PORT=8000
GAME_PORT=8181

# Database - USE HOSTED DATABASE, NOT DOCKER!
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/your_experiment
MONGODB_COLLECTION=your_experiment_data

# Security - GENERATE NEW SECRET!
SESSION_SECRET=your-super-secure-random-string-here

# Production settings
NODE_ENV=production
LOG_LEVEL=info

# Data storage
DATA_DIR=./data
CSV_OUTPUT_DIR=./data/csv
LOG_DIR=./data/logs
```

#### Secure Your Configuration
```bash
# Generate a secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Use this output as your SESSION_SECRET
```

## 🗃️ Database Setup

### Option 1: MongoDB Atlas (Cloud - Recommended)
```bash
# 1. Sign up at https://cloud.mongodb.com
# 2. Create a free cluster
# 3. Create database user
# 4. Get connection string
# 5. Update MONGODB_URI in .env.production
```

Example connection string:
```
mongodb+srv://username:password@cluster0.abc123.mongodb.net/your_experiment_name
```

### Option 2: VPS MongoDB
```bash
# Install MongoDB on your VPS
sudo apt update
sudo apt install mongodb-community

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Update connection string
MONGODB_URI=mongodb://localhost:27017/your_experiment_name
```

## 🚀 Deployment Steps

### Step 1: Prepare Your Server

#### Install Dependencies
```bash
# Node.js (v22+)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (process manager)
sudo npm install -g pm2

# Git (if not installed)
sudo apt update
sudo apt install git
```

#### Upload Your Code
```bash
# Option A: Git clone
git clone https://github.com/your-lab/your-experiment.git
cd your-experiment

# Option B: Upload files directly
scp -r your-experiment/ username@your-server.com:~/

# Install dependencies
npm install --production
```

### Step 2: Configure for Production

```bash
# Copy your production environment file
cp .env.production .env

# Generate your experiment templates
npm run generate your-experiment-name

# Test the build
NODE_ENV=production npm run experiment
```

### Step 3: Start with PM2

```bash
# Start web server
pm2 start server/servers/www --name "experiment-web" --env production

# Start game server
pm2 start server/servers/gameServer.js --name "experiment-game" --env production

# Check status
pm2 list

# View logs
pm2 logs

# Save PM2 configuration
pm2 save
pm2 startup  # Follow the instructions shown
```

### Step 4: Configure Web Server (Optional)

If using Apache or Nginx:

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-experiment.university.edu;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-experiment.university.edu;

    # SSL configuration (get certificates from your IT department)
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket connections for game server
    location /socket.io/ {
        proxy_pass http://localhost:8181;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🔒 Security Considerations

### Environment Security
```bash
# Secure your .env file
chmod 600 .env

# Never commit .env to git
echo ".env" >> .gitignore

# Use strong session secrets
# Use HTTPS in production
# Restrict database access
```

### Participant Data Protection
- **Anonymize data** - Remove identifying information immediately
- **Secure transmission** - Use HTTPS for all communication
- **Access control** - Limit who can access the server
- **Data retention** - Have a plan for data storage and deletion
- **Compliance** - Follow your institution's data protection policies

## 📊 Monitoring Your Experiment

### Check System Health
```bash
# Check server status
pm2 list
pm2 monit

# Check logs
pm2 logs experiment-web --lines 50
pm2 logs experiment-game --lines 50

# Check disk space
df -h

# Check memory usage
free -h
```

### Monitor Participants
```bash
# Check database for new participants
mongo your_database
db.behaviouraldatas.find().count()
db.behaviouraldatas.find().sort({_id: -1}).limit(10)

# Export data regularly
mongoexport --uri="your_connection_string" \
  --collection=behaviouraldatas \
  --type=csv \
  --out=backup_$(date +%Y%m%d).csv
```

### Set Up Alerts
```bash
# PM2 monitoring (optional)
pm2 install pm2-server-monit
pm2 monitor your_secret_key

# Email alerts for server issues
# (Configure with your IT department)
```

## 🐛 Production Debugging

### Common Production Issues

#### "Site can't be reached"
```bash
# Check if services are running
pm2 list

# Check if ports are open
sudo netstat -tlnp | grep :8000
sudo netstat -tlnp | grep :8181

# Check firewall
sudo ufw status
```

#### "Database connection failed"
```bash
# Test database connection
mongo "your_connection_string"

# Check network access
ping your-database-host.com

# Verify credentials in .env
```

#### "Experiments not loading"
```bash
# Check Node.js logs
pm2 logs experiment-web

# Verify file permissions
ls -la client/views/generated/

# Check if templates were generated
npm run generate your-experiment
```

### Emergency Procedures

#### Restart Everything
```bash
pm2 restart all
```

#### Roll Back to Previous Version
```bash
# If you have git history
git log --oneline
git checkout previous_commit_hash
npm run generate your-experiment
pm2 restart all
```

#### Emergency Shutdown
```bash
pm2 stop all
# Fix the issue
pm2 start all
```

## 📈 Scaling for Large Studies

### For 100+ Participants
- Monitor server performance
- Consider database indexing
- Use database connection pooling
- Set up automatic backups

### For 500+ Participants
- Consider load balancing
- Use dedicated database server
- Implement monitoring and alerts
- Have a backup plan

### For 1000+ Participants
- Use cloud hosting (AWS, Google Cloud)
- Implement auto-scaling
- Use CDN for static assets
- Have 24/7 monitoring

## ✅ Post-Deployment Checklist

### Before Launching
- [ ] Test complete experiment flow on production server
- [ ] Verify data is being saved correctly
- [ ] Test with multiple simultaneous participants
- [ ] Check all pages load correctly
- [ ] Verify payment/completion process works
- [ ] Have backup plan for server issues

### During Data Collection
- [ ] Monitor server resources daily
- [ ] Check for error logs
- [ ] Verify participants are completing successfully
- [ ] Back up data regularly
- [ ] Monitor completion rates

### After Data Collection
- [ ] Export all data
- [ ] Verify data integrity
- [ ] Secure/anonymize participant data
- [ ] Document any issues encountered
- [ ] Plan for data retention/deletion

## 📞 Getting Help

### Technical Issues
- Check server logs first
- Contact your IT department
- Use platform-specific support (Heroku, AWS, etc.)

### Research Issues
- Lab colleagues who have deployed before
- University research computing services
- Ethics board for data protection questions

Remember: Deployment is a big step! Start small, test thoroughly, and have support ready. 🎯