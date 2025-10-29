'use strict';
class CircleSpin {
    constructor(scene, x, y, radius = 64, color = 0xffffff) {
        this.position = { x: 0, y: 0 };
        this.radius = 64;
        this.color = 0xffffff;
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
    }
    static create(scene, x, y, radius = 64, color = 0xffffff) {
        return new CircleSpin(scene, x, y, radius, color);
    }
    set x(value) {
        this.position.x = value;
        if (this.circle) {
            this.circle.x = value;
        }
    }
    get x() {
        return this.position.x;
    }
    set y(value) {
        this.position.y = value;
        if (this.circle) {
            this.circle.y = value;
        }
    }
    get y() {
        return this.position.y;
    }
    useColor(color) {
        this.color = color;
        return this;
    }
    addToContainer(container, x, y) {
        if (!container) {
            return this;
        }
        if (!this.circle || !this.timeline) {
            this.make();
        }
        container.add(this.circle);
        if (x !== undefined) {
            this.x = x;
        }
        if (y !== undefined) {
            this.y = y;
        }
        return this;
    }
    make(config = {}) {
        if (this.circle) {
            this.circle.destroy();
        }
        this.circle = this.scene.add.circle(this.x, this.y, this.radius, this.color, 1);
        if (this.timeline) {
            this.timeline.destroy();
        }
        const { loopDelay = 0, spins = 10 } = config;
        this.timeline = this.scene.add.timeline({
            loop: -1,
            loopDelay
        });
        const fastSpins = Math.floor(spins * 0.8);
        const slowSpins = spins - fastSpins;
        let duration = 300;
        for (let i = 0; i < fastSpins; ++i) {
            this.timeline.add({
                targets: this.circle,
                scaleX: 0,
                ease: Phaser.Math.Easing.Sine.InOut,
                duration
            })
                .add({
                targets: this.circle,
                scaleX: 1,
                ease: Phaser.Math.Easing.Sine.InOut,
                duration
            });
            if (duration > 100) {
                duration *= 0.5;
            }
        }
        for (let i = 0; i < slowSpins; ++i) {
            duration *= 2;
            this.timeline.add({
                targets: this.circle,
                scaleX: 0,
                ease: Phaser.Math.Easing.Sine.InOut,
                duration
            })
                .add({
                targets: this.circle,
                scaleX: 1,
                ease: Phaser.Math.Easing.Sine.InOut,
                duration
            });
        }
        return this;
    }
    play() {
        var _a;
        if (!this.circle || !this.timeline) {
            this.make();
        }
        (_a = this.timeline) === null || _a === void 0 ? void 0 : _a.play();
        return this;
    }
}

class HeartBeat {
    constructor(scene, x, y, color = 0xffffff, width = 128, height = 128) {
        this.position = { x: 0, y: 0 };
        this.width = 128;
        this.height = 128;
        this.color = 0xffffff;
        this.scene = scene;
        this.position.x = x;
        this.position.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
    }
    static create(scene, x, y, color = 0xffffff, width = 128, height = 128) {
        return new HeartBeat(scene, x, y, color, width, height);
    }
    get x() {
        return this.position.x;
    }
    set x(v) {
        this.position.x = v;
        if (this.graphics) {
            this.graphics.x = v;
        }
    }
    get y() {
        return this.position.y;
    }
    set y(v) {
        this.position.y = v;
        if (this.graphics) {
            this.graphics.y = v;
        }
    }
    useColor(color) {
        this.color = color;
        return this;
    }
    useWidth(width) {
        this.width = width;
        return this;
    }
    useHeight(height) {
        this.height = height;
        return this;
    }
    addToContainer(container, x, y) {
        if (!container) {
            return this;
        }
        if (!this.graphics) {
            this.make();
        }
        container.add(this.graphics);
        if (x !== undefined) {
            this.x = x;
        }
        if (y !== undefined) {
            this.y = y;
        }
        return this;
    }
    make() {
        const { x, y } = this.position;
        const halfWidth = this.width * 0.5;
        const halfHeight = this.height * 0.5;
        const halfLineWidth = 4;
        const curve = new Phaser.Curves.Path();
        curve.moveTo(0, halfHeight);
        curve.splineTo([
            new Phaser.Math.Vector2(-halfWidth, -halfHeight * 0.3),
            new Phaser.Math.Vector2(-halfWidth * 0.5, -halfHeight),
            new Phaser.Math.Vector2(0, -halfHeight * 0.55)
        ]);
        curve.moveTo(-halfLineWidth, -halfHeight * 0.55);
        curve.splineTo([
            new Phaser.Math.Vector2(halfWidth * 0.5, -halfHeight),
            new Phaser.Math.Vector2(halfWidth, -halfHeight * 0.3),
            new Phaser.Math.Vector2(-halfLineWidth, halfHeight)
        ]);
        this.graphics = this.scene.add.graphics({ x, y });
        this.graphics.fillStyle(this.color, 1);
        this.graphics.fillPoints(curve.getPoints());
        return this;
    }
    play() {
        if (!this.graphics) {
            this.make();
        }
        if (this.timeline) {
            this.timeline.destroy();
        }
        this.timeline = this.scene.add.timeline({
            onStart: () => {
                this.graphics.scale = 0.95;
            },
            loop: -1,
            loopDelay: 100
        });
        const ease = BezierEasing(0.215, 0.61, 0.355, 1);
        this.timeline.add({
            targets: this.graphics,
            scale: 1.2,
            duration: 100,
            ease
        })
            .add({
            targets: this.graphics,
            scale: 0.85,
            duration: 300,
            ease
        })
            .add({
            targets: this.graphics,
            scale: 1,
            duration: 200,
            ease
        })
            .add({
            targets: this.graphics,
            scale: 0.95,
            duration: 100,
            ease
        })
            .add({
            targets: this.graphics,
            scale: 0.9,
            duration: 200,
            ease
        });
        this.timeline.play();
        return this;
    }
}

