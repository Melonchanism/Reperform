<script lang="ts">
	let { canvasWidth, canvasHeight, color, gradientColors, barWidth, peaks } =
		$props<{
			canvasWidth: number;
			canvasHeight: number;
			color: string;
			gradientColors: string[];
			barWidth: number;
			peaks: number[];
		}>();

	// ---------- BAR RENDERING ----------
	function buildBars(peaks: number[]) {
		const halfH = canvasHeight / 2;
		const gap = 2;
		const step = barWidth + gap;
		const absmax = 1;
		const scale = peaks.length / canvasWidth;

		let rects: string[] = [];

		for (let x = 0; x < canvasWidth; x += step) {
			let h = Math.round((peaks[Math.floor(x * scale)] / absmax) * halfH) || 1;

			const y = halfH - h;
			const height = h * 2;

			rects.push(
				`<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" />`
			);
		}

		return rects.join("");
	}

	function buildWaves(peaks: number[]) {
		let local = [...peaks];

		const reflected: number[] = [];
		for (let i = 0; i < local.length; i++) {
			reflected.push(local[i], -local[i]);
		}
		local = reflected;

		const halfH = canvasHeight / 2;
		const length = Math.floor(local.length / 2);
		const scale = 1;
		const absmax = Math.max(Math.max(...local), -Math.min(...local));

		let d = `M 0 ${halfH}`;

		// Top path
		for (let i = 0; i < length; i++) {
			const h = Math.round((local[2 * i] / absmax) * halfH);
			d += ` L ${i * scale} ${halfH - h}`;
		}

		// Bottom path (reversed)
		for (let i = length - 1; i >= 0; i--) {
			const h = Math.round((local[2 * i + 1] / absmax) * halfH);
			d += ` L ${i * scale} ${halfH - h}`;
		}

		d += " Z";
		return d;
	}

	const gradientId = String(Math.random());
</script>

<svg
	width={canvasWidth}
	height={canvasHeight}
	viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
	preserveAspectRatio="none"
>
	{#if gradientColors.length > 0}
		<defs>
			<linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
				{#each gradientColors as c, i}
					<stop offset={i / (gradientColors.length - 1)} stop-color={c} />
				{/each}
			</linearGradient>
		</defs>
	{/if}

	<line
		x1="0"
		x2={canvasWidth}
		y1={canvasHeight / 2}
		y2={canvasHeight / 2}
		style:stroke-width="1"
		style:stroke={gradientColors.length > 0 ? `url(#${gradientId})` : color}
	></line>

	<g
		class="datacontainer"
		style:--scale={canvasWidth / peaks.length}
		fill={gradientColors.length > 0 ? `url(#${gradientId})` : color}
	>
		{#if barWidth}
			<g>{@html buildBars(peaks)} </g>
		{:else}
			<path d={buildWaves(peaks)} />
		{/if}
	</g>
</svg>

<style>
	.datacontainer {
		transform: scaleX(var(--scale));
	}
</style>
