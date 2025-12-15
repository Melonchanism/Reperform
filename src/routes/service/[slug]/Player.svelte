<script module lang="ts">
	export interface LoadedTrack {
		details: {
			name: string;
			url: string;
		};
		playing: Boolean;
		context: AudioContext;
		data?: AudioBuffer;
		source?: AudioBufferSourceNode;
		peaks?: number[];
		mute: Boolean;
		solo: Boolean;
		gainNode?: GainNode;
		gainDB: number;
		analyserNode?: AnalyserNode;
		peak: number;
	}
</script>

<script lang="ts">
	import { getPeaks } from "$lib/AudioWaveform/utils";
	import { onMount } from "svelte";

	interface Props {
		tracks: LoadedTrack[];
		data: {
			tracks: {
				name: string;
				url: string;
			}[];
		};
		duration: number;
		pos: number;
		pospct: number;
		playing: boolean;
		suspended: boolean;
		masterGainDB: number;
		masterPeak: number;
		mouseDown: boolean;
	}

	let {
		tracks = $bindable(),
		data,
		playing = $bindable(),
		suspended = $bindable(),
		duration = $bindable(),
		pos = $bindable(),
		pospct = $bindable(),
		masterGainDB = $bindable(),
		masterPeak = $bindable(),
		mouseDown = $bindable(),
	}: Props = $props();

	let playStart = $state(0);

	let audioCtx: AudioContext;
	let masterGainNode: GainNode;
	let masterAnalyserNode: AnalyserNode;

	$effect(() => {
		masterGainDB;
		if (masterGainNode) masterGainNode.gain.value = 10 ** (masterGainDB / 20);
	});

	export class LoadedTrackClass implements LoadedTrack {
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

		constructor(
			track: { name: string; url: string },
			context: AudioContext,
			outNode: AudioNode
		) {
			this.details = track;
			this.context = context;
			this.gainNode = context.createGain();
			this.analyserNode = context.createAnalyser();
			this.gainNode.connect(this.analyserNode);
			this.analyserNode.connect(outNode);

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
		//@ts-ignore
		if (navigator.audioSession) {
			//@ts-ignore
			navigator.audioSession.type = "playback";
		}
		audioCtx = new AudioContext();
		masterGainNode = audioCtx.createGain();
		masterAnalyserNode = audioCtx.createAnalyser();
		masterGainNode.connect(masterAnalyserNode);
		masterAnalyserNode.connect(audioCtx.destination);
		audioCtx.addEventListener("statechange", () => {
			suspended = audioCtx.state === "suspended";
			if (!suspended && playing) updateLoop(true);
		});

		(async () => {
			for (const track of data.tracks) {
				tracks.push(
					await new LoadedTrackClass(track, audioCtx, masterGainNode).load()
				);
				duration = tracks[0].data!.length / tracks[0].data!.sampleRate;
			}
			prepare();
		})();

		return () => {
			if (playing) stop();
			audioCtx.close();
			//@ts-ignore
			tracks = null;
		};
	});

	export function prepare() {
		for (const track of tracks) {
			track.source = audioCtx.createBufferSource();
			track.source.buffer = track.data!;
			track.source.connect(track.gainNode!);
		}
	}

	function getLevel01(analyser: AnalyserNode) {
		const buf = new Float32Array(analyser.fftSize);
		analyser.getFloatTimeDomainData(buf);
		// Loudness, doesn't calculate clip
		// return buf.reduce((a, b) => a + Math.abs(b)) / buf.length;
		return buf.reduce((a, b) => (b > a ? b : a));
	}

	let loopID = 0;

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

	export async function play() {
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

	export function stop() {
		playing = false;
		for (const track of tracks) {
			track.source?.stop();
			track.source?.disconnect();
			track.source = undefined;
		}
		prepare();
	}
	export function togglePlay() {
		playing && !suspended ? stop() : play();
	}

	export function updatePlayerPos() {
		let originalState = playing;
		stop();
		if (originalState) play();
	}

	export function handleKey(evt: KeyboardEvent) {
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
