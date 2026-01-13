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
	.page {
		.list {
			display: flex;
			flex-direction: column;
			gap: 8px;
			position: relative;
			margin-bottom: 8px;
			.list {
				& > * {
					background-color: rgb(30, 30, 30);
				}
			}
			& > * {
				background-color: rgb(24, 24, 24);
				border: var(--border);
				overflow: hidden;
				appearance: button;
				display: grid;
				&:has(> img) {
					grid-template-columns: auto 1fr auto;
				}
				&:has(> img):has(:first-child:nth-last-child(2)) {
					grid-template-columns: 1fr auto;
				}
				align-items: center;
				color: white;
				text-decoration: none;
				margin-top: 0;
				margin-bottom: 0;
				padding: 0 16px;
				border-radius: var(--border-radius);
				& > img {
					padding-right: 16px;
				}
			}
		}
	}
</style>
