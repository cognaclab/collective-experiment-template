/**
 * PairingManager - Manages partner pairing for networked experiments
 *
 * Handles dynamic pairing of players within a group, respecting network
 * constraints (who can interact with whom) and pairing preferences
 * (avoiding recent partners, round-robin, etc.)
 */

const logger = require('./logger');

class PairingManager {
  /**
   * @param {NetworkGraph} network - The social network graph
   * @param {Object} config - Pairing configuration options
   */
  constructor(network, config = {}) {
    this.network = network;
    this.config = {
      strategy: config.strategy || 'random_valid',
      allowRepeatPartners: config.allowRepeatPartners !== false,
      maxConsecutiveRepeats: config.maxConsecutiveRepeats || 2,
      isolationHandling: config.isolationHandling || 'sit_out',
      ...config
    };

    this.history = {}; // { playerId: [recentPartnerIds] }
    this.allPairings = []; // Full history of all pairings: [{ round, pairs }]
  }

  /**
   * Generate pairings for a round
   * @param {number} roundNum - Current round number
   * @param {Array<number>} playerIds - Array of active player IDs (0 to n-1)
   * @returns {Object} - { pairs: [[p1, p2], ...], isolated: [p1, p2, ...], unpaired: [p1, p2, ...] }
   */
  generatePairings(roundNum, playerIds) {
    const available = new Set(playerIds);
    const pairs = [];
    const isolated = [];

    logger.info(`Generating pairings for round ${roundNum} with ${playerIds.length} players`);

    // First, identify isolated players (no valid partners)
    for (const playerId of playerIds) {
      if (this.network.isIsolated(playerId)) {
        isolated.push(playerId);
        available.delete(playerId);
        logger.info(`Player ${playerId} is isolated (no valid partners)`);
      }
    }

    // Now pair remaining players
    const result = this._pairPlayers(Array.from(available), roundNum);
    pairs.push(...result.pairs);

    // Store pairing history
    this.allPairings.push({
      round: roundNum,
      pairs: pairs,
      isolated: isolated,
      unpaired: result.unpaired,
      timestamp: new Date()
    });

    // Update recent partner history for paired players
    for (const [p1, p2] of pairs) {
      this._updateHistory(p1, p2);
      this._updateHistory(p2, p1);
    }

    logger.info(`Round ${roundNum}: Generated ${pairs.length} pairs, ${isolated.length} isolated, ${result.unpaired.length} unpaired`);

    return {
      pairs,
      isolated,
      unpaired: result.unpaired
    };
  }

  /**
   * Main pairing algorithm - selects strategy and executes
   * @param {Array<number>} availablePlayers - Players who can be paired
   * @param {number} roundNum - Current round number
   * @returns {Object} - { pairs, unpaired }
   */
  _pairPlayers(availablePlayers, roundNum) {
    switch (this.config.strategy) {
      case 'random_valid':
        return this._randomValidPairing(availablePlayers);

      case 'round_robin':
        return this._roundRobinPairing(availablePlayers, roundNum);

      case 'preferential_attachment':
        return this._preferentialAttachmentPairing(availablePlayers);

      default:
        logger.warn(`Unknown pairing strategy: ${this.config.strategy}, using random_valid`);
        return this._randomValidPairing(availablePlayers);
    }
  }

  /**
   * Random valid pairing strategy
   * Randomly pairs players from valid partners, avoiding recent repeats
   * @param {Array<number>} players - Available players
   * @returns {Object} - { pairs, unpaired }
   */
  _randomValidPairing(players) {
    const available = new Set(players);
    const pairs = [];

    // Shuffle to randomize who gets paired first
    const shuffled = this._shuffle([...players]);

    for (const playerId of shuffled) {
      if (!available.has(playerId)) continue; // Already paired

      // Get valid partners for this player
      const recentPartners = this._getRecentPartners(playerId);
      const validPartners = this.network.getValidPartners(playerId, recentPartners)
        .filter(p => available.has(p));

      if (validPartners.length === 0) {
        // No valid partners (considering recent history), try without history constraint
        const anyValidPartners = this.network.getValidPartners(playerId)
          .filter(p => available.has(p));

        if (anyValidPartners.length === 0) {
          // Truly no partners available (shouldn't happen if not isolated)
          logger.warn(`Player ${playerId} has no available partners despite not being isolated`);
          continue;
        }

        // Pick from any valid partner (ignoring recent history)
        const partnerId = anyValidPartners[Math.floor(Math.random() * anyValidPartners.length)];
        pairs.push([playerId, partnerId]);
        available.delete(playerId);
        available.delete(partnerId);
        continue;
      }

      // Pick random valid partner
      const partnerId = validPartners[Math.floor(Math.random() * validPartners.length)];

      pairs.push([playerId, partnerId]);
      available.delete(playerId);
      available.delete(partnerId);
    }

    return {
      pairs,
      unpaired: Array.from(available)
    };
  }

