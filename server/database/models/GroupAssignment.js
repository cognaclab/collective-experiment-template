/**
 * GroupAssignment Model
 *
 * Audit trail for group formation decisions.
 * Written at runtime when GroupFormationService forms a new group.
 */

const { mongoose } = require('../connection');

const groupAssignmentSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        index: true
    },
    experimentName: {
        type: String,
        required: true,
        index: true
    },
    compositionType: {
        type: String,
        required: true,
        enum: [
            'homogeneous_binding',
            'homogeneous_individualizing',
            'even_mix',
            'uneven_binding_majority',
            'uneven_individualizing_majority'
        ]
    },
    groupSize: {
        type: Number,
        required: true
    },
    members: [{
        subjectId: { type: String, required: true },
        moralType: { type: String, enum: ['binding', 'individualizing', 'intermediate'] },
        bindingIndex: { type: Number }
    }],
    assignedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

groupAssignmentSchema.index({ compositionType: 1, experimentName: 1 });

module.exports = mongoose.model('GroupAssignment', groupAssignmentSchema);