/* ========================================
	Functions
=========================================== */

export function createCircle (scene, page, x, y, radius, color) {
		CircleSpin.create(scene, x, y, radius, color)
					.addToContainer(page)
					.play();
}

export function createHeartBeat (scene, page, x, y) {
    HeartBeat.create(scene, x, y)
                            .addToContainer(page)
                            .play()
    scene.displayName('Heart Beat', x, y, page)
}

export function createWindow (game, scene_name, data) {

	game.scene.start(scene_name, data);
	game.scene.bringToTop(scene_name);

	setTimeout(function(){
		game.scene.stop(scene_name);
	},3000);

}


// a function to create an n-dimensional array
export function createArray(length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = createArray.apply(this, args);
    }

    return arr;
}


// randomly choosing an integer between min and max
export function rand(max, min = 0) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

//
export function isNotNegative (element) {
	return element >= 0;
}

/**
	Box-Muller Method
	pseudo normal distribution (http://d.hatena.ne.jp/iroiro123/20111210/1323515616)
	@param number m: mean μ
	@param number sigma: variance = σ^2
	@return number generated
	Box-Muller Method
*/
export function BoxMuller(m, sigma) {
	let a = 1 - Math.random();
	let b = 1 - Math.random();
	let c = Math.sqrt(-2 * Math.log(a));
	if (0.5 - Math.random() > 0) {
		return c * Math.sin(Math.PI * 2 * b) * sigma + m;
	} else {
		return c * Math.cos(Math.PI * 2 * b) * sigma + m;
	}
};

export function BoxMuller_positive(m, sigma, max) {
    let a = 1 - Math.random();
    let b = 1 - Math.random();
    let c = Math.sqrt(-2 * Math.log(a));
    let e;
    if(0.5 - Math.random() > 0) {
        e = Math.abs( c * Math.sin(Math.PI * 2 * b) * sigma + m );
    }else{
        e = Math.abs( c * Math.cos(Math.PI * 2 * b) * sigma + m );
    }
    if (e < max) {
        return e;
    } else {
        return max;
    }
};

// Sum of all elements of the array
export function sum (arr, fn) {
	if (fn) {
		return sum(arr.map(fn));
	}
	else {
		return arr.reduce(function(prev, current, i, arr) {
			return prev+current;
		});
	}
};

export function repeatelem (elem, n) {
    // returns an array with element elem repeated n times.
    let arr = [];

    for (let i = 0; i < n; i++) {
        arr = arr.concat(elem);
    };
    return arr;
};

export function waitingBarCompleted () {
	//console.log('waitingBarCompleted is fired');
}

export function debug_pointerdown (x, y) {
	socket.emit('debug pointerdown!', {x: x, y: y});
}

export function sending_core_is_ready (isPreloadDone) {
	if (isPreloadDone) {
		socket.emit('core is ready', {latency: 0, maxLatencyForGroupCondition: maxLatencyForGroupCondition});
		// console.log('emitting "core is ready" to the server');
	}
}

