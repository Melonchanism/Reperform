<script lang="ts">
	import { onMount } from "svelte";

	interface Props {
		width: number;
		height: number;
		duration: number;
		zones?: Zone[];
	}

	const { width, height = 30, duration, zones }: Props = $props();

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;

	onMount(() => (ctx = canvas.getContext("2d")!));

	function secWidth(x: number) {
		return (x / duration) * width;
	}

	$effect(() => {
		if (!ctx) return;

		const pixelRatio = Math.max(devicePixelRatio, 2);
		canvas.width = width * pixelRatio;
		canvas.height = height * pixelRatio;
		ctx.scale(pixelRatio, pixelRatio);

		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (let i = 0; i < (zones?.length ?? 0); i++) {
			const zone = zones![i];
			ctx.strokeStyle = `hsl(${i * 200}, 10%, 50%)`;
			ctx.fillStyle = `hsl(${i * 200}, 20%, 20%)`;
			const start = secWidth(zone.start);
			const width = secWidth(zone.end - zone.start);
			ctx.beginPath();
			ctx.roundRect(start, 1, width, 18, 4);
			ctx.fill();
			ctx.stroke();

			ctx.strokeStyle = ctx.fillStyle = "#ffffff";
			ctx.font = "16px sans-serif";
			ctx.fillText(zone.name, start + 4, 16, width - 5);
		}

		const h = canvas.height;
		const ratio = width / duration;
		// console.log(ratio, duration);
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
		const hOffset = 20;
		ctx.strokeStyle = ctx.fillStyle = "#ffffff";

		for (let t = 0; t <= duration; t += minorEvery) {
			const x = (t / duration) * width;

			if (t % (majorEvery * minorEvery) === 0) {
				ctx.beginPath();
				ctx.moveTo(x, 0 + hOffset);
				ctx.lineTo(x, 7 + hOffset);
				ctx.stroke();

				ctx.font = "10px sans-serif";
				ctx.textAlign = "center";
				ctx.fillText(
					`${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`,
					x,
					15 + hOffset
				);
			} else {
				// Minor tick
				ctx.beginPath();
				ctx.moveTo(x, 0 + hOffset);
				ctx.lineTo(x, 3 + hOffset);
				ctx.stroke();
			}
		}
	});
</script>

<canvas bind:this={canvas} style:height="{height}px" style:width="{width}px"
></canvas>

<style>
	canvas {
		cursor: pointer;
	}
</style>
