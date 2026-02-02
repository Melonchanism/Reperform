<script lang="ts">
	import type { PageProps } from "./$types";

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Home | Reperform</title>
</svelte:head>

<div class="page">
	<h1>Reperform</h1>
	<div class="list">
		<a href="/upload">
			<img src="/upload.svg" alt="" />
			<h3>Upload</h3>
			<img src="/arrow_forward.svg" alt="" />
		</a>
	</div>
	<div class="list">
		{#each data.sorted as [date, records]}
			<div>
				<h3>{date}</h3>
				<div class="list">
					{#each records as performance}
						<a href="/service/{performance.folder}">
							<h4>{performance.name}</h4>
							<img alt="" src="/arrow_forward.svg" />
						</a>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
</style>