export function goToQuestionnaire () {
	////console.log('goToQuestionnaire()');
	$("#form").submit();
}

export function settingConfirmationID (id) {
	$("#confirmationID").val(id);
}

export function testFunction (x, y, this_game) {
	// console.log('dude was clicked at x = '+x + '; y = '+y);
	this_game.game.scene.start('SceneFeedback');
	this_game.game.scene.sleep('SceneDebugEnv');
}

export function debug_pointerdown_feedback (this_game) {
	this_game.game.scene.wake('SceneDebugEnv');
	this_game.game.scene.sleep('SceneFeedback');
}

export function showStars_4ab (num_option1, num_option2, num_option3, num_option4, socialInfoY, ownChoice) {

    

    let mod_num_option1 = num_option1 % 5
    ,   mod_num_option2 = num_option2 % 5
    ,   mod_num_option3 = num_option3 % 5
    ,   mod_num_option4 = num_option4 % 5
    ,   quotient_num_option1 = Math.floor(num_option1 / 5)
    ,   quotient_num_option2 = Math.floor(num_option2 / 5)
    ,   quotient_num_option3 = Math.floor(num_option3 / 5)
    ,   quotient_num_option4 = Math.floor(num_option4 / 5)
    ,   option1_positionX_new = (option1_positionX + space_between_boxes*0)-15 + 10*quotient_num_option1
    ,   option2_positionX_new = (option1_positionX + space_between_boxes*1)-15 + 10*quotient_num_option2
    ,   option3_positionX_new = (option1_positionX + space_between_boxes*2)-15 + 10*quotient_num_option3
    ,   option4_positionX_new = (option1_positionX + space_between_boxes*3)-15 + 10*quotient_num_option4
    ;

    // option1
    // First, draw 5 stars
    if (quotient_num_option1 > 0) {
        if (num_option1 == 5 & ownChoice == 0) {
            stars_sure[0] = this.add.group({
                key: 'star_self',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 0,
                setXY: { x: option1_positionX_new, y: socialInfoY-25, stepY: -15 }
            });
            stars_sure[quotient_num_option1] = this.add.group({
                key: 'star',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 3,
                setXY: { x: option1_positionX_new, y: socialInfoY-25-15, stepY: -15 }
            });
        } else {
            for (let q=0; q<quotient_num_option1; q++) {
                stars_option1[q] = this.add.group({
                    key: 'star',
                    // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                    // which is just what we need for our game:
                    repeat: 5-1,
                    setXY: { x: option1_positionX_new - 20*q, y: socialInfoY-25, stepY: -15 }
                });
            }
        }
    }
    // Then, draw the remaining stars
    if (mod_num_option1 > 0) {
        if (ownChoice == 0) {
            stars_sure[quotient_num_option1] = this.add.group({
                key: 'star_self',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 0,
                setXY: { x: option1_positionX_new - 20*quotient_num_option1, y: socialInfoY-25, stepY: -15 }
            });
            if (mod_num_option1-1 > 0) {
                stars_sure[quotient_num_option1] = this.add.group({
                    key: 'star',
                    // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                    // which is just what we need for our game:
                    repeat: mod_num_option1-2,
                    setXY: { x: option1_positionX_new - 20*quotient_num_option1, y: socialInfoY-25-15, stepY: -15 }
                });
            }
        } else {
            stars_sure[quotient_num_option1] = this.add.group({
                key: 'star',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: mod_num_option1-1,
                setXY: { x: option1_positionX_new - 20*quotient_num_option1, y: socialInfoY-25, stepY: -15 }
            });
        }    
    }
    

    // option2
    // First, draw 5 stars
    if (quotient_num_option2 > 0) {
        if (num_option2 == 5 & ownChoice == 1) {
            stars_sure[0] = this.add.group({
                key: 'star_self',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 0,
                setXY: { x: option2_positionX_new, y: socialInfoY-25, stepY: -15 }
            });
            stars_sure[quotient_num_option2] = this.add.group({
                key: 'star',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 3,
                setXY: { x: option2_positionX_new, y: socialInfoY-25-15, stepY: -15 }
            });
        } else {
            for (let q=0; q<quotient_num_option2; q++) {
                stars_option2[q] = this.add.group({
                    key: 'star',
                    // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                    // which is just what we need for our game:
                    repeat: 5-1,
                    setXY: { x: option2_positionX_new - 20*q, y: socialInfoY-25, stepY: -15 }
                });
            }
        }
    }
    // Then, draw the remaining stars
    if (mod_num_option2 > 0) {
        if (ownChoice == 1) {
            stars_sure[quotient_num_option2] = this.add.group({
                key: 'star_self',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 0,
                setXY: { x: option2_positionX_new - 20*quotient_num_option2, y: socialInfoY-25, stepY: -15 }
            });
            if (mod_num_option2-1 > 0) {
                stars_sure[quotient_num_option2] = this.add.group({
                    key: 'star',
                    // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                    // which is just what we need for our game:
                    repeat: mod_num_option2-2,
                    setXY: { x: option2_positionX_new - 20*quotient_num_option2, y: socialInfoY-25-15, stepY: -15 }
                });
            }
        } else {
            stars_sure[quotient_num_option2] = this.add.group({
                key: 'star',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: mod_num_option2-1,
                setXY: { x: option2_positionX_new - 20*quotient_num_option2, y: socialInfoY-25, stepY: -15 }
            });
        }    
    }

    // option3
    // First, draw 5 stars
    if (quotient_num_option3 > 0) {
        if (num_option3 == 5 & ownChoice == 2) {
            stars_sure[0] = this.add.group({
                key: 'star_self',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 0,
                setXY: { x: option3_positionX_new, y: socialInfoY-25, stepY: -15 }
            });
            stars_sure[quotient_num_option3] = this.add.group({
                key: 'star',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 3,
                setXY: { x: option3_positionX_new, y: socialInfoY-25-15, stepY: -15 }
            });
        } else {
            for (let q=0; q<quotient_num_option3; q++) {
                stars_option3[q] = this.add.group({
                    key: 'star',
                    // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                    // which is just what we need for our game:
                    repeat: 5-1,
                    setXY: { x: option3_positionX_new - 20*q, y: socialInfoY-25, stepY: -15 }
                });
            }
        }
    }
    // Then, draw the remaining stars
    if (mod_num_option3 > 0) {
        if (ownChoice == 2) {
            stars_sure[quotient_num_option3] = this.add.group({
                key: 'star_self',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: 0,
                setXY: { x: option3_positionX_new - 20*quotient_num_option3, y: socialInfoY-25, stepY: -15 }
            });
            if (mod_num_option3-1 > 0) {
                stars_sure[quotient_num_option3] = this.add.group({
                    key: 'star',
                    // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                    // which is just what we need for our game:
                    repeat: mod_num_option3-2,
                    setXY: { x: option3_positionX_new - 20*quotient_num_option3, y: socialInfoY-25-15, stepY: -15 }
                });
            }
        } else {
            stars_sure[quotient_num_option3] = this.add.group({
                key: 'star',
                // Because it creates 1 child automatically, repeating 1 times means we'll get 2 in total,
                // which is just what we need for our game:
                repeat: mod_num_option3-1,
                setXY: { x: option3_positionX_new - 20*quotient_num_option3, y: socialInfoY-25, stepY: -15 }
            });
        }    
    }



}

