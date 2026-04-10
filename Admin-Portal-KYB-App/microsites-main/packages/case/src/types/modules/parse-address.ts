declare module "parse-address" {
	export interface ParsedAddress {
		number?: string;
		prefix?: string;
		suffix?: string;
		street?: string;
		type?: string;
		city?: string;
		state?: string;
		zip?: string;
		sec_unit_type?: string;
		sec_unit_num?: string;
		country?: string;
	}

	export function parseLocation(addressString: string): ParsedAddress;
}
