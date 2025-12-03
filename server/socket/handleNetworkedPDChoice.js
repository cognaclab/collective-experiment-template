/**
 * handleNetworkedPDChoice - Handle choice submissions in networked PD
 *
 * Collects choices from paired players, calculates payoffs using the payoff matrix,
 * and emits results when both players have chosen.
 */

const logger = require('../utils/logger');
const RewardCalculator = require('../utils/RewardCalculator');
const Trial = require('../database/models/Trial');
const { buildTrialRecord } = require('../utils/dataBuilders');

/**
 * Handle a player's choice in networked PD
 * @param {Object} data - { roomId, sessionId, subjectId, roundNumber, choice, reactionTime, screenPosition }
 * @param {Object} socket - Socket.io socket instance
 * @param {Object} io - Socket.io server instance
 * @param {Object} rooms - Rooms object
 */
async function handleNetworkedPDChoice(data, socket, io, rooms) {
  const { roomId, sessionId, subjectId, roundNumber, choice, reactionTime, screenPosition } = data;
  const room = rooms[roomId];

  if (!room) {
    logger.error(`[NetworkedPDChoice] Room ${roomId} not found`);
    socket.emit('error', { message: 'Room not found' });
    return;
  }

  // Find this player's subject number
  // membersID is an object keyed by player number (0 to n-1)
  let playerIndex = -1;
  for (const [idx, player] of Object.entries(room.membersID)) {
    if (player && player.subjectId === subjectId) {
      playerIndex = parseInt(idx);
      break;
    }
  }

  if (playerIndex === -1) {
    logger.error(`[NetworkedPDChoice] Player ${subjectId} not found in room ${roomId}`, {
      availablePlayers: Object.entries(room.membersID).map(([idx, p]) => ({ idx, subjectId: p?.subjectId }))
    });
    socket.emit('error', { message: 'Player not found in room' });
    return;
  }

  const subjectNumber = playerIndex;

  logger.info(`[NetworkedPDChoice] Player ${subjectNumber} (${subjectId}) chose ${choice} in round ${roundNumber}`);

  // Find this player's partner for this round
  const partnerInfo = findPartner(room, subjectNumber);

  if (!partnerInfo) {
    logger.error(`[NetworkedPDChoice] No partner found for player ${subjectNumber} in round ${roundNumber}`);
    socket.emit('error', { message: 'No partner assigned for this round' });
    return;
  }

  const { partnerId, partnerSubjectId } = partnerInfo;

  // Initialize choices object for this round if needed
  if (!room.roundChoices) {
    room.roundChoices = {};
  }
  if (!room.roundChoices[roundNumber]) {
    room.roundChoices[roundNumber] = {};
  }

  // Store this player's choice
  room.roundChoices[roundNumber][subjectNumber] = {
    choice,
    reactionTime,
    screenPosition,
    timestamp: new Date(),
    sessionId,
    subjectId
  };

  // Acknowledge receipt
  socket.emit('choice_acknowledged', {
    roundNumber,
    choice,
    message: 'Waiting for partner to decide...'
  });

  // Check if both players have chosen
  const partnerChoice = room.roundChoices[roundNumber][partnerId];

  logger.debug(`[NetworkedPDChoice] Checking partner choice: roundNumber=${roundNumber}, partnerId=${partnerId}, partnerChoice exists=${!!partnerChoice}`, {
    roundChoicesKeys: Object.keys(room.roundChoices[roundNumber] || {}),
    currentPairings: room.currentPairings
  });

  if (partnerChoice) {
    // Both players have chosen - calculate payoffs
    logger.info(`[NetworkedPDChoice] Both players chose in round ${roundNumber}. Calculating payoffs...`);

    const player1Choice = room.roundChoices[roundNumber][subjectNumber].choice;
    const player2Choice = partnerChoice.choice;

    // Calculate payoffs using RewardCalculator
    const rewardCalculator = new RewardCalculator(room.experimentConfig);
    const payoffs = rewardCalculator.calculateReward([player1Choice, player2Choice], {
      roundNumber,
      taskType: 'prisoners_dilemma'
    });

    const [player1Payoff, player2Payoff] = payoffs;

    // Update cooperation history
    updateCooperationHistory(room, subjectNumber, partnerId, player1Choice);
    updateCooperationHistory(room, partnerId, subjectNumber, player2Choice);

    // Update cumulative payoffs
    if (!room.cumulativePayoffs) {
      room.cumulativePayoffs = Array(room.n).fill(0);
    }
    room.cumulativePayoffs[subjectNumber] += player1Payoff;
    room.cumulativePayoffs[partnerId] += player2Payoff;

    // Save trials to database
    await saveTrialData(room, roundNumber, subjectNumber, partnerId, {
      player1Choice,
      player2Choice,
      player1Payoff,
      player2Payoff,
      player1ReactionTime: reactionTime,
      player2ReactionTime: partnerChoice.reactionTime
    });

    // Store results for synchronized transition (instead of emitting pd_result immediately)
    if (!room.pairResults) {
      room.pairResults = {};
    }
    if (!room.pairResults[roundNumber]) {
      room.pairResults[roundNumber] = {};
    }

    // Get round/turn info for display
    const gameRound = (room.gameRound || 0) + 1;  // 1-indexed for display
    const turnWithinRound = room.turnWithinRound || 1;
    const turnsPerRound = room.turnsPerRound || 2;
    const totalRounds = room.totalGameRounds || 3;

    // Store result for player 1 (current player)
    room.pairResults[roundNumber][subjectNumber] = {
      roundNumber,
      gameRound,
      turnWithinRound,
      turnsPerRound,
      totalRounds,
      myChoice: player1Choice,
      partnerChoice: player2Choice,
      myPayoff: player1Payoff,
      partnerPayoff: player2Payoff,
      cumulativePayoff: room.cumulativePayoffs[subjectNumber],
      partnerId,
      cooperationOutcome: getCooperationOutcome(player1Choice, player2Choice)
    };

    // Store result for player 2 (partner)
    room.pairResults[roundNumber][partnerId] = {
      roundNumber,
      gameRound,
      turnWithinRound,
      turnsPerRound,
      totalRounds,
      myChoice: player2Choice,
      partnerChoice: player1Choice,
      myPayoff: player2Payoff,
      partnerPayoff: player1Payoff,
      cumulativePayoff: room.cumulativePayoffs[partnerId],
      partnerId: subjectNumber,
      cooperationOutcome: getCooperationOutcome(player2Choice, player1Choice)
    };

    logger.info(`[NetworkedPDChoice] Pair ${subjectNumber}-${partnerId} complete. Payoffs: P${subjectNumber}=${player1Payoff}, P${partnerId}=${player2Payoff}`);

    // Clear this pair's choices
    delete room.roundChoices[roundNumber][subjectNumber];
    delete room.roundChoices[roundNumber][partnerId];

    // Check if ALL pairs have completed for this round
    const completedPlayers = Object.keys(room.pairResults[roundNumber]).length;
    const totalPairedPlayers = room.currentPairings.length * 2;

    logger.info(`[NetworkedPDChoice] Round ${roundNumber}: ${completedPlayers}/${totalPairedPlayers} players have results`);

    if (completedPlayers >= totalPairedPlayers) {
      // All pairs complete - show 3-second countdown before transitioning to results
      logger.info(`[NetworkedPDChoice] All ${room.currentPairings.length} pairs complete. Starting 3s countdown.`);

      // Emit all_choices_confirmed to trigger client countdown UI
      for (const [playerIdStr] of Object.entries(room.pairResults[roundNumber])) {
        const playerId = parseInt(playerIdStr);
        const player = room.membersID[playerId];
        if (player && player.socketId) {
          io.to(player.socketId).emit('all_choices_confirmed', {
            message: 'All players have confirmed their choices'
          });
        }
      }

      // Wait 3 seconds, then emit results and trigger synchronized transition
      setTimeout(() => {
        logger.info(`[NetworkedPDChoice] 3s countdown complete. Transitioning to results.`);

        // Check if pairResults still exists (room may have been cleaned up)
        if (!room.pairResults || !room.pairResults[roundNumber]) {
          logger.warn(`[NetworkedPDChoice] pairResults no longer exists for round ${roundNumber}`);
          return;
        }

        for (const [playerIdStr, resultData] of Object.entries(room.pairResults[roundNumber])) {
          const playerId = parseInt(playerIdStr);
          const player = room.membersID[playerId];

          if (player && player.socketId) {
            // Emit pd_result so client has the data
            io.to(player.socketId).emit('pd_result', resultData);

            // Emit all_pairs_complete to trigger synchronized scene transition
            io.to(player.socketId).emit('all_pairs_complete', {
              roundNumber,
              resultData
            });

            logger.debug(`[NetworkedPDChoice] Emitted pd_result and all_pairs_complete to player ${playerId}`);
          }
        }

        // Clear round results after emitting
        delete room.pairResults[roundNumber];
      }, 3000);
    }

  } else {
    logger.info(`[NetworkedPDChoice] Player ${subjectNumber} chose, waiting for partner ${partnerId}...`);
  }
}