export function showPublicInfo (shared_payoff, shared_option_position, socialInfoY) {
    // console.log('shared_payoff = ' + shared_payoff);
    // console.log('shared_option_position = ' + shared_option_position);

    let public_info_text = []
    ,   public_info_text_position = []
    ,   public_info_count = repeatelem(0, numOptions)
    ;

    for (let i=0; i < numOptions; i++) {
        public_info_text_position[i] = (option1_positionX + space_between_boxes * i)-15;
    }

    for (let i=0; i < shared_payoff.length; i++) {
        // Adding payoff texts
        public_info_text[i] = this.add.text(
            public_info_text_position[shared_option_position[i]-1]
            , socialInfoY - 25 * public_info_count[shared_option_position[i]-1]
            , shared_payoff[i]
            , { fontSize: '30px', fill: noteColor }
            ).setOrigin(0.5, 0.5);
        // Updating how many times the same X position has been counted already
        public_info_count[shared_option_position[i]-1]++;
    }

}

// madeChoice
export function madeChoice (optionLocation, choiceType, optionOrder, reactionTime, trial = null) {
    const thisTrial = trial !== null ? trial : currentTrial;

    let thisChoice;
    if (optionLocation == -1) {
        thisChoice = 0;//'miss';
        payoffText.x = 400;
    } else {
        // "optionLocation" just indicates a position of the chosen option in the subject's monitor,
        // e.g., optionLocation == 1 when she chose the left option.
        // Therefore, I need to translate this position into the actual option
        // thisChoice is an indicator of the actual option chosen
        thisChoice = optionOrder[optionLocation -1];
        payoffText.x = option1_positionX + space_between_boxes*(optionLocation-1);
    }

    // calculating the payoff from this choice
    if (choiceType == 'miss') {
        payoff = 0;
        // didShare = 0;
        if (indivOrGroup > -1) { // if don't want to send indiv data, indivOrGroup == 1
            // socket.emit('choice made',
            //     {chosenOptionFlag:-1 // chosen option's id
            //         , num_choice: -1 // miss == -1
            //         , individual_payoff: 0
            //         , subjectNumber: subjectNumber
            //         , thisTrial: thisTrial
            //     });
            socket.emit('miss this trial',
                {subjectNumber: subjectNumber
                ,    thisTrial: thisTrial
                });
        }
    } else {
        // choiceType == 'groupPayoff'
        // Build prob_means array dynamically based on number of options
        const currentTrialProbs = prob_means.map(armProbs => armProbs[thisTrial-1]);
        // Use thisChoice (machine ID) to index prob_means, not optionLocation (screen position)
        // prob_means is indexed by machine ID - probabilities stay with machines even when positions shuffle
        payoffGenerator(optionLocation, thisChoice-1, prob_means[thisChoice-1][thisTrial-1], currentTrialProbs, reactionTime, thisTrial);
        // let individual_payoff = payoffGenerator(optionLocation, thisChoice-1, optionsKeyList[thisChoice-1], payoffList[optionsKeyList[thisChoice-1]], probabilityList[optionsKeyList[thisChoice-1]], mySocialInfo);
    }
    // score += individual_payoff;
    // scoreText.setText('Total score: ' + score);
    // payoffText.setText(payoff);
    // payoffText.visible = true;
    trialText.setText(' - Current trial: ' + thisTrial + ' / ' + horizon);
}

