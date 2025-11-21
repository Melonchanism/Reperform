<script lang="ts">
	import { onMount } from "svelte";
	import type { PageProps } from "./$types";
	import AudioWaveform from "$lib/AudioWaveform/AudioWaveform.svelte";
	import { getPeaks } from "$lib/AudioWaveform/utils";
	import Slider from "$lib/Svelte-Awesome-Slider.svelte";

	let { data }: PageProps = $props();

	let playing = $state(false);
	let fullyLoaded = $state(false);
	let pos = $state(0);
	let playStart = $state(0);
	let duration = $state(1);
	let pospct = $derived((pos / duration) * 100);

	let zoom = $state(1);

	let mouseDown = $state(false);

	let audioCtx: AudioContext;
	let tracks: LoadedTrack[] = $state([]);

	class LoadedTrack {
		details: {
			name: string;
			url: string;
		};
		playing = false;
		readyState?: number = $state();
		ready = $derived(this.readyState == 4);
		context: AudioContext;
		data?: AudioBuffer;
		source?: AudioBufferSourceNode;
		peaks?: number[] = $state([]);
		blob?: string = $state();
		mute = $state(false);
		solo = $state(false);
		gainNode?: GainNode;
		gainDB = $state(0);
		gain: number = $derived(
			this.mute || (!this.solo && tracks.find((track) => track.solo))
				? 0
				: 10 ** (this.gainDB / 20)
		);
		analyserNode?: AnalyserNode;
		currentLoudness: number = $state(0);

		constructor(track: { name: string; url: string }, context: AudioContext) {
			this.details = track;
			this.context = context;
			this.gainNode = audioCtx.createGain();
			this.analyserNode = audioCtx.createAnalyser();
			this.gainNode.connect(this.analyserNode);
			this.analyserNode.connect(audioCtx.destination);
			$effect.root(() => {
				$effect(() => {
					if (this.gainNode) this.gainNode.gain.value = this.gain;
				});
			});
		}

		async load(): Promise<this> {
			let response = await fetch(this.details.url);
			this.data = await this.context.decodeAudioData(
				await response.arrayBuffer()
			);
			this.peaks = getPeaks(this.data);
			return new Promise((res) => {
				res(this);
			});
		}
	}

	function prepare() {
		for (const track of tracks) {
			track.source = audioCtx.createBufferSource();
			track.source.buffer = track.data!;
			track.source.connect(track.gainNode!);
		}
	}

	async function play() {
		playing = true;
		playStart = audioCtx.currentTime - pos;
		updateLoop();
		for (const track of tracks) {
			track.source?.start(0, pos);
		}
	}

	function stop() {
		playing = false;
		for (const track of tracks) {
			track.source?.stop();
			track.source?.disconnect();
			track.source = undefined;
		}
		prepare();
	}
	function togglePlay() {
		playing ? stop() : play();
	}

	function getLevel01(analyser: AnalyserNode) {
		const buf = new Float32Array(analyser.fftSize);
		analyser.getFloatTimeDomainData(buf);
		// Old volume function, didn't calculate clip
		// return buf.reduce((a, b) => a + Math.abs(b)) / buf.length;
		return buf.reduce((a, b) => (b > a ? b : a));
	}

	function updateLoop() {
		if (!mouseDown && playing) {
			pos = audioCtx.currentTime - playStart;
			for (const track of tracks)
				track.currentLoudness = getLevel01(track.analyserNode!);
			requestAnimationFrame(updateLoop);
		} else {
			for (const track of tracks) track.currentLoudness = 0;
		}
	}

	onMount(() => {
		if (navigator.audioSession) navigator.audioSession.type = "transient-solo";
		audioCtx = new AudioContext();
		(async () => {
			for (const track of data.tracks)
				tracks.push(await new LoadedTrack(track, audioCtx).load());
			prepare();
			duration =
				tracks[0].source!.buffer!.length / tracks[0].source!.buffer!.sampleRate;
		})();
		fullyLoaded = true;
		return () => {
			if (playing) stop();
			audioCtx.close();
		};
	});

	function updatePlayerPos() {
		let originalState = playing;
		stop();
		if (originalState) play();
	}

	function handleKey(evt: KeyboardEvent) {
		console.log(evt.key);
		switch (evt.key) {
			case " ":
				evt.preventDefault();
				togglePlay();
				break;
			case "Enter":
				break;
		}
	}
</script>

<svelte:head>
	<title>{data.details.name} {data.details.date} | Reperform</title>
