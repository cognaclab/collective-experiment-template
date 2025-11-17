/**
 * NetworkGraph - Manages the social network structure for networked experiments
 *
 * Represents player interactions as a directed graph where edges indicate
 * whether two players can be paired together. Supports dynamic edge removal
 * through ostracism/exclusion mechanisms.
 */

class NetworkGraph {
  /**
   * @param {number} groupSize - Number of players in the group
   * @param {string} topology - Initial network topology ('complete', 'empty', 'random')
   */
  constructor(groupSize, topology = 'complete') {
    this.groupSize = groupSize;
    this.graph = this.initializeGraph(groupSize, topology);
    this.edgeHistory = []; // Track all edge removals for logging
  }

  /**
   * Initialize the adjacency matrix based on topology
   * @param {number} n - Group size
   * @param {string} topology - Network topology type
   * @returns {Array<Array<boolean>>} - Adjacency matrix
   */
  initializeGraph(n, topology) {
    const graph = Array(n).fill(null).map(() => Array(n).fill(false));

    switch (topology) {
      case 'complete':
        // All pairs connected (except self-loops)
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i !== j) {
              graph[i][j] = true;
            }
          }
        }
        break;

      case 'empty':
        // No connections (all false)
        break;

      case 'random':
        // Random connections (50% probability)
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const connected = Math.random() > 0.5;
            graph[i][j] = connected;
            graph[j][i] = connected;
          }
        }
        break;

      default:
        throw new Error(`Unknown topology: ${topology}`);
    }

    return graph;
  }

  /**
   * Check if an edge exists between two players
   * @param {number} player1 - First player ID
   * @param {number} player2 - Second player ID
   * @returns {boolean} - True if edge exists
   */
  hasEdge(player1, player2) {
    if (player1 === player2) return false;
    if (player1 < 0 || player1 >= this.groupSize) return false;
    if (player2 < 0 || player2 >= this.groupSize) return false;
    return this.graph[player1][player2];
  }

  /**
   * Remove edge between two players
   * @param {number} player1 - First player ID
   * @param {number} player2 - Second player ID
   * @param {boolean} bidirectional - If true, remove both directions (default: true)
   * @param {Object} metadata - Optional metadata about the removal (round, reason, etc.)
   */
  removeEdge(player1, player2, bidirectional = true, metadata = {}) {
    if (player1 === player2) return;
    if (!this.hasEdge(player1, player2)) return; // Already removed

    // Remove the edge(s)
    this.graph[player1][player2] = false;
    if (bidirectional) {
      this.graph[player2][player1] = false;
    }

    // Log the removal
    this.edgeHistory.push({
      player1,
      player2,
      bidirectional,
      timestamp: new Date(),
      ...metadata
    });
  }

  /**
   * Get all valid partners for a player
   * @param {number} playerId - Player ID
   * @param {Array<number>} excludeList - Optional list of player IDs to exclude
   * @returns {Array<number>} - Array of valid partner IDs
   */
  getValidPartners(playerId, excludeList = []) {
    const valid = [];

    for (let i = 0; i < this.groupSize; i++) {
      if (i !== playerId &&
          this.graph[playerId][i] &&
          !excludeList.includes(i)) {
        valid.push(i);
      }
    }

    return valid;
  }

  /**
   * Check if a player is isolated (has no valid partners)
   * @param {number} playerId - Player ID
   * @returns {boolean} - True if player has no connections
   */
  isIsolated(playerId) {
    return this.getValidPartners(playerId).length === 0;
  }

  /**
   * Get the degree (number of connections) for a player
   * @param {number} playerId - Player ID
   * @returns {number} - Number of active connections
   */
  getDegree(playerId) {
    return this.getValidPartners(playerId).length;
  }

  /**
   * Get all isolated players in the network
   * @returns {Array<number>} - Array of isolated player IDs
   */
  getIsolatedPlayers() {
    const isolated = [];
    for (let i = 0; i < this.groupSize; i++) {
      if (this.isIsolated(i)) {
        isolated.push(i);
      }
    }
    return isolated;
  }

  /**
   * Get total number of edges in the network
   * @returns {number} - Total edge count (counting each undirected edge once)
   */
  getTotalEdges() {
    let count = 0;
    for (let i = 0; i < this.groupSize; i++) {
      for (let j = i + 1; j < this.groupSize; j++) {
        if (this.graph[i][j]) count++;
      }
    }
    return count;
  }

  /**
   * Get network density (proportion of possible edges that exist)
   * @returns {number} - Density between 0 and 1
   */
  getDensity() {
    const maxEdges = (this.groupSize * (this.groupSize - 1)) / 2;
    if (maxEdges === 0) return 0;
    return this.getTotalEdges() / maxEdges;
  }

  /**
   * Check if the network is connected (all players can reach each other)
   * Uses BFS to check connectivity
   * @returns {boolean} - True if network is connected
   */
  isConnected() {
    if (this.groupSize === 0) return true;

    const visited = new Array(this.groupSize).fill(false);
    const queue = [0];
    visited[0] = true;
    let visitedCount = 1;

    while (queue.length > 0) {
      const current = queue.shift();

      for (let i = 0; i < this.groupSize; i++) {
        if (this.graph[current][i] && !visited[i]) {
          visited[i] = true;
          visitedCount++;
          queue.push(i);
        }
      }
    }

    return visitedCount === this.groupSize;
  }

  /**
   * Get connected components in the network
   * @returns {Array<Array<number>>} - Array of components (each is array of player IDs)
   */
  getConnectedComponents() {
    const visited = new Array(this.groupSize).fill(false);
    const components = [];

    for (let start = 0; start < this.groupSize; start++) {
      if (visited[start]) continue;

      const component = [];
      const queue = [start];
      visited[start] = true;

      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);

        for (let i = 0; i < this.groupSize; i++) {
          if (this.graph[current][i] && !visited[i]) {
            visited[i] = true;
            queue.push(i);
          }
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Serialize the network for database storage
   * @returns {Object} - Serialized network state
   */
  serialize() {
    return {
      groupSize: this.groupSize,
      adjacencyMatrix: this.graph,
      totalEdges: this.getTotalEdges(),
      density: this.getDensity(),
      isolatedPlayers: this.getIsolatedPlayers(),
      isConnected: this.isConnected(),
      connectedComponents: this.getConnectedComponents(),
      edgeHistory: this.edgeHistory,
      timestamp: new Date()
    };
  }

  /**
   * Deserialize from stored state
   * @param {Object} data - Serialized network data
   * @returns {NetworkGraph} - Reconstructed NetworkGraph instance
   */
  static deserialize(data) {
    const network = new NetworkGraph(data.groupSize, 'empty');
    network.graph = data.adjacencyMatrix;
    network.edgeHistory = data.edgeHistory || [];
    return network;
  }

  /**
   * Create a deep copy of the network
   * @returns {NetworkGraph} - Cloned network
   */
  clone() {
    const cloned = new NetworkGraph(this.groupSize, 'empty');
    cloned.graph = this.graph.map(row => [...row]);
    cloned.edgeHistory = [...this.edgeHistory];
    return cloned;
  }

  /**
   * Get a human-readable summary of the network state
   * @returns {string} - Network summary
   */
  getSummary() {
    return `Network: ${this.groupSize} players, ${this.getTotalEdges()} edges, ` +
           `${this.getIsolatedPlayers().length} isolated, ` +
           `density: ${this.getDensity().toFixed(2)}, ` +
           `connected: ${this.isConnected()}`;
  }
}

module.exports = NetworkGraph;