export function payoffGenerator(chosenOptionLocation, num_choice, payoffProb, prob_means, reactionTime, trial = null) {
    const thisTrial = trial !== null ? trial : currentTrial;

    let roulette = Math.random()
    let this_individual_payoff
    if (payoffProb >= roulette) { // reward event
        this_individual_payoff = 1 * 100;
        myChoices.push(num_choice);
    } else { // no reward event
        this_individual_payoff = 0;
        myChoices.push(num_choice);
    }

    myLastChoiceFlag = chosenOptionLocation;
    socket.emit('choice made',
        {chosenOptionLocation: chosenOptionLocation // location of the chosen option
            , num_choice: num_choice // chosen option's id
            , individual_payoff: this_individual_payoff
            , subjectNumber: subjectNumber
            , thisTrial: thisTrial
            , miss: false
            , prob_means: prob_means
            , reactionTime: reactionTime
        });
    // return this_individual_payoff;
}

export function randomChoiceFromBinary(chosenOptionFlag, num_choice, choice, payoffList, p_rare, socialInfo, publicInfo) {
    let roulette = Math.random()
    let noise = BoxMuller(0, smallNoise)
    let thisPayoff
    if (p_rare < roulette) { // common event
        thisPayoff = Math.floor((payoffList[0] + noise)*10);
        if (thisPayoff<0) thisPayoff = 0;
        myEarnings.push(thisPayoff);
        myChoices.push(choice);
    } else { // rare event
        thisPayoff = Math.floor((payoffList[1] + noise)*10);
        if (thisPayoff<0) thisPayoff = 0;
        myEarnings.push(thisPayoff);
        myChoices.push(choice);
    }
    myLastChoiceFlag = chosenOptionFlag;
    if (indivOrGroup > -1) { // if don't want to send indiv data, indivOrGroup == 1
        socket.emit('choice made', 
            {chosenOptionFlag:chosenOptionFlag
                , num_choice: num_choice
                , choice: choice
                , payoff: thisPayoff
                , socialInfo:socialInfo
                , publicInfo:publicInfo
                , totalEarning: (totalEarning+thisPayoff)
                , subjectNumber:subjectNumber
                // , riskDistributionId:riskDistributionId
                , thisTrial:currentTrial
            });
    } else {
        saveChoiceDataLocally(
            {chosenOptionFlag:chosenOptionFlag
            , choice: choice
            , payoff: thisPayoff
            , socialInfo:socialInfo
            , publicInfo:publicInfo
            , totalEarning: (totalEarning+thisPayoff)
            , subjectNumber:subjectNumber
            // , riskDistributionId:riskDistributionId
        });
    }
    //console.log('choice was made: choice = ' + choice + ' and payoff = ' + thisPayoff + '.');
    return thisPayoff;
}