</svelte:head>

<svelte:window onkeypress={handleKey} onmouseup={() => (mouseDown = false)} />

<div class="page">
	<div class="header">
		<h1>{data.details.name}</h1>
		<h3 style="color: gray">({data.details.date})</h3>
	</div>
	<div class="controls">
		<button onclick={togglePlay}>{playing ? "Pause" : "Play"}</button>
		<div>
			<Slider
				--track-width="180px"
				--track-height="20px"
				min={0.1}
				max={2}
				step={0.1}
				bind:value={zoom}
			/>
			<kbd>{zoom}</kbd>
		</div>
	</div>
	<div class="tracks" style:--pos={`${pospct}%`}>
		<div class="headers">
			{#each tracks as track}
				<div class="trackheader">
					<p>{track.details.name.split("=").at(-1)?.split(".")[0]}</p>
					<div class="toggles">
						<button
							class={track.solo ? "active" : ""}
							onclick={() => (track.solo = !track.solo)}>Solo</button
						>
						<button
							class={track.mute ? "active" : ""}
							onclick={() => (track.mute = !track.mute)}>Mute</button
						>
					</div>
					<div class="toggles">
						<Slider
							--track-width="140px"
							--track-height="20px"
							--volume-width={`${track.currentLoudness * 100}%`}
							--track-background="linear-gradient(90deg,  transparent, var(--volume-width), hsl(0, 0%, 30%) var(--volume-width)), linear-gradient(90deg, hsl(119, 100%, 30%), 66%,  hsl(41, 100%, 50%), 98%, hsl(0, 100%, 30%))"
							--thumb-background="hsl(0, 0%, 50%)"
							--margin-block="0"
							min={-18}
							max={6}
							step={1}
							bind:value={track.gainDB}
						/>
						<p style:color={track.currentLoudness > 0.99 ? "red" : "green"}>
							{track.gainDB}dB
						</p>
					</div>
				</div>
			{/each}
		</div>
		<div class="waveforms">
			<div class="playhead"></div>
			{#each tracks as track}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="wavecontainer"
					onmousemove={(evt) => {
						if (mouseDown)
							pos = (evt.layerX / evt.target!.offsetWidth) * duration;
					}}
					onmousedown={() => (mouseDown = true)}
					onmouseup={(evt) => {
						mouseDown = false;
						pos = (evt.layerX / evt.target!.offsetWidth) * duration;
						updatePlayerPos();
					}}
				>
					<AudioWaveform
						height={100}
						width={1000 * zoom * (duration / 240)}
						color="hsla(0, 0%, 20%, 70%)"
						peaks={track.peaks ?? []}
						position={pospct}
					/>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: 4px;
		& > * {
			display: flex;
			align-items: center;
		}
		margin-bottom: 12px;
	}
	.tracks {
		position: absolute;
		display: grid;
		grid-template-columns: 200px 1fr;
		place-content: start;
		width: 100%;
		left: -1px;
		height: max-content;
		.headers {
			display: flex;
			flex-direction: column;
			& > * {
				display: grid;
				align-content: center;
				padding-left: 4px;
				gap: 4px;
				border-bottom: 1px inset hsl(0, 0%, 15%);
				border-right: 1px inset hsl(0, 0%, 15%);
				.toggles {
					display: flex;
					align-items: center;
					gap: 4px;
				}
				p {
					margin: 0;
				}
				&:last-child {
					border-bottom: none !important;
				}
			}
		}

		.waveforms {
			position: relative;
			& > * {
				border-bottom: 1px inset hsl(0, 0%, 15%);
				&:last-child {
					border-bottom: none !important;
				}
			}
			.playhead {
				left: var(--pos);
				top: 0;
				height: 100%;
				position: absolute;
				content: "";
				border-right: 1px solid white;
				z-index: 2;
				pointer-events: none;
				&::before {
					content: "";
					position: absolute;
					top: -10px;
					left: -10px;
					width: 20px;
					height: 20px;
					background: url(/playhead.svg);
					background-repeat: no-repeat;
					background-size: cover;
					rotate: 180deg;
				}
			}
			background: linear-gradient(
				90deg,
				hsla(0, 0%, 20%, 20%) var(--pos),
				transparent var(--pos)
			);
		}

		.headers > *,
		.waveforms > * {
			height: 100px;
		}
	}

	.active {
		background: hsl(0, 0%, 70%);
		color: black;
	}
</style>
