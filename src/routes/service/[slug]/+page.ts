import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
	const listRequest = await supabase.storage
		.from("recordings")
		.list(params.slug);
	if (listRequest.error !== null) throw listRequest.error;
	const tracks = listRequest.data.map((obj) => {
		return {
			name: obj.name,
			url: supabase.storage
				.from("recordings")
				.getPublicUrl(`${params.slug}/${obj.name}`).data.publicUrl,
		};
	});
	const metadataRequest = await supabase
		.from("recordings")
		.select()
		.eq("folder", decodeURI(params.slug));
	if (metadataRequest.error !== null) throw metadataRequest.error;
	return { details: metadataRequest.data[0], tracks };
};
