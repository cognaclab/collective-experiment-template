/**
 * handleOstracismVote - Process ostracism/exclusion votes from players
 *
 * Collects votes from players to continue or break links with their partners.
 * When all votes are collected, updates the network graph and saves state.
 */

const logger = require('../utils/logger');
const NetworkState = require('../database/models/NetworkState');

/**
 * Handle ostracism vote from a player
 * @param {Object} data - { roomId, sessionId, subjectId, roundNumber, vote, partnerId }
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 * @param {Object} rooms - Rooms object
 */
async function handleOstracismVote(data, socket, io, rooms) {
  const { roomId, sessionId, subjectId, roundNumber, vote, partnerId } = data;
  const room = rooms[roomId];

  if (!room) {
    logger.error(`[OstracismVote] Room ${roomId} not found`);
    socket.emit('error', { message: 'Room not found' });
    return;
  }

  // Verify this is a networked experiment
  if (!room.network) {
    logger.error(`[OstracismVote] Room ${roomId} is not a networked experiment`);
    socket.emit('error', { message: 'Not a networked experiment' });
    return;
  }

  // Find player's subject number
  const playerIndex = room.membersID.findIndex(p => p.subjectId === subjectId);
  if (playerIndex === -1) {
    logger.error(`[OstracismVote] Player ${subjectId} not found in room ${roomId}`);
    socket.emit('error', { message: 'Player not found' });
    return;
  }

  const playerId = playerIndex;

  // Validate vote
  if (vote !== 'continue' && vote !== 'break') {
    logger.error(`[OstracismVote] Invalid vote "${vote}" from player ${playerId}`);
    socket.emit('error', { message: 'Invalid vote. Must be "continue" or "break"' });
    return;
  }

  logger.info(`[OstracismVote] Round ${roundNumber}: Player ${playerId} voted "${vote}" for partner ${partnerId}`);

  // Initialize ostracism votes for this round if needed
  if (!room.ostracismVotes[roundNumber]) {
    room.ostracismVotes[roundNumber] = {};
  }

  // Store the vote
  room.ostracismVotes[roundNumber][playerId] = {
    vote,
    partnerId,
    timestamp: new Date(),
    sessionId,
    subjectId
  };

  // Acknowledge vote receipt
  socket.emit('vote_acknowledged', {
    roundNumber,
    vote,
    partnerId,
    message: 'Your vote has been recorded. Waiting for all players...'
  });

  // Check if all players who need to vote have voted
  const expectedVotes = getExpectedVoteCount(room);
  const actualVotes = Object.keys(room.ostracismVotes[roundNumber]).length;

  logger.info(`[OstracismVote] Round ${roundNumber}: ${actualVotes}/${expectedVotes} votes collected`);

  if (actualVotes >= expectedVotes) {
    // All votes collected - process ostracism
    logger.info(`[OstracismVote] Round ${roundNumber}: All votes collected. Processing ostracism...`);

    await processOstracismVotes(room, roundNumber, io);

    // Emit completion event
    io.to(roomId).emit('ostracism_complete', {
      roundNumber,
      message: 'Ostracism voting complete. Network has been updated.'
    });
  }
}

/**
 * Get expected number of votes for this round
 * @param {Object} room - Room object
 * @returns {number} - Number of votes expected
 */
function getExpectedVoteCount(room) {
  // Count players who were paired (not isolated, not unpaired)
  const pairedPlayers = room.currentPairings.length * 2;
  return pairedPlayers;
}

/**
 * Process all ostracism votes and update network
 * @param {Object} room - Room object
 * @param {number} roundNumber - Round number
 * @param {Object} io - Socket.io server instance
 */
