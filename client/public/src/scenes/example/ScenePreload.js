/**
 * ScenePreload - Preloads all assets needed for the experiment
 * This scene runs once at the start to load images, sounds, etc.
 * Shows a loading bar with progress indicator
 */

class ScenePreload extends Phaser.Scene {
    constructor() {
        super({ key: 'ScenePreload', active: false });
    }

    preload() {
        // Progress bar
        let progressBox = this.add.graphics();
        let progressBar = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(240, 270, 320, 50);

        // Loading text
        let width = this.cameras.main.width;
        let height = this.cameras.main.height;
        let loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading...',
            style: {
                font: '20px',
                fill: '#000000'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        // Percent text
        let percentText = this.make.text({
            x: width / 2,
            y: height / 2 - 5,
            text: '0%',
            style: {
                font: '18px monospace',
                fill: '#ffffff'
            }
        });
        percentText.setOrigin(0.5, 0.5);

        // Loading stuff - exact copy from original
        this.load.image('star', 'assets/star.png');
        this.load.image('star_self', 'assets/star_self.png');
        this.load.image('button', 'assets/button.001.png');
        this.load.image('button_active', 'assets/button.active.png');
        this.load.image('bonusBarFrame', 'assets/bar.png');
        this.load.image('energycontainer', 'assets/energycontainer.png');
        this.load.image('energybar', 'assets/energybar.png');
        this.load.image('machine1_normal', 'assets/machine_normal_1.png');
        this.load.image('machine2_normal', 'assets/machine_normal_2.png');
        this.load.image('machine3_normal', 'assets/machine_normal_3.png');
        this.load.image('machine4_normal', 'assets/machine_normal_4.png');
        this.load.image('machine5_normal', 'assets/machine_normal_5.png');
        this.load.image('machine6_normal', 'assets/machine_normal_6.png');
        this.load.image('machine7_normal', 'assets/machine_normal_7.png');
        this.load.image('machine8_normal', 'assets/machine_normal_8.png');
        this.load.image('machine9_normal', 'assets/machine_normal_9.png');
        this.load.image('machine10_normal', 'assets/machine_normal_10.png');
        this.load.image('machine11_normal', 'assets/machine_normal_11.png');
        this.load.image('machine12_normal', 'assets/machine_normal_12.png');
        this.load.image('machine1_active', 'assets/machine_active_1.png');
        this.load.image('machine2_active', 'assets/machine_active_2.png');
        this.load.image('machine3_active', 'assets/machine_active_3.png');
        this.load.image('machine4_active', 'assets/machine_active_4.png');
        this.load.image('machine5_active', 'assets/machine_active_5.png');
        this.load.image('machine6_active', 'assets/machine_active_6.png');
        this.load.image('machine7_active', 'assets/machine_active_7.png');
        this.load.image('machine8_active', 'assets/machine_active_8.png');
        this.load.image('machine9_active', 'assets/machine_active_9.png');
        this.load.image('machine10_active', 'assets/machine_active_10.png');
        this.load.image('machine11_active', 'assets/machine_active_11.png');
        this.load.image('machine12_active', 'assets/machine_active_12.png');
        this.load.image('blackbox', 'assets/blackbox.png');

        // Progress bar functions (exact copy from original)
        this.load.on('progress', function (value) {
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(250, 280, 300 * value, 30);
            percentText.setText(parseInt(value * 100) + '%');
        });

        this.load.on('complete', function () {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
        });
    }

    create() {
        console.log('✅ All assets preloaded');

        // Signal that preload is complete
        // ExperimentFlow will start the first scene
        if (window.experimentFlow) {
            window.experimentFlow.onPreloadComplete();
        }
    }
}

export default ScenePreload;