  /**
   * Round-robin pairing strategy
   * Cycles through all possible pairings systematically
   * @param {Array<number>} players - Available players
   * @param {number} roundNum - Current round
   * @returns {Object} - { pairs, unpaired }
   */
  _roundRobinPairing(players, roundNum) {
    // TODO: Implement proper round-robin scheduling
    // For now, fall back to random valid
    return this._randomValidPairing(players);
  }

  /**
   * Preferential attachment pairing
   * More connected players are more likely to be paired
   * @param {Array<number>} players - Available players
   * @returns {Object} - { pairs, unpaired }
   */
  _preferentialAttachmentPairing(players) {
    const available = new Set(players);
    const pairs = [];

    // Sort by degree (number of connections) - higher degree first
    const sorted = [...players].sort((a, b) => {
      return this.network.getDegree(b) - this.network.getDegree(a);
    });

    for (const playerId of sorted) {
      if (!available.has(playerId)) continue;

      const validPartners = this.network.getValidPartners(playerId)
        .filter(p => available.has(p));

      if (validPartners.length === 0) continue;

      // Among valid partners, prefer those with higher degree
      const partnerId = validPartners.sort((a, b) => {
        return this.network.getDegree(b) - this.network.getDegree(a);
      })[0];

      pairs.push([playerId, partnerId]);
      available.delete(playerId);
      available.delete(partnerId);
    }

    return {
      pairs,
      unpaired: Array.from(available)
    };
  }

  /**
   * Update recent partner history for a player
   * @param {number} playerId - Player ID
   * @param {number} partnerId - Partner ID
   */
  _updateHistory(playerId, partnerId) {
    if (!this.history[playerId]) {
      this.history[playerId] = [];
    }

    this.history[playerId].push(partnerId);

    // Keep only recent partners (based on max_consecutive_repeats)
    const maxHistory = this.config.maxConsecutiveRepeats || 2;
    if (this.history[playerId].length > maxHistory) {
      this.history[playerId].shift(); // Remove oldest
    }
  }

  /**
   * Get recent partners for a player (to avoid immediate repeats)
   * @param {number} playerId - Player ID
   * @returns {Array<number>} - Recent partner IDs
   */
  _getRecentPartners(playerId) {
    if (!this.config.allowRepeatPartners) {
      // If repeats not allowed, return all previous partners
      return this.getAllPartners(playerId);
    }
    return this.history[playerId] || [];
  }

  /**
   * Get all partners a player has ever been paired with
   * @param {number} playerId - Player ID
   * @returns {Array<number>} - All partner IDs
   */
  getAllPartners(playerId) {
    const partners = new Set();

    for (const { pairs } of this.allPairings) {
      for (const [p1, p2] of pairs) {
        if (p1 === playerId) partners.add(p2);
        if (p2 === playerId) partners.add(p1);
      }
    }

    return Array.from(partners);
  }

  /**
   * Get pairing history between two specific players
   * @param {number} player1 - First player ID
   * @param {number} player2 - Second player ID
   * @returns {Array<Object>} - Array of rounds they were paired: [{ round, ... }, ...]
   */
  getPairHistory(player1, player2) {
    const history = [];

    for (const { round, pairs } of this.allPairings) {
      for (const [p1, p2] of pairs) {
        if ((p1 === player1 && p2 === player2) ||
            (p1 === player2 && p2 === player1)) {
          history.push({ round });
        }
      }
    }

    return history;
  }

  /**
   * Get total number of times two players have been paired
   * @param {number} player1 - First player ID
   * @param {number} player2 - Second player ID
   * @returns {number} - Number of times paired
   */
  getTimesPaired(player1, player2) {
    return this.getPairHistory(player1, player2).length;
  }

  /**
   * Utility: Fisher-Yates shuffle
   * @param {Array} array - Array to shuffle
   * @returns {Array} - Shuffled array
   */
  _shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Serialize pairing history for storage
   * @returns {Object} - Serialized pairing data
   */
  serialize() {
    return {
      history: this.history,
      allPairings: this.allPairings,
      config: this.config
    };
  }

  /**
   * Deserialize pairing manager state
   * @param {Object} data - Serialized data
   * @param {NetworkGraph} network - Network graph instance
   * @returns {PairingManager} - Reconstructed pairing manager
   */
  static deserialize(data, network) {
    const manager = new PairingManager(network, data.config);
    manager.history = data.history || {};
    manager.allPairings = data.allPairings || [];
    return manager;
  }

  /**
   * Get summary statistics about pairing
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const totalRounds = this.allPairings.length;
    const totalPairs = this.allPairings.reduce((sum, { pairs }) => sum + pairs.length, 0);
    const totalIsolated = this.allPairings.reduce((sum, { isolated }) => sum + isolated.length, 0);
    const totalUnpaired = this.allPairings.reduce((sum, { unpaired }) => sum + unpaired.length, 0);

    return {
      totalRounds,
      totalPairs,
      avgPairsPerRound: totalPairs / totalRounds || 0,
      totalIsolated,
      totalUnpaired
    };
  }
}

module.exports = PairingManager;
