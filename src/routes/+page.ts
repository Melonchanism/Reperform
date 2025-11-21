import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
	const { data, error } = await supabase.from("recordings").select();

	console.log(error);

	if (error !== null) throw error;

	let sorted = new Map<string, RecordItem[]>();

	for (const item of data as RecordItem[]) {
		if (sorted.get(item.date) == null) {
			sorted.set(item.date, [item]);
		} else {
			sorted.get(item.date)?.push(item);
		}
	}
	return { sorted };
};
