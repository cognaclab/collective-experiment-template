# Collective Cognitive Behavior Experiment Platform

[![Node.js](https://img.shields.io/badge/Node.js-v22.15.0-blue.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.0.9-green.svg)](https://www.mongodb.com/)
[![Mongosh](https://img.shields.io/badge/Mongosh-2.5.1-lightgrey.svg)](https://www.mongodb.com/docs/mongodb-shell/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

A **template-based platform** for creating online collective cognitive behavior experiments. Researchers can build custom experiments using simple Markdown and YAML files, without coding. The system generates interactive web-based experiments with real-time multiplayer functionality.

**Default Experiment**: A 'collective reward' multi-player bandit task where a group of players each chooses a bandit option, and only the total sum of payoffs is shown as feedback (individual payoffs are not available).

---

## 🎯 Key Features

✨ **Template-Based Design**: Create experiments using Markdown files and YAML configuration  
🚫 **No Coding Required**: Researchers edit content, not JavaScript  
🔄 **Conditional Content**: Dynamic text that adapts to experimental conditions  
👥 **Real-Time Multiplayer**: Preserved collective behavior functionality  
⚡ **Automatic Generation**: From content files to running experiments  
🎮 **Phaser Integration**: Combines simple content with complex game mechanics  

---

## 📝 Creating Your Own Experiment

**Quick Start**: Copy the template, edit content, generate, and test!

```bash
# 1. Copy the template experiment
cp -r content/experiments/default content/experiments/my-experiment

# 2. Edit your content files (see INSTRUCTIONS.md for details)
# Edit: config.yaml, sequences/main.yaml, instructions/*.md

# 3. Generate JavaScript from your content  
npm run scenes:generate

# 4. Test your experiment
npm run dev:web
# Visit http://localhost:8000
```

📖 **Detailed Guide**: See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for complete step-by-step instructions.

---

## 🚀 Quick Start & Development

### Development Mode (Recommended)

```bash
# Install dependencies
npm install

# Start development with automatic scene generation
npm run dev
# This runs: scenes:watch + dev:web + dev:game

# Or start components separately:
npm run scenes:generate    # Generate scenes from content
npm run scenes:watch       # Watch content changes  
npm run dev:web           # Start web server
npm run dev:game          # Start game server
```

### Production Mode

```bash
# Start the applications with PM2
pm2 start bin/www --name collective_reward_static --log ../logs --time --max-memory-restart 1G
pm2 start gameServer.js --name collective_reward_game
```

### Restart the Applications

```bash
pm2 restart collective_reward_static --log ../logs --time --max-memory-restart 1G
pm2 restart collective_reward_game --log ./logs --time --max-memory-restart 9G --node-args="--expose-gc"
```


---

## 🧪 Experiment Architecture Overview

This web-based behavioral experiment system combines a **template-driven content system** with a robust real-time multiplayer architecture. Below is a breakdown of its core components:

### 🎨 Scene Template System (New)

- **Content-Driven Design**  
  Experiments are defined using Markdown files (`instructions/*.md`) and YAML configuration (`config.yaml`, `sequences/main.yaml`). No JavaScript coding required for basic experiments.

- **Conditional Content Engine**  
  Dynamic text rendering based on experimental conditions (group vs. individual, static vs. dynamic environments) using simple `{if condition="group"}` syntax in Markdown.

- **Automatic Code Generation**  
  The scene generator (`scripts/generate-scenes.js`) converts Markdown content into Phaser.js scene classes, bridging researcher-friendly content with technical implementation.

- **Hybrid Architecture**  
  Simple instruction/text scenes use the template system, while complex interactive scenes (gameplay, tutorials) remain as custom Phaser code, providing both ease-of-use and flexibility.

### 🖥️ Server-Side (Real-Time Game Management)

- **Node.js + Express + Socket.IO**  
  The backend is implemented in `gameServer.js`, using Express for routing and static file serving, and Socket.IO for handling real-time communication with clients.

- **Group Formation Logic**  
  Participants are automatically assigned to experimental "rooms" upon joining. A room stays open until it reaches a defined `maxGroupSize` (e.g., 10 participants) or until it reaches a `maxWaitingTime`, whichever earlier. Once full, a new room is dynamically opened up to form another group. This enables synchronised multiplayer sessions with independent group structures.

- **Session Coordination and Experiment Flow**  
  The server handles waiting rooms, session timing, trial progression, environmental changes (e.g. static/dynamic reward probabilities), and game round transitions. It tracks each client’s session and manages reconnections via a fallback 'decoyRoom' to preserve data integrity.

- **Data Storage via MongoDB and Mongoose**  
  Participant actions, game state variables, timing, and outcome metrics are collected during the session and stored in a MongoDB database using Mongoose. Data is saved after every game session (`gameRound`) and during disconnection events, ensuring no loss of behavioural records.

---

### 🕹️ Client-Side (Interactive Participant Interface)

- **Phaser Framework (`public/src/main.js`)**  
  The client interface is built with Phaser, a JavaScript game framework. It governs:
  - Scene transitions (waiting rooms, instruction screens, main task, feedback, questionnaire)
  - Real-time updates (e.g., countdowns, trial status)
  - Participant inputs and visual feedback

- **Socket.IO Client Integration**  
  Client-server communication is bi-directional via WebSockets. Each participant receives trial-specific parameters, group assignment info, and task configurations dynamically, ensuring synchronised experimental control across clients.

- **Behavioural Safeguards**  
  The client detects browser reloads and tab visibility changes to prevent duplicated entries or incomplete trials. Disconnected participants are routed to the final questionnaire stage with their data preserved.

---

### 🔄 Task Mechanics and Flow

1. **Joining**: Participant connects and is assigned to a room or individual condition based on latency and group availability.
2. **Waiting Room**: Real-time countdown starts. If enough participants join in time, a group session begins; otherwise, the participant proceeds individually.
3. **Tutorial + Comprehension Test**: Ensures participants understand the task before proceeding.
4. **Bandit Task**: Multiple rounds of collective decision-making where only the group-level payoff is shown.
5. **Feedback & Transition**: After each round, participants receive summary feedback before proceeding to the next round.
6. **Data Export**: All events are logged to MongoDB and can be exported via CLI using `mongoexport` (as shown in a later section).

---

This architecture allows researchers to conduct robust, real-time online experiments involving collective behaviour, feedback sharing, and adaptive choice under uncertainty.


## 📘 PM2 Cheat Sheet

### Real-time Log Monitoring

```bash
pm2 logs --raw         # All apps
pm2 logs <id|name>     # Specific app by ID or name
```

### Clear Logs

```bash
pm2 flush
```

### Restarting Apps

```bash
pm2 restart app.js
```

### Check Running Apps

```bash
pm2 list
pm2 monit
```

### Stop an App

```bash
pm2 stop app_name
```

### Delete an App

```bash
pm2 delete app_name
```

---

## 📁 Log Collection (Production VPS)

Run the following commands on the VPS to collect log snapshots:

```bash
cp ~/.pm2/logs/collective_reward_game-out.log CollectiveRewardExp/logs/collective_reward_game-out-DATETIME-2.log
cp ~/.pm2/logs/collective_reward_static-out.log CollectiveRewardExp/logs/collective_reward_static-out-DATETIME-2.log

cp ~/.pm2/logs/collective_reward_game-error.log CollectiveRewardExp/logs/collective_reward_game-error-DATETIME-2.log
cp ~/.pm2/logs/collective_reward_static-error.log CollectiveRewardExp/logs/collective_reward_static-error-DATETIME-2.log
```

---

## 💾 How to Export Data from MongoDB

Use the following command to export data as CSV:

```bash
mongoexport --host localhost \
  --db DB_NAME \
  --collection COLLECTION_NAME \
  --type=csv \
  --out ./data/DATA_NAME_YOU_WANT.csv \
  --fieldFile ./models/dataField.txt
```

---

## 🧑‍💻 Author

**Wataru Toyokawa**

If you use or build upon this code, please consider citing or acknowledging the project.

---

## 📜 License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).


