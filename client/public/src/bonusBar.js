'use strict';

class BonusBar extends Phaser.GameObjects.Sprite {
    constructor(config) {
        super(config.scene, config.x, config.y, 'bonusBar');
        config.scene.add.existing(this);
    }
}