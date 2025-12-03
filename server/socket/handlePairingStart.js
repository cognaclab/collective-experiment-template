/**
 * handlePairingStart - Generate pairings for a new round and emit to clients
 *
 * This module handles pairing generation for networked experiments.
 * It exports both a socket handler (for client-initiated requests) and
 * a direct function (for server-initiated pairing in handleSceneComplete).
 */

const logger = require('../utils/logger');
const NetworkState = require('../database/models/NetworkState');

/**
 * Generate pairings for a room - core logic callable from server
 * @param {Object} room - Room object with network and pairingManager
 * @param {number} roundNumber - Round number to generate pairings for
 * @param {Object} io - Socket.io server instance (optional, for emitting events)
 * @returns {Object} - { success, pairs, isolated, unpaired, playerPairings }
 */
async function generatePairingsForRoom(room, roundNumber, io = null) {
  const roomId = room.roomId;

  // Atomic duplicate prevention
  const pairingKey = `pairing_${roundNumber}`;
  if (room[pairingKey]) {
    logger.debug(`[Pairing] Round ${roundNumber} already processed for room ${roomId}`);
    return { success: false, alreadyProcessed: true };
  }
  room[pairingKey] = true;

  // Verify this is a networked experiment
  if (!room.network || !room.pairingManager) {
    logger.error(`[Pairing] Room ${roomId} is not a networked experiment`);
    room[pairingKey] = false;
    return { success: false, error: 'Not a networked experiment' };
  }

  logger.info(`[Pairing] Generating pairings for round ${roundNumber} in room ${roomId}`);

  try {
    room.roundNumber = roundNumber;

    const playerIds = Array.from({ length: room.n }, (_, i) => i);
    const { pairs, isolated, unpaired } = room.pairingManager.generatePairings(roundNumber, playerIds);

    room.currentPairings = pairs;
    room.isolatedPlayers = isolated;

    // Store partner mapping for the entire round (persists across turns)
    room.currentRoundPartner = {};
    for (const [p1, p2] of pairs) {
      room.currentRoundPartner[p1] = p2;
      room.currentRoundPartner[p2] = p1;
    }

    logger.info(`[Pairing] Round ${roundNumber}: ${pairs.length} pairs, ${isolated.length} isolated, ${unpaired.length} unpaired`);

    // Build per-player pairing data for scene initialization
    const playerPairings = {};

    for (const [player1Id, player2Id] of pairs) {
      const player1 = room.membersID[player1Id];
      const player2 = room.membersID[player2Id];

      if (!player1 || !player2) {
        logger.warn(`[Pairing] Missing player data for pair [${player1Id}, ${player2Id}]`);
        continue;
      }

      // Exclude current round when counting times paired (pairing already stored in allPairings)
      const timesPlayedTogether = room.pairingManager.getTimesPaired(player1Id, player2Id, roundNumber);
      const cooperationHistory = getCooperationHistory(room, player1Id, player2Id);

      // Store pairing data for player 1
      playerPairings[player1Id] = {
        roundNumber,
        partnerId: player2Id,
        partnerSubjectId: player2.subjectId,
        timesPlayedWithPartner: timesPlayedTogether,  // Client expects this field name
        cooperationHistory,
        networkStatus: {
          totalConnections: room.network.getDegree(player1Id),  // Client expects this field name
          partnerConnections: room.network.getDegree(player2Id),
          totalEdges: room.network.getTotalEdges()
        }
      };

      // Store pairing data for player 2
      playerPairings[player2Id] = {
        roundNumber,
        partnerId: player1Id,
        partnerSubjectId: player1.subjectId,
        timesPlayedWithPartner: timesPlayedTogether,  // Client expects this field name
        cooperationHistory,
        networkStatus: {
          totalConnections: room.network.getDegree(player2Id),  // Client expects this field name
          partnerConnections: room.network.getDegree(player1Id),
          totalEdges: room.network.getTotalEdges()
        }
      };

      // Emit to players if io is provided (backward compatibility)
      if (io) {
        io.to(player1.socketId).emit('pairing_assigned', playerPairings[player1Id]);
        io.to(player2.socketId).emit('pairing_assigned', playerPairings[player2Id]);
      }
    }

    // Handle isolated players
    for (const playerId of isolated) {
      const player = room.membersID[playerId];
      if (player) {
        playerPairings[playerId] = {
          roundNumber,
          isIsolated: true,
          reason: 'No valid partners available',
          message: 'You have been excluded by all players and will sit out this round.'
        };
        if (io) {
          io.to(player.socketId).emit('player_isolated', playerPairings[playerId]);
        }
      }
    }

    // Handle unpaired players
    for (const playerId of unpaired) {
      const player = room.membersID[playerId];
      if (player) {
        playerPairings[playerId] = {
          roundNumber,
          isUnpaired: true,
          reason: 'Odd number of available players',
          message: 'You were not paired this round due to network fragmentation.'
        };
        if (io) {
          io.to(player.socketId).emit('player_unpaired', playerPairings[playerId]);
        }
      }
    }

    // Save network state
    await saveNetworkState(room, roundNumber);

    // Emit completion event if io provided
    if (io) {
      io.to(roomId).emit('pairing_complete', {
        roundNumber,
        totalPairs: pairs.length,
        isolatedCount: isolated.length,
        unpairedCount: unpaired.length
      });
    }

    logger.info(`[Pairing] Round ${roundNumber} complete for room ${roomId}`);

    return {
      success: true,
      pairs,
      isolated,
      unpaired,
      playerPairings
    };

  } catch (error) {
    room[pairingKey] = false;
    logger.error(`[Pairing] Error generating pairings for room ${roomId}:`, error);

    if (io) {
      io.to(roomId).emit('error', {
        message: 'Error generating pairings',
        details: error.message
      });
    }

    return { success: false, error: error.message };
  }
}

/**
 * Socket handler for client-initiated pairing requests (backward compatibility)
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

  // Delegate to core function
  const result = await generatePairingsForRoom(room, roundNumber, io);

  if (!result.success && result.error) {
    socket.emit('error', { message: result.error });
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

module.exports = { handlePairingStart, generatePairingsForRoom };
