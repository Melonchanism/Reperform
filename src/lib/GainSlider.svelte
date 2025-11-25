<script lang="ts">
	import Slider from "$lib/Svelte-Awesome-Slider.svelte";
	interface Props {
		peak: number;
		width: number;
		min: number;
		max: number;
		gainDB: number;
	}
	let {
		peak,
		width = 140,
		min = -24,
		max = 6,
		gainDB = $bindable(),
	} = $props();
</script>

<Slider
	--track-width="{width}px"
	--track-height="20px"
	--volume-width={`${peak * 100}%`}
	--track-background="linear-gradient(90deg,  transparent, var(--volume-width), hsl(0, 0%, 30%) var(--volume-width)), linear-gradient(90deg, hsl(119, 100%, 30%), 66%,  hsl(41, 100%, 50%), 98%, hsl(0, 100%, 30%))"
	--thumb-background="hsl(0, 0%, 50%)"
	--margin-block="0"
	{min}
	{max}
	step={1}
	bind:value={gainDB}
/>
