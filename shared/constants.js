// Shared constants between frontend and backend
module.exports = {
    // Server Configuration
    PORTS: {
        WEB: 8000,
        GAME: 8181
    },
    
    // Socket Events
    SOCKET_EVENTS: {
        // Connection events
        CORE_READY: 'core is ready',
        CLIENT_CONNECTED: 'client connected',
        CLIENT_DISCONNECTED: 'disconnect',
        
        // Game events  
        CHOICE_MADE: 'choice made',
        TEST_PASSED: 'test passed',
        DATA_FROM_INDIV: 'Data from Indiv',
        RESULT_FEEDBACK_ENDED: 'result feedback ended',
        NEW_GAME_ROUND_READY: 'new gameRound ready',
        
        // Server to client events
        WELCOME_BACK: 'S_to_C_welcomeback',
        PARAMETERS: 'this_is_your_parameters',
        ALL_PASSED_TEST: 'all passed the test',
        PROCEED_TO_RESULT: 'Proceed to the result scene',
        PROCEED_TO_NEXT_TRIAL: 'Proceed to next trial'
    },
    
    // Game States
    GAME_STAGES: {
        FIRST_WAITING: 'firstWaiting',
        SECOND_WAITING: 'secondWaitingRoom', 
        THIRD_WAITING: 'thirdWaitingRoom',
        MAIN_TASK: 'mainTask',
        RESULT_FEEDBACK: 'resultFeedback',
        INSTRUCTION: 'instruction',
        RESUMING: 'resuming'
    },
    
    // Default Values
    DEFAULTS: {
        SESSION_NO: 0,
        MAX_GROUP_SIZE: 5,
        MIN_GROUP_SIZE: 2,
        HORIZON: 20,
        TOTAL_GAME_ROUNDS: 2,
        K_ARMED_BANDIT: 3,
        MAX_CHOICE_TIME: 10000,
        MAX_WAITING_TIME: 10000,
        MAX_TEST_TIME: 240000
    }
};