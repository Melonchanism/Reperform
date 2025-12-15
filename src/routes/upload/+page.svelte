<script lang="ts">
	import { supabase } from "$lib/supabase";
	import {
		PUBLIC_SUPABASE_ANON_KEY,
		PUBLIC_SUPABASE_URL,
	} from "$env/static/public";
	import { onMount } from "svelte";
	import Uppy from "@uppy/core";
	import Dashboard from "@uppy/dashboard";
	import Tus from "@uppy/tus";
	import xhook from "xhook";
	import "@uppy/core/css/style.min.css";
	import "@uppy/dashboard/css/style.min.css";

	const STORAGE_BUCKET = "recordings";
	const supabaseStorageURL = new URL(
		"/storage/v1/upload/resumable",
		PUBLIC_SUPABASE_URL
	).href;

	let dateInput: HTMLInputElement;

	let name = "";

	let uppy: Uppy;
	onMount(() => {
		xhook.before(function (request) {
			let url = new URL(request.url);
			if (!url.pathname.includes("/v1/"))
				url.pathname = "/storage/v1" + url.pathname;
			if (request.url.includes("syllogistic")) {
				url.port = "";
				url.protocol = "https:";
			}
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
				chunkSize: 1024 * 1024 * 6,
				allowedMetaFields: [
					"bucketName",
					"objectName",
					"contentType",
					"cacheControl",
				],
				onError: function (error) {
					console.log("Failed because: " + error);
				},
			});

		dateInput.valueAsDate = new Date();
	});

	async function upload(evt: MouseEvent) {
		let folder = `${dateInput.value} ${name}`;
		let files = uppy.getFiles();

		if (files.length == 0) {
			alert("No files to upload");
			return;
		}

		if (name.replaceAll(" ", "") == "") {
			alert("Name should not be empty");
			return;
		}

		const { data, error } = await supabase
			.from("recordings")
			.select()
			.eq("name", name)
			.eq("date", dateInput.value);

		let append = false;
		if (data!.length > 0) {
			append = true;
			if (!confirm("append to existing service?")) throw null;
		}

		if (data)
			files.forEach((file) => {
				const supabaseMetadata = {
					bucketName: STORAGE_BUCKET,
					objectName: folder ? `${folder}/${file.name}` : file.name,
					contentType: file.type,
				};

				file.meta = {
					...file.meta,
					...supabaseMetadata,
				};
			});

		uppy.getFiles().forEach((file) => {
			console.log(file.meta.objectName);
		});

		if (!append) {
			const error2 = (
				await supabase
					.from("recordings")
					.insert({ name, date: dateInput.value, folder })
			).error;

			if (error2) {
				alert(error2.details);
				throw error2;
			}
		}

		uppy.upload();
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

	:global(.uppy-Dashboard-inner) {
		border: none;
		border-radius: var(--border-radius);
		width: auto !important;
		background-color: transparent !important;
	}
</style>
