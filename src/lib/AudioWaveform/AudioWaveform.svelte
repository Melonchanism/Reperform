<script lang="ts">
	import WaveSVG from "./WaveSVG.svelte";

	type Props = {
		peaks: number[];
		position?: number;
		color?: string;
		progressColor?: string;
		gradientColors?: string[];
		progressGradientColors?: string[];
		height: number;
		barWidth?: number;
		width: number;
	};

	let {
		peaks,
		color = "grey",
		gradientColors = [],
		height,
		barWidth,
		width,
	}: Props = $props();
</script>

<div
	id="wave-wrapper"
	style="position: relative; width: 100%; height: 100%; cursor: pointer;"
>
	<WaveSVG
		{peaks}
		{barWidth}
		{color}
		{gradientColors}
		canvasWidth={width}
		canvasHeight={height}
	/>
</div>