export function randomChoiceFromFour_decreasing(this_trial, chosenOptionFlag, num_choice, choice, payoffList, p_rare, socialInfo, publicInfo) {
    let roulette = Math.random()
    let noise = BoxMuller(0, smallNoise)
    let thisPayoff
    let thisPayoff_base
    // == this block manages the decrease of the mean payoff of the sure options
    if (choice == 'sure1') {
        thisPayoff_base = payoffList[0] - (1/60) * (this_trial - 10);
        if (thisPayoff_base > 2) {thisPayoff_base = 2};
        // console.log('sure 1: ' + thisPayoff_base);
    } else if (choice == 'sure2' | choice == 'sure3') {
        thisPayoff_base = payoffList[0] - (1/60) * this_trial;
        if (thisPayoff_base < 0.25) {thisPayoff_base = 0.25};
    } else {
        thisPayoff_base = payoffList[1]
    }
    // == end of the decreasing payoff
    if (p_rare < roulette) { // common event
        thisPayoff = Math.floor((payoffList[0] + noise)*100);
        myEarnings.push(thisPayoff);
        myChoices.push(choice);
    } else { // rare event
        thisPayoff = Math.floor((thisPayoff_base + noise)*100);
        myEarnings.push(thisPayoff);
        myChoices.push(choice);
    }
    myLastChoiceFlag = chosenOptionFlag;
    if (indivOrGroup > -1) { // if don't want to send indiv data, indivOrGroup == 1
        socket.emit('choice made 4ab', 
            {chosenOptionFlag:chosenOptionFlag
                , num_choice: num_choice
                , choice: choice
                , payoff: thisPayoff
                , socialInfo:socialInfo
                , publicInfo:publicInfo
                , totalEarning: (totalEarning+thisPayoff)
                , subjectNumber:subjectNumber
                // , riskDistributionId:riskDistributionId
                , thisTrial:currentTrial});
    } else {
        saveChoiceDataLocally(
            {chosenOptionFlag:chosenOptionFlag
                , choice: choice
                , payoff: thisPayoff
                , socialInfo:socialInfo
                , publicInfo:publicInfo
                , totalEarning: (totalEarning+thisPayoff)
                , subjectNumber:subjectNumber
                // , riskDistributionId:riskDistributionId
            });
    }
    //console.log('choice was made: choice = ' + choice + ' and payoff = ' + thisPayoff + '.');
    return thisPayoff;
}



// random choice with probability -- Gaussian distribution
export function randomChoiceFromGaussian(choice, socialInfo, publicInfo) {
    let thisPayoff
    if (choice == 'sure') {
        thisPayoff = BoxMuller(mean_sure, sd_sure)
        thisPayoff = Math.floor(thisPayoff*100)
    } else {
        thisPayoff = BoxMuller(mean_risky, sd_risky)
        thisPayoff = Math.floor(thisPayoff*100)
    }

    if (thisPayoff < 0 ) thisPayoff = 0
    if (thisPayoff > 2*mean_risky*100 ) thisPayoff = 2*mean_risky*100
    if (indivOrGroup > -1) { // if don't want to send indiv data, indivOrGroup == 1
        socket.emit('choice made', 
            {choice: choice
                , payoff: thisPayoff
                , socialInfo:socialInfo
                , publicInfo:publicInfo
                , totalEarning: (totalEarning+thisPayoff)
                , subjectNumber:subjectNumber
                // , riskDistributionId:riskDistributionId
                , thisTrial:currentTrial
            });
    } else {
        saveChoiceDataLocally(
            {choice: choice
                , payoff: thisPayoff
                , socialInfo:socialInfo
                , publicInfo:publicInfo
                , totalEarning: (totalEarning+thisPayoff)
                , subjectNumber:subjectNumber
                // , riskDistributionId:riskDistributionId
            });
    }
    // console.log('choice was made: choice = ' + choice + ' and payoff = ' + thisPayoff + '.');
    return thisPayoff;
}

