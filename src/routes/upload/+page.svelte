<script lang="ts">
	import { supabase } from "$lib/supabase";
	import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_UPLOAD_URL } from "$env/static/public";
	import { onMount } from "svelte";
	import Uppy from "@uppy/core";
	import Dashboard from "@uppy/dashboard";
	import Tus from "@uppy/tus";
	import xhook from "xhook";
	import "@uppy/core/css/style.min.css";
	import "@uppy/dashboard/css/style.min.css";

	const STORAGE_BUCKET = "recordings";
	// Cloudflare being stupid also security for now
	const supabaseStorageURL = new URL("/storage/v1/upload/resumable", PUBLIC_SUPABASE_UPLOAD_URL).href;

	let dateInput: HTMLInputElement;

	let name = $state("");
	let zones: Zone[] = $state([]);

	let uppy: Uppy;
	onMount(() => {
		xhook.before(function (request) {
			let url = new URL(request.url);
			let baseURL = new URL(PUBLIC_SUPABASE_UPLOAD_URL);
			if (!url.pathname.includes("/v1/")) url.pathname = "/storage/v1" + url.pathname;
			url.port = baseURL.port;
			url.protocol = baseURL.protocol;
			request.url = url.href;
		});
		uppy = new Uppy({
			restrictions: {
				allowedFileTypes: ["audio/*"],
			},
		})
			.use(Dashboard, {
				inline: true,
				target: "#dashboard",
				theme: "dark",
				hideUploadButton: true,
			})
			.use(Tus, {
				endpoint: supabaseStorageURL,
				headers: {
					authorization: `Bearer ${PUBLIC_SUPABASE_ANON_KEY}`,
					apikey: PUBLIC_SUPABASE_ANON_KEY,
				},
				uploadDataDuringCreation: true,
				chunkSize: 1024 * 1024 * 20,
				allowedMetaFields: ["bucketName", "objectName", "contentType", "cacheControl"],
				onError: function (error) {
					console.log("Failed because: " + error);
				},
			});
		const date = new Date();
		let params = date
			.toLocaleDateString()
			.split("/")
			.map((itm) => itm.padStart(2, "0"));
		const year = params.pop()!;
		dateInput.value = params.toSpliced(0, 0, year).join("-");
	});

	async function upload() {
		let folder = `${dateInput.value} ${name}`;
		let files = uppy.getFiles();

		if (name.replaceAll(" ", "") == "" || dateInput.value == null) {
			alert("A field was left blank");
			return;
		}

		if (!zones.every((itm) => itm.end !== -1 && itm.start !== -1)) {
			alert("Zones invaid");
			return;
		}

		const { data, error } = await supabase.from("recordings").select().eq("name", name).eq("date", dateInput.value);

		let append = false;
		if (data!.length > 0) {
			append = true;
			if (!confirm("append to existing service?")) return;
		}

		let error2;
		if (!append) {
			error2 = (await supabase.from("recordings").insert({ name, date: dateInput.value, folder, zones })).error;
		} else {
			error2 = (
				await supabase
					.from("recordings")
					.update({ name, date: dateInput.value, folder, zones })
					.eq("name", name)
					.eq("date", dateInput.value)
			).error;
			return;
		}
		if (error || error2) {
			//@ts-ignore
			alert((error ?? error2).details);
			return;
		}

		if (files.length == 0 && !append) {
			alert("No files to upload");
			return;
		}

		if (data)
			files.forEach((file) => {
				file.meta = {
					...file.meta,
					bucketName: STORAGE_BUCKET,
					objectName: folder ? `${folder}/${file.name}` : file.name,
					contentType: file.type,
				};
			});

		uppy.upload();
	}

	function convertTime(value: String) {
		let split = value.split(":");
		if (split.length === 1) return parseInt(split[0]);
		else if (split.length === 2) return parseInt(split[0]) * 60 + parseInt(split[1]);
		else return -1;
	}
</script>

<svelte:head>
	<title>Upload Trackset | Reperform</title>
</svelte:head>

<div class="page">
	<h1>Upload Trackset</h1>
	<div class="inputs">
		<div class="form">
			<p>Name</p>
			<input type="text" bind:value={name} />
			<p>Date</p>
			<input type="date" bind:this={dateInput} />
			<p>Zones</p>
			<div>
				<button onclick={() => zones.push({ name: "", start: -1, end: -1 })}>Add Zone</button>
				<div class="list nested">
					{#each zones as zone, i}
						<div class="zone">
							<p>{i + 1}</p>
							<div class="zoneinputs">
								<input type="text" placeholder="Title" bind:value={zone.name} />
								<div>
									<input
										type="number"
										placeholder="Start"
										oninput={(evt) => {
											zone.start = convertTime((evt.target as HTMLInputElement).value);
										}}
									/>
									<p>-</p>
									<input
										type="number"
										placeholder="End"
										oninput={(evt) => {
											zone.end = convertTime((evt.target as HTMLInputElement).value);
										}}
									/>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
		<div id="dashboard"></div>
	</div>
	<button onclick={upload} style="width:100%; margin-top: 8px;">
		<h2>Submit</h2>
	</button>
</div>

<style>
	.inputs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		position: relative;
		& > * {
			background-color: rgb(24, 24, 24);
			border: var(--border);
			border-radius: var(--border-radius);
			overflow: hidden;
		}
		@media (max-width: 900px) {
			grid-template-columns: 1fr;
		}
	}

	.form {
		padding: 4px;
		position: relative;
		p {
			margin-bottom: 2px;
		}
		input {
			width: calc(100% - 16px);
		}
	}

	.zone {
		display: grid;
		grid-template-columns: auto 1fr;
		* {
			margin: 4px;
		}
		.zoneinputs {
			div {
				display: grid;
				grid-template-columns: 1fr auto 1fr;
			}
		}
	}

	:global(.uppy-Dashboard-inner) {
		border: none;
		border-radius: var(--border-radius);
		width: auto !important;
		background-color: transparent !important;
	}
</style>