async function processOstracismVotes(room, roundNumber, io) {
  const votes = room.ostracismVotes[roundNumber];
  const edgesRemoved = [];

  logger.info(`[OstracismVote] Processing ${Object.keys(votes).length} votes for round ${roundNumber}`);

  // Get network state before changes
  const networkBefore = room.network.serialize();

  // Process each vote
  for (const [playerIdStr, voteData] of Object.entries(votes)) {
    const playerId = parseInt(playerIdStr);
    const { vote, partnerId } = voteData;

    if (vote === 'break') {
      // Check if edge exists
      if (room.network.hasEdge(playerId, partnerId)) {
        // Remove edge (unilateral - either player can break)
        room.network.removeEdge(playerId, partnerId, true, {
          roundNumber,
          reason: 'ostracism_vote',
          voter: playerId
        });

        edgesRemoved.push({
          player1: playerId,
          player2: partnerId,
          initiator: playerId,
          timestamp: new Date()
        });

        logger.info(`[OstracismVote] Edge removed: ${playerId} <-> ${partnerId}`);

        // Notify both players
        const player1Socket = room.membersID[playerId]?.socketId;
        const player2Socket = room.membersID[partnerId]?.socketId;

        if (player1Socket) {
          io.to(player1Socket).emit('link_broken', {
            roundNumber,
            partnerId,
            initiator: 'you',
            message: `You chose to break your link with Player ${partnerId}`
          });
        }

        if (player2Socket) {
          io.to(player2Socket).emit('link_broken', {
            roundNumber,
            partnerId: playerId,
            initiator: 'partner',
            message: `Your link with Player ${playerId} has been broken`
          });
        }
      } else {
        logger.warn(`[OstracismVote] Player ${playerId} tried to break non-existent edge with ${partnerId}`);
      }
    }
  }

  // Get network state after changes
  const networkAfter = room.network.serialize();

  // Check for newly isolated players
  const newlyIsolated = networkAfter.isolatedPlayers.filter(
    p => !networkBefore.isolatedPlayers.includes(p)
  );

  // Notify newly isolated players
  for (const playerId of newlyIsolated) {
    const player = room.membersID[playerId];
    if (player) {
      io.to(player.socketId).emit('player_became_isolated', {
        roundNumber,
        message: 'You have been excluded by all players. You will not participate in future rounds.',
        remainingRounds: 30 - roundNumber
      });

      logger.info(`[OstracismVote] Player ${playerId} became isolated`);
    }
  }

  // Save updated network state to database
  await saveOstracismNetworkState(room, roundNumber, edgesRemoved);

  // Log summary
  logger.info(`[OstracismVote] Round ${roundNumber} summary:`);
  logger.info(`  - Edges removed: ${edgesRemoved.length}`);
  logger.info(`  - Newly isolated: ${newlyIsolated.length}`);
  logger.info(`  - Total edges: ${networkAfter.totalEdges}`);
  logger.info(`  - Network density: ${networkAfter.density.toFixed(3)}`);
  logger.info(`  - Network connected: ${networkAfter.isConnected}`);

  // Broadcast network summary to all players
  io.to(room.roomId).emit('network_summary', {
    roundNumber,
    totalEdges: networkAfter.totalEdges,
    density: networkAfter.density,
    isolatedCount: networkAfter.isolatedPlayers.length,
    isConnected: networkAfter.isConnected,
    edgesRemovedThisRound: edgesRemoved.length
  });
}

/**
 * Save network state after ostracism to database
 * @param {Object} room - Room object
 * @param {number} roundNumber - Round number
 * @param {Array} edgesRemoved - Array of removed edges
 */
async function saveOstracismNetworkState(room, roundNumber, edgesRemoved) {
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

    // Convert votes to ostracism votes array
    const ostracismVotes = [];
    for (const [playerIdStr, voteData] of Object.entries(room.ostracismVotes[roundNumber])) {
      ostracismVotes.push({
        playerId: parseInt(playerIdStr),
        partnerId: voteData.partnerId,
        vote: voteData.vote,
        timestamp: voteData.timestamp
      });
    }

    // Update existing network state or create new one
    const existingState = await NetworkState.findOne({
      experimentName: room.experimentName || 'networked-pd',
      roomId: room.roomId,
      roundNumber
    });

    if (existingState) {
      // Update existing state with ostracism data
      existingState.adjacencyMatrix = networkData.adjacencyMatrix;
      existingState.totalEdges = networkData.totalEdges;
      existingState.density = networkData.density;
      existingState.isConnected = networkData.isConnected;
      existingState.isolatedPlayers = networkData.isolatedPlayers;
      existingState.playerDegrees = playerDegrees;
      existingState.connectedComponents = networkData.connectedComponents;
      existingState.edgesRemoved = edgesRemoved;
      existingState.ostracismVotes = ostracismVotes;

      await existingState.save();
      logger.info(`[OstracismVote] Updated network state for round ${roundNumber}`);

    } else {
      // Create new network state
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
        pairings: room.currentPairings || [],
        unpairedPlayers: [],
        edgesRemoved,
        edgesAdded: [],
        ostracismVotes
      });

      await networkState.save();
      logger.info(`[OstracismVote] Saved ostracism network state for round ${roundNumber}`);
    }

  } catch (error) {
    logger.error(`[OstracismVote] Error saving network state:`, error);
  }
}

module.exports = handleOstracismVote;
