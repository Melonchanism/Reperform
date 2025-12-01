<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		width: number;
		height: number;
		// Temp just for testing
		pos: number;
		duration: number;
		regions: {
			name: string;
			start: number;
			end: number;
		};
	}

	const { width, height = 30, pos, duration, regions }: Props = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	onMount(() => {
		ctx = canvas.getContext("2d")!;
		draw();
	});

	// Redraw whenever inputs change
	$effect(() => {
		draw();
	});

	function draw() {
		if (!ctx) return;

		canvas.width = width * devicePixelRatio;
		canvas.height = height * devicePixelRatio;

		// Clear
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const h = canvas.height;
		const ratio = width / duration;
		console.log(ratio, duration);
		let majorEvery: number; // n ticks
		let minorEvery: number; // seconds
		if (ratio > 36) {
			majorEvery = 4;
			minorEvery = 0.25;
		} else if (ratio > 16) {
			majorEvery = 4;
			minorEvery = 0.5;
		} else if (ratio > 7) {
			majorEvery = 5;
			minorEvery = 1;
		} else if (ratio > 4) {
			majorEvery = 10;
			minorEvery = 1;
		} else if (ratio > 3) {
			majorEvery = 5;
			minorEvery = 2;
		} else if (ratio > 1) {
			majorEvery = 6;
			minorEvery = 5;
		} else {
			majorEvery = 6;
			minorEvery = 10;
		}

		ctx.strokeStyle = "#ffffff";
		ctx.fillStyle = "#ffffff";
		ctx.lineWidth = 1;
		ctx.scale(devicePixelRatio, devicePixelRatio);

		for (let t = 0; t <= duration; t += minorEvery) {
			const x = (t / duration) * width;

			if (t % (majorEvery * minorEvery) === 0) {
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, 7);
				ctx.stroke();

				ctx.font = "10px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(
					`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`,
					x,
					15
				);
			} else {
				// Minor tick
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, 3);
				ctx.stroke();
			}
		}

		// Draw playhead (temp)
		const px = (pos / duration) * width;
		ctx.strokeStyle = "red";
		ctx.lineWidth = 2;

		ctx.beginPath();
		ctx.moveTo(px, 0);
		ctx.lineTo(px, h);
		ctx.stroke();
	}
</script>

<canvas bind:this={canvas} style:height="{height}px" style:width="{width}px"
></canvas>

<style>
	canvas {
		cursor: pointer;
	}
</style>
