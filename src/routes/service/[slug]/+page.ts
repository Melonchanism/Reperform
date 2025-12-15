import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

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
	const metadataRequest: PostgrestSingleResponse<RecordItem> = await supabase
		.from("recordings")
		.select()
		.eq("folder", decodeURI(params.slug))
		.single();
	if (metadataRequest.error !== null) throw metadataRequest.error;
	return { details: metadataRequest.data, tracks };
};