export function saveChoiceDataLocally (data) {
    let now = new Date()
    //, timeElapsed = now - data.firstTrialStartingTime
    ;
    myLastChoice = data.choice;
    //myLastChoiceFlag = data.chosenOptionFlag;
    myData.push(
        {   date: now.getUTCFullYear() + '-' + (now.getUTCMonth() + 1) +'-' + now.getUTCDate()
        ,   time: now.getUTCHours()+':'+now.getUTCMinutes()+':'+now.getUTCSeconds()
        ,   exp_condition: exp_condition
        ,   isLeftRisky: isLeftRisky
        ,   indivOrGroup: indivOrGroup
        ,   room: myRoom
        ,   confirmationID: confirmationID
        ,   subjectID: subjectID
        ,   round: currentTrial
        ,   chosenOptionFlag: data.chosenOptionFlag
        ,   choice: data.choice
        ,   payoff: data.payoff
        ,   totalEarning: data.totalEarning
        ,   behaviouralType: 'choice'
        ,   latency: NaN //sum(averageLatency)/averageLatency.length
        ,   maxGroupSize: maxGroupSize
        // ,   riskDistributionId: data.riskDistributionId
        }
    );

    if (currentTrial >= horizon) {
        socket.emit('Data from Indiv', myData);
    }
}


// random choice with equal probability
export function choose(arr) {
    var index = Math.floor(Math.random() * arr.length);
    return arr[index];
}

export function settingBanditPayoffs (numOptions, taskID, horizon, changes, environments, gameRound) {
    let prob_means = createArray(numOptions, horizon)
    ;
    
    switch (taskID) {
        // ['static', 'dynamic'] 
        case 'static': // 
            for (let i = 0; i < numOptions; i++) {
                for (let t = 0; t < horizon; t++) {
                    prob_means[i][t] = environments[gameRound+1][i];
                }
            }
            break;
        case 'dynamic': // 
            for (let i = 0; i < numOptions; i++) {
                for (let t = 0; t < changes[0]; t++) {
                    prob_means[i][t] = environments[1][i];
                }
                for (let t = changes[0]; t < changes[1]; t++) {
                    prob_means[i][t] = environments[2][i];
                }
                for (let t = changes[1]; t < changes[2]; t++) {
                    prob_means[i][t] = environments[3][i];
                }
                for (let t = changes[2]; t < horizon; t++) {
                    prob_means[i][t] = environments[4][i];
                }
            }
            break;

        // ==== Pilot condition =
        default:
            for (let i = 0; i < numOptions; i++) {
                for (let t = 0; t < horizon; t++) {
                    prob_means[i][t] = environments[0][i];
                }
            }
            break;
    }

    return prob_means;
}

export function settingRiskDistribution (id) {
    switch (id) {
        // 1, 2, 3, 4
        case 1: // Suboptimal-risky, positively-skewed
            pRiskyRare = 0.3;
            pSure = 0.9;
            payoff_sureL = 1.0;
            payoff_sureH = 1.56;
            payoff_riskyCommon = -2;
            payoff_riskyRare = 8; // E[R] = 1
            break;
        case 2: // Optimal-risky positively-skewed
            pRiskyRare = 0.3;
            pSure = 0.9;
            payoff_sureL = 1.0;
            payoff_sureH = 1.0;
            payoff_riskyCommon = -2;
            payoff_riskyRare = 14.67; // E[R] = 3
            break;
        case 3: // Suboptimal-risky, negatively-skewed
            pRiskyRare = 0.3;
            pSure = 0.9;
            payoff_sureL = 1.0;
            payoff_sureH = 1.56;
            payoff_riskyCommon = 6.00; // E[R] = 1
            payoff_riskyRare = -10.7;
            break;
        case 4: // Optimal-risky, negatively-skewed
            pRiskyRare = 0.3;
            pSure = 0.9;
            payoff_sureL = 1.0;
            payoff_sureH = 1.0;
            payoff_riskyCommon = 6; // E[R] = 3
            payoff_riskyRare = -4;
            break;

        // ==== Pilot condition =
        default:
            pRiskyRare = 0.3;
            pSure = 0.9;
            payoff_sureL = 1.0;
            payoff_sureH = 1.56;
            payoff_riskyCommon = -2;
            payoff_riskyRare = 8; // E[R] = 2
            break;
    }
    optionsKeyList = ['sure','risky'];
    probabilityList = {
        sure:pSure
        , risky:pRiskyRare
    };
    payoffList = {
            sure:[payoff_sureL+10.7, payoff_sureH+10.7]
            , risky:[payoff_riskyCommon+10.7, payoff_riskyRare+10.7]
        };
}


