<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";
  import AudioWaveform from "svelte-audio-waveform";
  import { getPeaks } from "$lib/utils";
  import { Slider } from "svelte-awesome-slider";

  let { data }: PageProps = $props();

  let playing = $state(false);
  let playstart = $state(0);
  let pos = $state(0);
  let duration = $state(1);
  let pixelRatio = $state(1);
  let pospct = $derived(pos / duration / pixelRatio);

  let zoom = $state(1);

  $effect(() => {
    zoom;
    pixelRatio = window.devicePixelRatio ?? 1;
  });

  let fullyLoaded = $state(false);

  let mouseDown = $state(false);

  let audioCtx: AudioContext;
  let tracks: LoadedTrack[] = $state([]);
  class LoadedTrack {
    details: {
      name: string;
      url: string;
    };
    playing = false;
    ready = false;
    context: AudioContext;
    data?: AudioBuffer;
    peaks?: number[];
    element?: HTMLAudioElement;
    source?: AudioBufferSourceNode;
    gainNode?: GainNode;
    gain = $state(1);
    mute = $state(false);
    solo = $state(false);
    sourceTarget?: AudioNode;

    constructor(track: { name: string; url: string }, context: AudioContext) {
      this.details = track;
      this.context = context;
      this.gainNode = audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(4, audioCtx.currentTime);
      this.sourceTarget = this.gainNode;
      this.gainNode.connect(audioCtx.destination);
      $effect.root(() => {
        $effect(() => {
          if (this.gainNode)
            this.gainNode.gain.value =
              this.mute || (!this.solo && tracks.find((track) => track.solo))
                ? 0
                : this.gain;
        });
      });
    }

    async load(): Promise<typeof this> {
      let response = await fetch(this.details.url);
      let buffer = await response.arrayBuffer();
      this.data = await this.context.decodeAudioData(buffer);
      buffer = response = null;
      this.peaks = getPeaks(this.data);
      return new Promise((res) => res(this));
    }
  }

  function play() {
    playing = true;
    playstart = audioCtx.currentTime - pos;
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

  function reprepare() {
    stop();
    play();
  }

  function prepare() {
    for (const track of tracks) {
      track.source = audioCtx.createBufferSource();
      track.source.buffer = track.data!;
      track.source.connect(track.sourceTarget!);
    }
  }

  function updateLoop() {
    if (!mouseDown && playing) {
      pos = audioCtx.currentTime - playstart;
      if (pos > duration) {
        stop();
        return;
      }
      requestAnimationFrame(() => {
        updateLoop();
      });
    }
  }

  onMount(() => {
    pixelRatio = window.devicePixelRatio;
    audioCtx = new AudioContext();
    (async () => {
      for (const track of data.tracks)
        tracks.push(await new LoadedTrack(track, audioCtx).load());
      prepare();
      duration =
        tracks[0].source?.buffer?.length / tracks[0].source?.buffer?.sampleRate;
      fullyLoaded = true;
    })();

    return () => {
      stop();
      audioCtx.close();
    };
  });

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
        --track-width="360px"
        --track-height="20px"
        min={0.1}
        max={2}
        step={0.1}
        bind:value={zoom}
      />
      <kbd>{zoom}</kbd>
    </div>
  </div>
  {#if fullyLoaded}
    <div class="tracks">
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
          <Slider
            --track-width="180px"
            --track-height="20px"
            --track-background="hsl(0, 0%, 20%)"
            --thumb-background="hsl(0, 0%, 40%)"
            --margin-block="0"
            min={0}
            max={2}
            step={0.1}
            bind:value={track.gain}
          />
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="wavecontainer"
          onmousemove={(evt) => {
            if (mouseDown && evt.target.tagName == "CANVAS")
              pos = (evt.layerX / evt.target.offsetWidth) * duration;
          }}
          onmousedown={() => (mouseDown = true)}
          onmouseup={(evt) => {
            mouseDown = false;
            if (evt.target.tagName == "CANVAS")
              pos = (evt.layerX / evt.target.offsetWidth) * duration;
            reprepare();
          }}
        >
          <AudioWaveform
            height={100 * pixelRatio}
            width={1000 * pixelRatio * zoom * (duration / 120)}
            barWidth={1}
            progressColor="hsl(0, 0%, 50%)"
            color="hsl(0, 0%, 20%)"
            peaks={track.peaks ?? []}
            position={pospct}
          />
        </div>
      {/each}
    </div>
  {:else}
    <h3>Loading...</h3>
  {/if}
</div>

<style>
  .page {
    height: 100vh;
  }
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
    left: 8px;
    width: calc(100% - 16px);
    height: max-content;
    overflow-x: scroll;
    & > * {
      height: 100px;
      border: 0.5px solid hsl(0, 0%, 15%);
    }
    & > .trackheader {
      p {
        margin: 0;
      }
      .toggles {
        margin: 4px;
        display: flex;
        & > button {
          padding: 3px;
          margin: 0;
          &:first-child {
            border-radius: 8px 0 0 8px;
            border-right: 1px solid hsl(0, 0%, 20%);
          }
          &:last-child {
            border-radius: 0 8px 8px 0;
          }
        }
      }
    }
  }
  .active {
    background: hsl(0, 0%, 70%);
    color: black;
  }
  :global(.progress-wave-wrapper) {
    transition: none !important;
    height: 100px !important;
  }
</style>
