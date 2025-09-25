# Troubleshooting Guide

This guide helps you resolve common issues when setting up and running experiments.

## 🚨 Quick Fixes

### "Something's not working!"
1. Check server logs in your terminal
2. Check browser console (F12 → Console)
3. Try the basic example: `npm run example`
4. Restart everything: Kill terminals, `npm run docker:down`, `npm run docker:up`

## 🔧 Installation & Setup Issues

### ❌ "npm install" fails

**Symptoms:**
- Error messages during `npm install`
- Missing packages when running experiments

**Solutions:**
```bash
# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# If still failing, check Node.js version
node --version  # Should be v22+

# Update npm
npm install -g npm@latest
```

### ❌ "Cannot connect to database" / MongoDB issues

**Symptoms:**
- Database connection errors
- "MongoNetworkError" in logs
- Experiment data not saving

**Solutions:**
```bash
# Check if MongoDB is running
docker ps

# If not running, start it
npm run docker:up

# If still having issues, restart MongoDB
npm run docker:down
npm run docker:up

# Check MongoDB logs
npm run docker:logs

# Test MongoDB connection
npm run docker:shell
# Should open MongoDB shell
```

### ❌ "Port already in use" (EADDRINUSE)

**Symptoms:**
- "Error: listen EADDRINUSE :::8000"
- "Port 8181 is already in use"

**Solutions:**
```bash
# Kill processes on the ports
npx kill-port 8000 8181

# Or find and kill manually
lsof -ti:8000 | xargs kill -9
lsof -ti:8181 | xargs kill -9

# Alternative: Change ports in .env file
WEB_PORT=8001
GAME_PORT=8182
```

## 🌐 Browser & Client Issues

### ❌ Consent form buttons don't appear / don't work

**Symptoms:**
- No clickable consent buttons
- Buttons don't turn orange when clicked
- "GO TO THE TASK" button stays grayed out

**Solutions:**
```bash
# 1. Make sure you're using the example first
npm run example
# Visit: http://localhost:8000/?subjectID=test1

# 2. Check browser console for JavaScript errors (F12)
# 3. Try a different browser or incognito mode
# 4. Clear browser cache and cookies

# 5. If using generated experiments, regenerate templates
npm run generate
npm run experiment
```

### ❌ "Experiment doesn't start after consent"

**Symptoms:**
- Consent form works, but clicking "GO TO THE TASK" does nothing
- Page hangs or shows error

**Solutions:**
```bash
# Check that BOTH servers are running:
# Terminal should show both:
# - Web server on port 8000
# - Game server on port 8181

# If only one is running:
# Kill everything (Ctrl+C)
# Restart with: npm run example

# Check .env file has correct URLs:
GAME_SERVER_URL=http://localhost:8181
```

### ❌ "Waiting for participants" never ends

**Symptoms:**
- Stuck on waiting screen
- Timer counts down but nothing happens
- Individual experiments should skip this

**Solutions:**
```bash
# For group experiments - open multiple tabs:
http://localhost:8000/?subjectID=player1
http://localhost:8000/?subjectID=player2
http://localhost:8000/?subjectID=player3

# For individual experiments - check config.yaml:
groups:
  max_group_size: 1
  min_group_size: 1

conditions:
  indivOrGroup: individual

# Use debug subject IDs to skip waiting:
http://localhost:8000/?subjectID=test1
```

## ⚙️ Generation & Template Issues

### ❌ "npm run generate" fails

**Symptoms:**
- Error during template generation
- "Cannot read property" errors
- Generated files missing or corrupted

**Solutions:**
```bash
# Check experiment directory structure
ls content/experiments/my-experiment/
# Should have: config.yaml, sequences/, instructions/

# Check YAML syntax
# Use proper indentation (spaces, not tabs)
# Quote special characters

# Regenerate from a working example
npm run generate quick-test
# If this works, compare with your experiment
```

### ❌ Generated templates look wrong / missing content

**Symptoms:**
- Generated pages don't match your markdown
- Missing conditional content
- Form elements not working

**Solutions:**
```bash
# Check markdown syntax in instructions/*.md files
# Make sure you're using correct template syntax:

# Conditional blocks:
{if condition="group"}...{/if}

# Form elements:
{input: name, text, "Question", required}

# Regenerate templates
npm run generate my-experiment
```

### ❌ "Template not found" / "View not found"

**Symptoms:**
- Express template errors
- "Error: Failed to lookup view"

**Solutions:**
```bash
# Check that generated files exist
ls client/views/generated/

# If missing, regenerate
npm run generate

# Check sequences/main.yaml for correct scene types
# Should be: "instruction", "game", "questionnaire"
```

## 🎮 Experiment Runtime Issues

### ❌ Experiment crashes during gameplay

**Symptoms:**
- Game stops responding mid-experiment
- JavaScript errors during choices
- Participants get disconnected