export function settingRiskDistribution_4ab (id) {
    // console.log('settingRiskDistribution_4ab');
    switch (id) {
        // === experiment on 07 November 2020 ===
        case 13: // (riskPrem=20/15; p=0.4; minPayoff = 50)
            pRiskyRare = 0.3;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 2;
            payoff_sureH1 = 2;
            payoff_sureL2 = 1.5;
            payoff_sureH2 = 1.5;
            payoff_sureL3 = 1.25;
            payoff_sureH3 = 1.25;

            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 5.5;
            break;
        // === experiment on 22 October 2020 ===
        case 11: // (riskPrem=20/15; p=0.4; minPayoff = 50)
            pRiskyRare = 0.4;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 1.5;
            payoff_sureH1 = 1.5;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;
            payoff_sureL3 = 1.00;
            payoff_sureH3 = 1.00;

            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 4.25;
            break;
        case 12: // (riskPrem=20/15; p=0.4)
            pRiskyRare = 0.4;
            pPoor = 0.4;
            pSure = 1;
            payoff_sureL1 = 1.50;
            payoff_sureH1 = 1.50;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;

            payoff_sureL3 = 0.50;
            payoff_sureH3 = 2.375;
            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 4.25;
            break;
        // ==== 3-safe 1-risky bandit ====
        case 0: // (riskPrem=20/15; p=0.4; minPayoff = 50)
            pRiskyRare = 0.4;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 1.5;
            payoff_sureH1 = 1.5;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;
            payoff_sureL3 = 1.00;
            payoff_sureH3 = 1.00;

            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 4.25;
            break;
        case 1: // (riskPrem=20/15; p=0.3; minPayoff = 50)
            pRiskyRare = 0.3;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 1.5;
            payoff_sureH1 = 1.5;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;
            payoff_sureL3 = 1.00;
            payoff_sureH3 = 1.00;

            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 5.5;
            break;
        // ==== 2-safe 2-risky bandit (riskPrem=20/15; p=0.3) ====
        case 2: // (riskPrem=20/15; p=0.4)
            pRiskyRare = 0.4;
            pPoor = 0.4;
            pSure = 1;
            payoff_sureL1 = 1.50;
            payoff_sureH1 = 1.50;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;

            payoff_sureL3 = 0.50;
            payoff_sureH3 = 2.375;
            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 4.25;
            break;
        case 3: // (riskPrem=20/15; p=0.3)
            pRiskyRare = 0.3;
            pPoor = 0.3;
            pSure = 1;
            payoff_sureL1 = 1.50;
            payoff_sureH1 = 1.50;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;

            payoff_sureL3 = 0.50;
            payoff_sureH3 = 3;
            payoff_riskyCommon = 0.50;
            payoff_riskyRare = 5.5;
            break;
        // ==== 3-safe 1-risky bandit ====
        case 4: // (riskPrem=20/15; p=0.4; minPayoff = 75)
            pRiskyRare = 0.4;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 1.5;
            payoff_sureH1 = 1.5;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;
            payoff_sureL3 = 1.00;
            payoff_sureH3 = 1.00;

            payoff_riskyCommon = 0.75;
            payoff_riskyRare = 3.875;
            break;
        case 5: // (riskPrem=20/15; p=0.3; minPayoff = 75)
            pRiskyRare = 0.3;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 1.5;
            payoff_sureH1 = 1.5;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;
            payoff_sureL3 = 1.00;
            payoff_sureH3 = 1.00;

            payoff_riskyCommon = 0.75;
            payoff_riskyRare = 4.917;
            break;
        // ==== 3-safe 1-risky bandit (riskPrem=20/15; p=0.3) ====
        default: // case 3
            pRiskyRare = 0.3;
            pPoor = 1;
            pSure = 1;
            payoff_sureL1 = 1.5;
            payoff_sureH1 = 1.5;
            payoff_sureL2 = 1.25;
            payoff_sureH2 = 1.25;
            payoff_sureL3 = 1.00;
            payoff_sureH3 = 1.00;

            payoff_riskyCommon = 0.75;
            payoff_riskyRare = 4.917;
            break;
    }
    optionsKeyList = ['sure1','sure2','sure3','risky']
    // probabilityList = {sure:pSure, risky:pRiskyRare};
    probabilityList = {
        sure1:pSure,
        sure2:pSure,
        sure3:pPoor, //
        risky:pRiskyRare
    };
    payoffList = {
            sure1:[payoff_sureL1, payoff_sureH1],
            sure2:[payoff_sureL2, payoff_sureH2],
            sure3:[payoff_sureL3, payoff_sureH3],
            risky:[payoff_riskyCommon, payoff_riskyRare]};
}
