interface RecordItem {
	date: string;
	name: string;
	folder: string;
	zones: Zone[];
}

interface Zone {
	name: string;
	start: number;
	end: number;
}