/**
 * Find a player's partner for the current round
 * @param {Object} room - Room object
 * @param {number} playerId - Player's subject number
 * @returns {Object|null} - { partnerId, partnerSubjectId } or null
 */
function findPartner(room, playerId) {
  if (!room.currentPairings) return null;

  for (const [p1, p2] of room.currentPairings) {
    if (p1 === playerId) {
      return {
        partnerId: p2,
        partnerSubjectId: room.membersID[p2]?.subjectId
      };
    }
    if (p2 === playerId) {
      return {
        partnerId: p1,
        partnerSubjectId: room.membersID[p1]?.subjectId
      };
    }
  }

  return null;
}

/**
 * Update cooperation history in room state
 * @param {Object} room - Room object
 * @param {number} playerId - Player ID
 * @param {number} partnerId - Partner ID
 * @param {number} choice - Choice made (0=cooperate, 1=defect)
 */
function updateCooperationHistory(room, playerId, partnerId, choice) {
  if (!room.cooperationHistory) {
    room.cooperationHistory = {};
  }

  if (!room.cooperationHistory[playerId]) {
    room.cooperationHistory[playerId] = {};
  }

  if (!room.cooperationHistory[playerId][partnerId]) {
    room.cooperationHistory[playerId][partnerId] = [];
  }

  room.cooperationHistory[playerId][partnerId].push(choice);
}

