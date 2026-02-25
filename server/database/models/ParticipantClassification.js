/**
 * ParticipantClassification Model
 *
 * Stores the moral foundations classification for each participant,
 * used by GroupFormationService to sort participants into groups.
 * Classifications are imported offline via scripts/classify-participants.js.
 */

const { mongoose } = require('../connection');

const participantClassificationSchema = new mongoose.Schema({
    subjectId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    moralType: {
        type: String,
        required: true,
        enum: ['binding', 'individualizing', 'intermediate'],
        index: true
    },
    bindingIndex: {
        type: Number
    },
    bindingScore: {
        type: Number
    },
    individualizingScore: {
        type: Number
    },
    classifiedAt: {
        type: Date,
        default: Date.now
    },
    classificationBatch: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ParticipantClassification', participantClassificationSchema);