**Solutions:**
```bash
# Check server logs for errors
# Common issues:

# 1. Database connection lost
npm run docker:up

# 2. Invalid choice data
# Check browser console for client errors

# 3. Socket.io connection issues
# Make sure gameServer is running on port 8181
```

### ❌ Data not being saved

**Symptoms:**
- Completed experiments don't appear in database
- CSV exports are empty
- Participant responses lost

**Solutions:**
```bash
# Check MongoDB is running and accessible
npm run docker:shell
use collective_bandit_dev
db.behaviouraldatas.find().count()

# Check experiment completion
# Participants must complete questionnaire for data to save

# Check for JavaScript errors preventing submission
# F12 → Console in browser
```

### ❌ Multiple participants can't join the same group

**Symptoms:**
- Second participant can't connect
- "Subject ID already used" error
- Group formation fails

**Solutions:**
```bash
# Use different subject IDs for each participant:
# ✅ Good:
http://localhost:8000/?subjectID=alice
http://localhost:8000/?subjectID=bob

# ❌ Bad:
http://localhost:8000/?subjectID=test1  # both same ID
http://localhost:8000/?subjectID=test1

# Use debug IDs that allow replay:
# (defined in config.yaml debug.subject_exceptions)
http://localhost:8000/?subjectID=test1
http://localhost:8000/?subjectID=test2
http://localhost:8000/?subjectID=test3
```

## 📁 File & Configuration Issues

### ❌ "Module not found" / Import errors

**Symptoms:**
- "Cannot resolve module" errors
- Missing file errors in browser console

**Solutions:**
```bash
# Clear generated files and regenerate
rm -rf client/public/src/generated/
npm run generate

# Clear browser cache
# Hard reload: Ctrl+Shift+R (Chrome/Firefox)
```

### ❌ Config.yaml validation errors

**Symptoms:**
- Generation fails with YAML errors
- "Unexpected token" or syntax errors

**Solutions:**
```yaml
# Common YAML mistakes:

# ❌ Using tabs (use spaces)
experiment:
	name: "Bad"  # Tab used

# ✅ Using spaces
experiment:
  name: "Good"  # 2 spaces

# ❌ Inconsistent indentation
groups:
  max_group_size: 5
 min_group_size: 2  # Wrong indentation

# ✅ Consistent indentation
groups:
  max_group_size: 5
  min_group_size: 2

# ❌ Unquoted special characters
experiment:
  name: My: Awesome Study!  # Colon needs quotes

# ✅ Quoted special characters
experiment:
  name: "My: Awesome Study!"
```

## 🔍 Debugging Tips

### Check Server Logs
```bash
# Look for error messages in terminal where you ran npm command
# Common errors:
# - Database connection failures
# - File not found errors
# - Port binding issues
```

### Check Browser Console
```bash
# In browser: F12 → Console tab
# Look for red error messages
# Common errors:
# - JavaScript syntax errors
# - Failed network requests
# - Missing files
```

### Test with Simple Examples
```bash
# Always test with working example first
npm run example
# If this works, the problem is in your experiment

# Try the minimal test
npm run generate quick-test
npm run experiment
```

### Isolate the Problem
```bash
# Test components separately:

# 1. Test generation only
npm run generate my-experiment
# Check for errors

# 2. Test web server only
npm run dev:web:example
# Visit http://localhost:8000

# 3. Test database only
npm run docker:shell
# Should open MongoDB shell
```

## 🆘 Getting Help

### Before Asking for Help
1. **Try the simple example** - `npm run example`
2. **Check this troubleshooting guide** - Look for your specific error
3. **Collect error information**:
   - What command did you run?
   - What error message appeared?
   - What were you trying to do?
   - Screenshot of the error

### What Information to Include
```bash
# System information
node --version
npm --version
docker --version

# Error logs
# Copy the full error message from terminal
# Copy browser console errors (F12 → Console)

# Your files
# Share your config.yaml
# Share relevant instruction files
# Describe what you changed recently
```

### Where to Get Help
- **Lab colleagues** - They may have seen similar issues
- **GitHub Issues** - Report bugs and get support
- **Documentation** - Check other guide files
- **Stack Overflow** - For technical Node.js/MongoDB issues

## 💡 Prevention Tips

### Best Practices
1. **Test frequently** - After every major change
2. **Use version control** - Git commit before making changes
3. **Start small** - Begin with working examples
4. **Keep backups** - Copy working experiments before modifying
5. **Read error messages** - They usually tell you exactly what's wrong

### Development Workflow
```bash
# Recommended workflow:
1. Copy working example
2. Make small change
3. Test immediately: npm run generate && npm run experiment
4. If broken, undo change and try differently
5. Repeat until working
6. Make next small change
```

Remember: Most issues are simple mistakes that are easy to fix once you know what to look for! 🎯