/**
 * Determine cooperation outcome category
 * @param {number} myChoice - This player's choice
 * @param {number} partnerChoice - Partner's choice
 * @returns {string} - Outcome category
 */
function getCooperationOutcome(myChoice, partnerChoice) {
  if (myChoice === 0 && partnerChoice === 0) return 'mutual_cooperation';
  if (myChoice === 1 && partnerChoice === 1) return 'mutual_defection';
  if (myChoice === 0 && partnerChoice === 1) return 'exploited';
  if (myChoice === 1 && partnerChoice === 0) return 'exploited_partner';
  return 'unknown';
}

/**
 * Save trial data to database
 * @param {Object} room - Room object
 * @param {number} roundNumber - Round number
 * @param {number} player1Id - First player ID
 * @param {number} player2Id - Second player ID
 * @param {Object} outcome - { player1Choice, player2Choice, player1Payoff, player2Payoff, ... }
 */
async function saveTrialData(room, roundNumber, player1Id, player2Id, outcome) {
  try {
    const {
      player1Choice,
      player2Choice,
      player1Payoff,
      player2Payoff,
      player1ReactionTime,
      player2ReactionTime
    } = outcome;

    const player1 = room.membersID[player1Id];
    const player2 = room.membersID[player2Id];

    const timestamp = new Date();
    const date = timestamp.toISOString().split('T')[0];
    const time = timestamp.toTimeString().split(' ')[0];

    // Get cooperation history
    const timesPlayedTogether = room.pairingManager.getTimesPaired(player1Id, player2Id);

    // Trial for player 1
    const trial1 = {
      experimentName: room.experimentName || 'networked-pd',
      sessionId: player1.sessionId,
      roomId: room.roomId,
      subjectId: player1.subjectId,
      subjectNumber: player1Id,
      timestamp,
      date,
      time,
      gameRound: 0,
      trial: roundNumber,
      pointer: roundNumber,

      experimentConfig: {
        mode: 'group',
        taskType: 'networked_pd',
        expCondition: room.exp_condition,
        groupSize: room.n,
        maxGroupSize: room.n,
        horizon: 30,
        totalGameRounds: 1,
        kArmedBandit: 2
      },

      choice: {
        optionId: player1Choice,
        screenPosition: 0,
        payoff: player1Payoff,
        reactionTime: player1ReactionTime,
        wasTimeout: false,
        wasMiss: false
      },

      networkData: {
        partnerId: player2Id,
        partnerSubjectId: player2.subjectId,
        timesPlayedWithPartner: timesPlayedTogether,

        partnerChoice: {
          optionId: player2Choice,
          payoff: player2Payoff
        },

        cooperationHistory: {
          playerCooperated: player1Choice === 0,
          partnerCooperated: player2Choice === 0,
          mutualCooperation: player1Choice === 0 && player2Choice === 0,
          mutualDefection: player1Choice === 1 && player2Choice === 1,
          wasExploited: player1Choice === 0 && player2Choice === 1,
          exploitedPartner: player1Choice === 1 && player2Choice === 0
        },

        networkSnapshot: {
          totalEdges: room.network.getTotalEdges(),
          playerDegree: room.network.getDegree(player1Id),
          partnerDegree: room.network.getDegree(player2Id),
          isolatedCount: room.network.getIsolatedPlayers().length,
          networkDensity: room.network.getDensity(),
          isNetworkConnected: room.network.isConnected()
        },

        playerStatus: {
          isIsolated: room.network.isIsolated(player1Id),
          canStillPlay: !room.network.isIsolated(player1Id),
          validPartnerCount: room.network.getValidPartners(player1Id).length
        }
      }
    };

    // Trial for player 2 (mirror of player 1)
    const trial2 = {
      ...trial1,
      sessionId: player2.sessionId,
      subjectId: player2.subjectId,
      subjectNumber: player2Id,

      choice: {
        optionId: player2Choice,
        screenPosition: 0,
        payoff: player2Payoff,
        reactionTime: player2ReactionTime,
        wasTimeout: false,
        wasMiss: false
      },

      networkData: {
        partnerId: player1Id,
        partnerSubjectId: player1.subjectId,
        timesPlayedWithPartner: timesPlayedTogether,

        partnerChoice: {
          optionId: player1Choice,
          payoff: player1Payoff
        },

        cooperationHistory: {
          playerCooperated: player2Choice === 0,
          partnerCooperated: player1Choice === 0,
          mutualCooperation: player1Choice === 0 && player2Choice === 0,
          mutualDefection: player1Choice === 1 && player2Choice === 1,
          wasExploited: player2Choice === 0 && player1Choice === 1,
          exploitedPartner: player2Choice === 1 && player1Choice === 0
        },

        networkSnapshot: {
          totalEdges: room.network.getTotalEdges(),
          playerDegree: room.network.getDegree(player2Id),
          partnerDegree: room.network.getDegree(player1Id),
          isolatedCount: room.network.getIsolatedPlayers().length,
          networkDensity: room.network.getDensity(),
          isNetworkConnected: room.network.isConnected()
        },

        playerStatus: {
          isIsolated: room.network.isIsolated(player2Id),
          canStillPlay: !room.network.isIsolated(player2Id),
          validPartnerCount: room.network.getValidPartners(player2Id).length
        }
      }
    };

    // Save both trials
    await Trial.create([trial1, trial2]);

    logger.info(`[NetworkedPDChoice] Saved trial data for round ${roundNumber}`);

  } catch (error) {
    logger.error(`[NetworkedPDChoice] Error saving trial data:`, error);
  }
}

module.exports = handleNetworkedPDChoice;
