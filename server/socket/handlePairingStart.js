/**
 * handlePairingStart - Generate pairings for a new round and emit to clients
 *
 * This handler is called at the start of each round in networked experiments.
 * It uses the PairingManager to generate valid pairings based on the current
 * network state and emits pairing information to each player.
 */

const logger = require('../utils/logger');
const NetworkState = require('../database/models/NetworkState');

/**
 * Start a new round by generating pairings
 * @param {Object} data - { roomId, roundNumber }
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 * @param {Object} rooms - Rooms object containing all active rooms
 */
async function handlePairingStart(data, socket, io, rooms) {
  const { roomId, roundNumber } = data;
  const room = rooms[roomId];

  if (!room) {
    logger.error(`[PairingStart] Room ${roomId} not found`);
    socket.emit('error', { message: 'Room not found' });
    return;
  }

  // Verify this is a networked experiment
  if (!room.network || !room.pairingManager) {
    logger.error(`[PairingStart] Room ${roomId} is not a networked experiment`);
    socket.emit('error', { message: 'Not a networked experiment' });
    return;
  }

  logger.info(`[PairingStart] Starting round ${roundNumber} in room ${roomId}`);

  try {
    // Update room's round number
    room.roundNumber = roundNumber;

    // Get all active player IDs (subject numbers 0 to n-1)
    const playerIds = Array.from({ length: room.n }, (_, i) => i);

    // Generate pairings using the pairing manager
    const { pairs, isolated, unpaired } = room.pairingManager.generatePairings(
      roundNumber,
      playerIds
    );

    // Store current pairings in room state
    room.currentPairings = pairs;
    room.isolatedPlayers = isolated;

    logger.info(`[PairingStart] Round ${roundNumber}: Generated ${pairs.length} pairs, ${isolated.length} isolated, ${unpaired.length} unpaired`);

    // Emit pairing info to each paired player
    for (const [player1Id, player2Id] of pairs) {
      const player1 = room.membersID[player1Id];
      const player2 = room.membersID[player2Id];

      if (!player1 || !player2) {
        logger.warn(`[PairingStart] Missing player data for pair [${player1Id}, ${player2Id}]`);
        continue;
      }

      // Get pairing history between these two players
      const timesPlayedTogether = room.pairingManager.getTimesPaired(player1Id, player2Id);
      const pairHistory = room.pairingManager.getPairHistory(player1Id, player2Id);

      // Get cooperation history if available
      const cooperationHistory = getCooperationHistory(room, player1Id, player2Id);

      // Emit to player 1
      io.to(player1.socketId).emit('pairing_assigned', {
        roundNumber,
        partnerId: player2Id,
        partnerSubjectId: player2.subjectId,
        timesPlayedTogether,
        cooperationHistory,
        networkStatus: {
          myDegree: room.network.getDegree(player1Id),
          partnerDegree: room.network.getDegree(player2Id),
          totalEdges: room.network.getTotalEdges()
        }
      });

      // Emit to player 2
      io.to(player2.socketId).emit('pairing_assigned', {
        roundNumber,
        partnerId: player1Id,
        partnerSubjectId: player1.subjectId,
        timesPlayedTogether,
        cooperationHistory,
        networkStatus: {
          myDegree: room.network.getDegree(player2Id),
          partnerDegree: room.network.getDegree(player1Id),
          totalEdges: room.network.getTotalEdges()
        }
      });
    }

    // Notify isolated players
    for (const playerId of isolated) {
      const player = room.membersID[playerId];
      if (player) {
        io.to(player.socketId).emit('player_isolated', {
          roundNumber,
          reason: 'No valid partners available',
          message: 'You have been excluded by all players and will sit out this round.'
        });
      }
    }

    // Notify unpaired players (shouldn't happen often, but possible with odd groups)
    for (const playerId of unpaired) {
      const player = room.membersID[playerId];
      if (player) {
        io.to(player.socketId).emit('player_unpaired', {
          roundNumber,
          reason: 'Odd number of available players',
          message: 'You were not paired this round due to network fragmentation.'
        });
      }
    }

    // Save network state to database
    await saveNetworkState(room, roundNumber);

    // Emit room-wide event that pairing is complete
    io.to(roomId).emit('pairing_complete', {
      roundNumber,
      totalPairs: pairs.length,
      isolatedCount: isolated.length,
      unpairedCount: unpaired.length
    });

    logger.info(`[PairingStart] Round ${roundNumber} pairing complete for room ${roomId}`);

  } catch (error) {
    logger.error(`[PairingStart] Error generating pairings for room ${roomId}:`, error);
    io.to(roomId).emit('error', {
      message: 'Error generating pairings',
      details: error.message
    });
  }
}

/**
 * Get cooperation history between two players
 * @param {Object} room - Room object
 * @param {number} player1Id - First player ID
 * @param {number} player2Id - Second player ID
 * @returns {Object} - Cooperation statistics
 */
function getCooperationHistory(room, player1Id, player2Id) {
  if (!room.cooperationHistory) {
    return {
      timesPlayed: 0,
      player1Cooperated: 0,
      player2Cooperated: 0,
      mutualCooperation: 0,
      mutualDefection: 0
    };
  }

  const p1History = room.cooperationHistory[player1Id]?.[player2Id] || [];
  const p2History = room.cooperationHistory[player2Id]?.[player1Id] || [];

  const timesPlayed = p1History.length;
  const player1Cooperated = p1History.filter(choice => choice === 0).length;
  const player2Cooperated = p2History.filter(choice => choice === 0).length;

  let mutualCooperation = 0;
  let mutualDefection = 0;

  for (let i = 0; i < timesPlayed; i++) {
    if (p1History[i] === 0 && p2History[i] === 0) mutualCooperation++;
    if (p1History[i] === 1 && p2History[i] === 1) mutualDefection++;
  }

  return {
    timesPlayed,
    player1Cooperated,
    player2Cooperated,
    mutualCooperation,
    mutualDefection,
    player1CooperationRate: timesPlayed > 0 ? player1Cooperated / timesPlayed : 0,
    player2CooperationRate: timesPlayed > 0 ? player2Cooperated / timesPlayed : 0
  };
}

/**
 * Save current network state to database
 * @param {Object} room - Room object
 * @param {number} roundNumber - Current round number
 */
async function saveNetworkState(room, roundNumber) {
  try {
    const networkData = room.network.serialize();

    // Calculate player degrees
    const playerDegrees = [];
    for (let i = 0; i < room.n; i++) {
      playerDegrees.push({
        playerId: i,
        degree: room.network.getDegree(i)
      });
    }

    // Create network state document
    const networkState = new NetworkState({
      experimentName: room.experimentName || 'networked-pd',
      roomId: room.roomId,
      roundNumber,
      groupSize: room.n,
      adjacencyMatrix: networkData.adjacencyMatrix,
      totalEdges: networkData.totalEdges,
      density: networkData.density,
      isConnected: networkData.isConnected,
      isolatedPlayers: networkData.isolatedPlayers,
      playerDegrees,
      connectedComponents: networkData.connectedComponents,
      pairings: room.currentPairings,
      unpairedPlayers: [],
      edgesRemoved: [],
      edgesAdded: []
    });

    await networkState.save();
    logger.info(`[PairingStart] Saved network state for round ${roundNumber}`);

  } catch (error) {
    logger.error(`[PairingStart] Error saving network state:`, error);
  }
}

module.exports = handlePairingStart;
