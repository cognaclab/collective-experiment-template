const mongoose = require('mongoose');

/**
 * NetworkState Schema
 * Stores the state of the social network at each round of a networked experiment
 */
const networkStateSchema = new mongoose.Schema({
  // Identifiers
  experimentName: {
    type: String,
    required: true,
    index: true
  },

  roomId: {
    type: String,
    required: true,
    index: true
  },

  roundNumber: {
    type: Number,
    required: true,
    min: 0
  },

  // Network topology
  groupSize: {
    type: Number,
    required: true
  },

  adjacencyMatrix: {
    type: [[Boolean]],
    required: true,
    validate: {
      validator: function(matrix) {
        return matrix.length === this.groupSize &&
               matrix.every(row => row.length === this.groupSize);
      },
      message: 'Adjacency matrix dimensions must match group size'
    }
  },

  // Network metrics
  totalEdges: {
    type: Number,
    required: true,
    min: 0
  },

  density: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },

  isConnected: {
    type: Boolean,
    required: true
  },

  // Player states
  isolatedPlayers: [{
    type: Number,
    min: 0
  }],

  playerDegrees: [{
    playerId: Number,
    degree: Number  // Number of connections this player has
  }],

  connectedComponents: {
    type: [[Number]], // Array of components, each is array of player IDs
    default: []
  },

  // Changes since last round
  edgesRemoved: [{
    player1: Number,
    player2: Number,
    reason: String,  // 'ostracism', 'timeout', 'disconnect', etc.
    timestamp: Date
  }],

  edgesAdded: [{
    player1: Number,
    player2: Number,
    reason: String,
    timestamp: Date
  }],

  // Ostracism data for this round
  ostracismVotes: [{
    playerId: Number,
    partnerId: Number,
    vote: {
      type: String,
      enum: ['continue', 'break']
    },
    timestamp: Date
  }],

  // Pairing data for this round
  pairings: [[{
    type: Number,
    min: 0
  }]], // Array of [player1, player2] pairs

  unpairedPlayers: [{
    type: Number,
    min: 0
  }],

  // Metadata
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient querying
networkStateSchema.index({ experimentName: 1, roomId: 1, roundNumber: 1 }, { unique: true });
networkStateSchema.index({ experimentName: 1, roomId: 1 });
networkStateSchema.index({ timestamp: 1 });

// Virtual for edge count change
networkStateSchema.virtual('edgeChange').get(function() {
  return this.edgesAdded.length - this.edgesRemoved.length;
});

// Method to get player's connections
networkStateSchema.methods.getPlayerConnections = function(playerId) {
  if (playerId < 0 || playerId >= this.groupSize) {
    return [];
  }

  const connections = [];
  for (let i = 0; i < this.groupSize; i++) {
    if (this.adjacencyMatrix[playerId][i]) {
      connections.push(i);
    }
  }

  return connections;
};

// Method to check if two players are connected
networkStateSchema.methods.areConnected = function(player1, player2) {
  if (player1 < 0 || player1 >= this.groupSize) return false;
  if (player2 < 0 || player2 >= this.groupSize) return false;
  if (player1 === player2) return false;

  return this.adjacencyMatrix[player1][player2];
};

// Static method to get network evolution over time
networkStateSchema.statics.getNetworkEvolution = async function(experimentName, roomId) {
  return await this.find({ experimentName, roomId })
    .sort({ roundNumber: 1 })
    .select('roundNumber totalEdges density isolatedPlayers isConnected timestamp')
    .lean();
};

// Static method to get ostracism history for a room
networkStateSchema.statics.getOstracismHistory = async function(experimentName, roomId) {
  return await this.find({
    experimentName,
    roomId,
    'ostracismVotes.0': { $exists: true } // Has at least one vote
  })
    .sort({ roundNumber: 1 })
    .select('roundNumber ostracismVotes timestamp')
    .lean();
};

// Static method to get player-specific network stats
networkStateSchema.statics.getPlayerNetworkStats = async function(experimentName, roomId, playerId) {
  const states = await this.find({ experimentName, roomId })
    .sort({ roundNumber: 1 })
    .lean();

  return states.map(state => ({
    roundNumber: state.roundNumber,
    degree: state.playerDegrees?.find(p => p.playerId === playerId)?.degree || 0,
    isIsolated: state.isolatedPlayers.includes(playerId),
    connections: state.adjacencyMatrix[playerId]
      ? state.adjacencyMatrix[playerId]
        .map((connected, idx) => connected ? idx : null)
        .filter(idx => idx !== null)
      : []
  }));
};

const NetworkState = mongoose.model('NetworkState', networkStateSchema);

module.exports = NetworkState;
