<script lang="ts">
	import { onMount } from "svelte";
	import type { PageProps } from "./$types";
	import AudioWaveform from "$lib/AudioWaveform/AudioWaveform.svelte";
	import { getPeaks } from "$lib/AudioWaveform/utils";
	import Slider from "$lib/Svelte-Awesome-Slider.svelte";
	import GainSlider from "$lib/GainSlider.svelte";
	import { fade, scale } from "svelte/transition";
	import { Spring } from "svelte/motion";
	import TimeBar from "$lib/TimeBar.svelte";

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

	$effect(() => {
		zoom;
		// Fix using manual calculations because this forces vertical as well because of lack of support for container option
		// document.querySelector(".playhead")?.scrollIntoView({ inline: "nearest" });
	});

	let playing = $state(false);
	let suspended = $state(false);
	let loopID = 0;
	let loadedPct = Spring.of(() => tracks.length / data.tracks.length, {
		stiffness: 0.1,
	});
	let pos = $state(0);
	let playStart = $state(0);
	let duration = $state(1);
	let pospct = $derived(pos / duration);
	let zoom = $state(1);
	let width = $derived(1000 * zoom * (duration / 240));

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
		if (navigator.audioSession) {
			navigator.audioSession.type = "playback";
		}
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
		window.actx = audioCtx;
		audioCtx.addEventListener("statechange", () => {
			suspended = audioCtx.state === "suspended";
			if (!suspended && playing) updateLoop(true);
		});
		return () => {
			if (playing) stop();
			audioCtx.close();
			tracks = null;
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
		if (suspended) {
			audioCtx.resume();
			playStart = audioCtx.currentTime - pos;
		} else {
			prepare();
			playStart = audioCtx.currentTime - pos;
			for (const track of tracks) {
				track.source?.start(0, pos);
			}
		}
		updateLoop(true);
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
		playing && !suspended ? stop() : play();
	}

	function getLevel01(analyser: AnalyserNode) {
		const buf = new Float32Array(analyser.fftSize);
		analyser.getFloatTimeDomainData(buf);
		// Loudness, doesn't calculate clip
		// return buf.reduce((a, b) => a + Math.abs(b)) / buf.length;
		return buf.reduce((a, b) => (b > a ? b : a));
	}

	function updateLoop(initial = false, ID = Math.random()) {
		if (initial) loopID = ID;
		if (!mouseDown && playing && !suspended) {
			pos = audioCtx.currentTime - playStart;
			for (const track of tracks) track.peak = getLevel01(track.analyserNode!);
			masterPeak = getLevel01(masterAnalyserNode);
			if (ID === loopID) requestAnimationFrame(() => updateLoop(false, ID));
			if (pospct >= 1) stop();
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

	async function adjustZoom(val: number, layer: number, set = false) {
		const oldZoom = zoom;
		if (!set) {
			zoom *= Math.exp(-val / 370);
			zoom = +Math.min(4, Math.max(0.1, zoom)).toFixed(3);
		} else {
			zoom = val;
		}

		document.querySelector(".waveforms")!.scrollLeft +=
			(layer / oldZoom) * zoom - layer;
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
		{#if loadedPct.current !== 1}
			<div class="loading" out:scale>
				<h2>Loading</h2>
				<progress max="1" value={loadedPct.current}>loadedPct</progress>
				<p>
					{(loadedPct.current * 100).toFixed(0)}%
				</p>
			</div>
		{/if}
		<div class="controls">
			<button onclick={togglePlay}>
				<img src={playing && !suspended ? "/pause.svg" : "/play.svg"} alt="" />
			</button>
			<div>
				<p>Zoom:</p>
				<Slider
					--track-width="180px"
					--track-height="20px"
					min={0.1}
					max={4}
					step={0.01}
					value={zoom}
					onInput={(val) => {
						adjustZoom(val, width * pospct, true);
					}}
				/>
				<p>{zoom}</p>
			</div>
			<div>
				<p>Master:</p>
				<GainSlider peak={masterPeak} bind:gainDB={masterGainDB} />
				<p style:color={masterPeak > 0.99 ? "red" : ""}>{masterGainDB}㏈</p>
			</div>
		</div>
		<div class="tracks">
			<div class="headers">
				<div class="timebar"></div>
				{#each tracks as track}
					<div class="trackheader" transition:fade>
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
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="waveforms"
				onwheel={(evt) => {
					if (!evt.deltaY) return;
					evt.preventDefault();
					if (evt.ctrlKey || evt.metaKey) {
						adjustZoom(evt.deltaY, evt.layerX);
						return;
					}
					evt.currentTarget.scrollLeft += evt.deltaY + evt.deltaX;
				}}
				onmousemove={(evt) => {
					if (
						mouseDown &&
						["CANVAS", "path", "svg"].includes(evt.target!.tagName)
					)
						pos = (evt.layerX / width) * duration;
				}}
				onmousedown={() => (mouseDown = true)}
				onmouseup={(evt) => {
					mouseDown = false;
					// console.log(evt.layerX);
					if (["CANVAS", "path", "svg"].includes(evt.target!.tagName))
						pos = (evt.layerX / width) * duration;
					updatePlayerPos();
				}}
			>
				<div class="indicators" style:width="{width * pospct}px">
					<div class="playhead"></div>
					<div class="progress"></div>
				</div>
				<div class="timebar">
					<TimeBar {width} height={20} {duration} />
				</div>
				{#each tracks as track}
					<div class="wavecontainer" transition:fade>
						<AudioWaveform
							height={100}
							{width}
							color="hsl(150deg, 1%, 60%)"
							peaks={track.peaks ?? []}
						/>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.header {
		position: relative;
		z-index: 90;
	}

	.loading {
		position: fixed;
		z-index: 10;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: hsla(0, 0%, 20%, 50%);
		backdrop-filter: blur(16px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		p {
			margin: 4px 0 !important;
		}
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
				height: 100% !important;
				pointer-events: none;
			}
			.playhead {
				right: 0;
				top: 0;
				height: 100%;
				position: absolute;
				content: "";
				border: 1px solid hsla(0, 0%, 100%, 70%);
				z-index: 3;
				pointer-events: none;
				&::before {
					content: "";
					position: absolute;
					top: -6.5px;
					left: -10px;
					width: 20px;
					height: 20px;
					background: url(/playhead.svg);
					background-repeat: no-repeat;
					background-size: contain;
					rotate: 180deg;
					pointer-events: none;
				}
			}
			.progress {
				top: 0;
				z-index: 2;
				height: 100%;
				position: absolute;
				width: 100%;
				/*background: hsla(0, 0%, 40%, 20%);*/
				backdrop-filter: saturate(5000%);
				pointer-events: none;
			}
		}

		.headers > *,
		.waveforms > *:not(.timebar) {
			height: 100px;
		}
		.timebar {
			padding-top: 15px;
			height: 20px;
		}
	}

	.active {
		background: hsl(0, 0%, 70%);
		color: black;
	}
</style>
