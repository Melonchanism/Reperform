import type { RequestHandler } from "@sveltejs/kit";
import { supabase } from "$lib/supabase";

export const GET: RequestHandler = async ({ url }) => {
	const { data, error } = await supabase.from("recordings").select();
	const item: RecordItem | null = data[parseInt(url.pathname.replace("/", ""))];
	if (item) {
		return new Response(null, {
			status: 301,
			headers: {
				location: `/service/${item.folder}`,
			},
		});
	} else
		return new Response(null, {
			status: 404,
		});
};
