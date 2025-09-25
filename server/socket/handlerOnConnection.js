'use strict';

/**
 * Handle 'core is ready'
 * @param {Object} config - game env parameters
 * @param {Object} client - the Socket.IO client socket
 * @param {Object} io
 */

function onConnectioncConfig({ config, client, io }) {

  // Assign client's unique identifier
	client.subjectID = client.request?._query.subjectID;
	client.started = 0;

    // check sessionName already assigned
	const incomingSessionName = client.request?._query.sessionName;

	// Case 1: First-time connection (no sessionName provided)
    if (typeof incomingSessionName === 'undefined') {
        client.session = client.id; // assign new session
        client.join(client.session);
        config.sessionNameSpace[client.session] = 1;
        console.log(`- Exp. ID ${client.session} assigned to ${client.subjectID}`);

    // Case 2: Reconnection from a completed session
    } else if (incomingSessionName === 'already_finished') {
        client.session = incomingSessionName;
        client.room = 'decoyRoom';
        client.join(client.session);
        client.join(client.room);
        console.log(' - Session marked as already finished; decoyRoom assigned');

    // Case 3: Unexpected reconnection from a known session (e.g., browser auto-reconnect)
    } else {
        client.session = 'already_finished';
        client.room = 'decoyRoom';
        client.join(client.session);
        client.join(client.room);

        // Notify client they've been sent to decoyRoom
        io.to(client.session).emit('S_to_C_welcomeback', {
            sessionName: client.session,
            roomName: client.room
        });

        // Mark the original session as already handled
        config.sessionNameSpace[incomingSessionName] = 1;

        // Log the reconnection
        console.log(` - ${incomingSessionName} (${client.subjectID}) in room ${client.request._query.roomName} reconnected`);
    }

}

module.exports = { onConnectioncConfig };
