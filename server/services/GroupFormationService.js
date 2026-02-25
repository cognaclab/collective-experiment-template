/**
 * GroupFormationService
 *
 * Manages queue-based group formation for the live dynamic assignment pipeline.
 * Participants arrive, are classified (binding/individualizing/intermediate),
 * and sorted into groups matching one of five pre-registered composition types.
 */

const logger = require('../utils/logger');
const GroupAssignment = require('../database/models/GroupAssignment');

class GroupFormationService {
    constructor(config = {}) {
        this.groupSize = config.groupSize || 8;
        this.allowIntermediates = config.allowIntermediates || false;
        this.timeout = config.timeout || 300000; // 5 minutes
        this.experimentName = config.experimentName || 'unknown';

        // Composition targets: each defines how many binding (b) and individualizing (i) players
        this.compositionTargets = config.compositionTargets || [
            { type: 'homogeneous_binding',              b: 8, i: 0 },
            { type: 'homogeneous_individualizing',      b: 0, i: 8 },
            { type: 'even_mix',                         b: 4, i: 4 },
            { type: 'uneven_binding_majority',          b: 6, i: 2 },
            { type: 'uneven_individualizing_majority',  b: 2, i: 6 }
        ];

        // Queues by moral type
        this.queues = {
            binding: [],
            individualizing: [],
            intermediate: []
        };

        // Track how many groups of each type have been formed (for balanced allocation)
        this.formationCounts = {};
        for (const target of this.compositionTargets) {
            this.formationCounts[target.type] = 0;
        }

        // Timeout handles per participant
        this.timeouts = new Map();

        // Callback set by gameServer.js when a group is formed
        this.onGroupFormed = null;
    }

    /**
     * Add a participant to the formation queue
     * @param {string} subjectId - Participant's Prolific ID
     * @param {Object} classification - { moralType, bindingIndex, bindingScore, individualizingScore }
     * @param {Object} socket - Socket.IO client socket
     */
    onParticipantArrival(subjectId, classification, socket) {
        if (!classification || !classification.moralType) {
            logger.warn('Participant arrived without classification', { subjectId });
            return { queued: false, reason: 'no_classification' };
        }

        const moralType = classification.moralType;

        // Reject intermediates if not allowed
        if (moralType === 'intermediate' && !this.allowIntermediates) {
            logger.info('Intermediate participant rejected (config: allowIntermediates=false)', { subjectId });
            return { queued: false, reason: 'intermediate_not_allowed' };
        }

        // Check for duplicate
        if (this.isInQueue(subjectId)) {
            logger.warn('Participant already in queue', { subjectId });
            return { queued: false, reason: 'already_queued' };
        }

        const entry = {
            subjectId,
            moralType,
            bindingIndex: classification.bindingIndex,
            socket,
            joinedAt: Date.now()
        };

        this.queues[moralType].push(entry);

        logger.info('Participant added to formation queue', {
            subjectId,
            moralType,
            queueSizes: this.getQueueSizes()
        });

        // Set timeout for this participant
        const timeoutHandle = setTimeout(() => {
            this.handleTimeout(subjectId);
        }, this.timeout);
        this.timeouts.set(subjectId, timeoutHandle);

        // Try to form a group
        const formed = this.tryFormGroup();

        // Emit queue status to all waiting participants
        this.broadcastQueueStatus();

        return { queued: true, groupFormed: formed };
    }

    /**
     * Remove a participant from all queues (e.g., on disconnect)
     */
    removeParticipant(subjectId) {
        for (const type of Object.keys(this.queues)) {
            const idx = this.queues[type].findIndex(e => e.subjectId === subjectId);
            if (idx !== -1) {
                this.queues[type].splice(idx, 1);
                logger.info('Participant removed from queue', { subjectId, queueType: type });
                break;
            }
        }

        // Clear timeout
        if (this.timeouts.has(subjectId)) {
            clearTimeout(this.timeouts.get(subjectId));
            this.timeouts.delete(subjectId);
        }

        this.broadcastQueueStatus();
    }

