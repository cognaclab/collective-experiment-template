'use strict';
//import Phaser from 'phaser';
// export default class CircleSpin
// {
// 	static create(scene: Phaser.Scene, x: number, y: number, radius = 64, color: number = 0xffffff)
// 	{
// 		return new CircleSpin(scene, x, y, radius, color)
// 	}

// 	protected scene: Phaser.Scene
// 	private position = { x: 0, y: 0 }
// 	protected radius = 64
// 	private color = 0xffffff

// 	protected circle?: Phaser.GameObjects.Arc
// 	protected timeline?: Phaser.Tweens.Timeline

// 	set x(value: number)
// 	{
// 		this.position.x = value
// 		if (this.circle)
// 		{
// 			this.circle.x = value
// 		}
// 	}

// 	get x()
// 	{
// 		return this.position.x
// 	}

// 	set y(value: number)
// 	{
// 		this.position.y = value
// 		if (this.circle)
// 		{
// 			this.circle.y = value
// 		}
// 	}

// 	get y()
// 	{
// 		return this.position.y
// 	}

// 	constructor(scene: Phaser.Scene, x: number, y: number, radius = 64, color: number = 0xffffff)
// 	{
// 		this.scene = scene
// 		this.x = x
// 		this.y = y
// 		this.radius = radius
// 		this.color = color
// 	}

// 	useColor(color: number)
// 	{
// 		this.color = color

// 		return this
// 	}

// 	addToContainer(container: Phaser.GameObjects.Container, x?: number, y?: number)
// 	{
// 		if (!container)
// 		{
// 			return this
// 		}

// 		if(!this.circle || !this.timeline)
// 		{
// 			this.make()
// 		}

// 		container.add(this.circle!)

// 		if (x !== undefined)
// 		{
// 			this.x = x
// 		}

// 		if (y !== undefined)
// 		{
// 			this.y = y
// 		}

// 		return this
// 	}

// 	make(config: IAnimationConfig = {})
// 	{
// 		if (this.circle)
// 		{
// 			this.circle.destroy()
// 		}
		
// 		this.circle = this.scene.add.circle(this.x, this.y, this.radius, this.color, 1)

// 		if (this.timeline)
// 		{
// 			this.timeline.destroy()
// 		}

// 		const {
// 			loopDelay = 0,
// 			spins = 10
// 		} = config

// 		this.timeline = this.scene.tweens.timeline({
// 			loop: -1,
// 			loopDelay
// 		})

// 		const fastSpins = Math.floor(spins * 0.8)
// 		const slowSpins = spins - fastSpins
// 		let duration = 300

// 		for (let i = 0; i < fastSpins; ++i)
// 		{
// 			this.timeline.add({
// 				targets: this.circle,
// 				scaleX: 0,
// 				ease: Phaser.Math.Easing.Sine.InOut,
// 				duration
// 			})
// 			.add({
// 				targets: this.circle,
// 				scaleX: 1,
// 				ease: Phaser.Math.Easing.Sine.InOut,
// 				duration
// 			})
			
// 			if (duration > 100)
// 			{
// 				duration *= 0.5
// 			}
// 		}

// 		for (let i = 0; i < slowSpins; ++i)
// 		{
// 			duration *= 2

// 			this.timeline.add({
// 				targets: this.circle,
// 				scaleX: 0,
// 				ease: Phaser.Math.Easing.Sine.InOut,
// 				duration
// 			})
// 			.add({
// 				targets: this.circle,
// 				scaleX: 1,
// 				ease: Phaser.Math.Easing.Sine.InOut,
// 				duration
// 			})
// 		}

// 		return this
// 	}

// 	play()
// 	{
// 		if(!this.circle || !this.timeline)
// 		{
// 			this.make()
// 		}

// 		this.timeline?.play()

// 		return this
// 	}
// }