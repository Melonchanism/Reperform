<script lang="ts">
	import { onMount } from "svelte";
	import type { PageProps } from "./$types";
	import AudioWaveform from "$lib/AudioWaveform/AudioWaveform.svelte";
	import { getPeaks } from "$lib/AudioWaveform/utils";
	import Slider from "$lib/Svelte-Awesome-Slider.svelte";
	import unmuteIosAudio from "unmute-ios-audio";
	import GainSlider from "$lib/GainSlider.svelte";
	import { blur, fade, fly, slide } from "svelte/transition";

	let { data }: PageProps = $props();

	let audioCtx: AudioContext;
	let masterGainNode: GainNode;
	let masterAnalyserNode: AnalyserNode;
	let masterPeak: number = $state(0);
	let masterGainDB = $state(0);
	let tracks: LoadedTrack[] = $state([]);

	$effect(() => {
		masterGainDB;
		if (masterGainNode) masterGainNode.gain.value = 10 ** (masterGainDB / 20);
	});

	let playing = $state(false);
	let loadedPct = $derived(tracks.length / data.tracks.length);
	let pos = $state(0);
	let playStart = $state(0);
	let duration = $state(1);
	let pospct = $derived(pos / duration);

	let zoom = $state(1);

	let mouseDown = $state(false);

	class LoadedTrack {
		details: {
			name: string;
			url: string;
		};
		playing = false;
		context: AudioContext;
		data?: AudioBuffer;
		source?: AudioBufferSourceNode;
		peaks?: number[] = $state([]);
		mute = $state(false);
		solo = $state(false);
		gainNode?: GainNode;
		gainDB = $state(0);
		analyserNode?: AnalyserNode;
		peak: number = $state(0);

		constructor(track: { name: string; url: string }, context: AudioContext) {
			this.details = track;
			this.context = context;
			this.gainNode = audioCtx.createGain();
			this.analyserNode = audioCtx.createAnalyser();
			this.gainNode.connect(this.analyserNode);
			this.analyserNode.connect(masterGainNode);
			$effect.root(() => {
				$effect(() => {
					if (this.gainNode)
						this.gainNode.gain.value =
							this.mute || (!this.solo && tracks.find((track) => track.solo))
								? 0
								: 10 ** (this.gainDB / 20);
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

	onMount(() => {
		if (navigator.audioSession) navigator.audioSession.type = "transient-solo";
		unmuteIosAudio();
		audioCtx = new AudioContext();
		masterGainNode = audioCtx.createGain();
		masterAnalyserNode = audioCtx.createAnalyser();
		masterGainNode.connect(masterAnalyserNode);
		masterAnalyserNode.connect(audioCtx.destination);
		(async () => {
			for (const track of data.tracks) {
				tracks.push(await new LoadedTrack(track, audioCtx).load());
				duration = tracks[0].data!.length / tracks[0].data!.sampleRate;
			}
			prepare();
		})();
		return () => {
			if (playing) stop();
			audioCtx.close();
		};
	});

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
			for (const track of tracks) track.peak = getLevel01(track.analyserNode!);
			masterPeak = getLevel01(masterAnalyserNode);
			requestAnimationFrame(updateLoop);
		} else {
			for (const track of tracks) track.peak = 0;
			masterPeak = 0;
		}
	}

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
				evt.preventDefault();
				pos = 0;
				updatePlayerPos();
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
	<div>
		{#if loadedPct !== 1}
			<div class="loading" out:blur>
				<h2>Loading...</h2>
				<p>{loadedPct * 100}%</p>
			</div>
		{/if}
		<div class="controls">
			<button onclick={togglePlay}>
				<img src={playing ? "/pause.svg" : "/play.svg"} alt="" />
			</button>
			<div>
				<p>Zoom:</p>
				<Slider
					--track-width="180px"
					--track-height="20px"
					min={0.1}
					max={2}
					step={0.1}
					bind:value={zoom}
				/>
				<p>{zoom}</p>
			</div>
			<div>
				<p>Master:</p>
				<GainSlider peak={masterPeak} bind:gainDB={masterGainDB} />
				<p>{masterGainDB}㏈</p>
			</div>
		</div>
		<div class="tracks">
			<div class="headers">
				{#each tracks as track}
					<div class="trackheader" transition:fly={{ y: 0, x: -195 }}>
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
							<GainSlider peak={track.peak} bind:gainDB={track.gainDB} />
							<p style:color={track.peak > 0.99 ? "red" : ""}>
								{track.gainDB}㏈
							</p>
						</div>
					</div>
				{/each}
			</div>
			<div class="waveforms">
				<div
					class="indicators"
					style:width="{1000 * zoom * (duration / 240) * pospct}px"
				>
					<div class="playhead"></div>
					<div class="progress"></div>
				</div>
				{#each tracks as track}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="wavecontainer"
						transition:slide={{ axis: "x", duration, delay: 150 }}
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
</div>

<style>
	.loading {
		position: absolute;
		z-index: 10;
		left: 0;
		width: 100%;
		height: 90%;
		background-color: hsla(0, 0%, 20%, 50%);
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.controls {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		column-gap: 16px;
		& > * {
			display: flex;
			align-items: center;
		}
		p {
			margin: 8px 0 !important;
		}
		margin-bottom: 12px;
	}
	.tracks {
		position: absolute;
		display: grid;
		grid-template-columns: 195px 1fr;
		place-content: start;
		width: 100%;
		left: -1px;
		height: max-content;
		.headers {
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
			overflow-x: scroll;
			overflow-y: hidden;
			& > * {
				border-bottom: 1px inset hsl(0, 0%, 15%);
				width: fit-content;
				&:last-child {
					border-bottom: none !important;
				}
			}
			.indicators {
				border: none !important;
				position: absolute;
				height: 100%;
			}
			.playhead {
				right: 0;
				top: 0;
				height: 100%;
				position: absolute;
				content: "";
				border-right: 2px solid white;
				z-index: 2;
				pointer-events: none;
				&::before {
					content: "";
					position: absolute;
					top: -10px;
					left: -9px;
					width: 20px;
					height: 20px;
					background: url(/playhead.svg);
					background-repeat: no-repeat;
					background-size: cover;
					rotate: 180deg;
				}
			}
			.progress {
				top: 0;
				height: 100%;
				/*position: absolute;*/
				width: 100%;
				background: hsla(0, 0%, 20%, 20%);
			}
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