    /**
     * Check if a participant is already in any queue
     */
    isInQueue(subjectId) {
        for (const type of Object.keys(this.queues)) {
            if (this.queues[type].some(e => e.subjectId === subjectId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Try to form a group from the current queues.
     * Priority: the composition type with the fewest formed groups that can be filled.
     * @returns {boolean} Whether a group was successfully formed
     */
    tryFormGroup() {
        const bindingCount = this.queues.binding.length;
        const individualizingCount = this.queues.individualizing.length;

        // Find all feasible composition targets (have enough of each type in queue)
        const feasible = this.compositionTargets.filter(target => {
            return bindingCount >= target.b && individualizingCount >= target.i;
        });

        if (feasible.length === 0) {
            return false;
        }

        // Pick the composition type with the fewest formations (balanced allocation)
        feasible.sort((a, b) => this.formationCounts[a.type] - this.formationCounts[b.type]);
        const chosen = feasible[0];

        // Select members from queues (FIFO order)
        const bindingMembers = this.queues.binding.splice(0, chosen.b);
        const individualizingMembers = this.queues.individualizing.splice(0, chosen.i);
        const allMembers = [...bindingMembers, ...individualizingMembers];

        // Clear timeouts for all selected members
        for (const member of allMembers) {
            if (this.timeouts.has(member.subjectId)) {
                clearTimeout(this.timeouts.get(member.subjectId));
                this.timeouts.delete(member.subjectId);
            }
        }

        // Update formation count
        this.formationCounts[chosen.type]++;

        logger.info('Group formed', {
            compositionType: chosen.type,
            bindingCount: chosen.b,
            individualizingCount: chosen.i,
            totalFormed: this.formationCounts[chosen.type],
            members: allMembers.map(m => m.subjectId)
        });

        // Write audit record to MongoDB
        this.writeGroupAssignment(chosen.type, allMembers);

        // Call the callback to create the room and start the game
        if (this.onGroupFormed) {
            this.onGroupFormed(chosen.type, allMembers);
        }

        return true;
    }

    /**
     * Write a GroupAssignment audit record to MongoDB
     */
    async writeGroupAssignment(compositionType, members) {
        try {
            await GroupAssignment.create({
                roomId: `group_${Date.now()}_${compositionType}`,
                experimentName: this.experimentName,
                compositionType,
                groupSize: members.length,
                members: members.map(m => ({
                    subjectId: m.subjectId,
                    moralType: m.moralType,
                    bindingIndex: m.bindingIndex
                }))
            });
        } catch (error) {
            logger.error('Failed to write GroupAssignment', { error: error.message });
        }
    }

    /**
     * Handle timeout for a participant who waited too long
     */
    handleTimeout(subjectId) {
        logger.info('Participant timed out in queue', { subjectId });

        // Find the participant's socket
        for (const type of Object.keys(this.queues)) {
            const entry = this.queues[type].find(e => e.subjectId === subjectId);
            if (entry && entry.socket) {
                entry.socket.emit('formation_timeout', {
                    message: 'Not enough participants joined in time. Please try again later.'
                });
            }
        }

        this.removeParticipant(subjectId);
    }

    /**
     * Broadcast current queue status to all waiting participants
     */
    broadcastQueueStatus() {
        const status = this.getQueueStatus();

        for (const type of Object.keys(this.queues)) {
            for (const entry of this.queues[type]) {
                if (entry.socket) {
                    entry.socket.emit('formation_queue_update', status);
                }
            }
        }
    }

    /**
     * Get current queue status (for waiting room UI)
     */
    getQueueStatus() {
        const sizes = this.getQueueSizes();
        const totalWaiting = sizes.binding + sizes.individualizing + sizes.intermediate;

        return {
            totalWaiting,
            queueSizes: sizes,
            groupSize: this.groupSize,
            formationCounts: { ...this.formationCounts }
        };
    }

    /**
     * Get queue sizes by type
     */
    getQueueSizes() {
        return {
            binding: this.queues.binding.length,
            individualizing: this.queues.individualizing.length,
            intermediate: this.queues.intermediate.length
        };
    }

    /**
     * Clean up all timeouts (for server shutdown)
     */
    destroy() {
        for (const [, handle] of this.timeouts) {
            clearTimeout(handle);
        }
        this.timeouts.clear();
    }
}

module.exports = GroupFormationService;
