import { parseAddress } from "addresser";
import { type ClassValue, clsx } from "clsx";
import {
	type CountryCode,
	parsePhoneNumberFromString,
} from "libphonenumber-js";
import { twMerge } from "tailwind-merge";
import { type AddressSource } from "@/types/businessEntityVerification";
import { type Owner } from "@/types/case";
import {
	type PeopleObjectValue,
	type PrimaryAddressValue,
} from "@/types/integrations";
import { isUkAddress, isUSAddress } from "../address";
import { isAddressSource, isOwner, isPrimaryAddressValue } from "../assertions";
import { isCanadianAddress } from "../canadianProvinces";
import { capitalizeStringArray } from "../helper";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
	const skip = ["a", "an", "at", "the", "and", "of", "in", "to"];

	return name
		.split(" ")
		.filter((n) => n && !skip.includes(n))
		.map((n) => n[0])
		.join("")
		.slice(0, 3);
}

export function formatPersonNameAndTitles(
	person: Pick<PeopleObjectValue, "name" | "titles"> | null,
) {
	if (!person) return "";

	/**
	 * Despite being typed as `string[]`, it has been observed that `titles` can also sometimes be a `string`.
	 * Therefore, we need to do a quick transformation to ensure it's always an array.
	 */
	const titles =
		typeof person.titles === "string" ? [person.titles] : person.titles;

	/**
	 * Formatting for 3+ titles:
	 * Input: { name: "jane smith", titles: ["CEO", "CFO", "Founder"] }
	 * Output: "Jane Smith, CEO, CFO, & Founder"
	 *
	 * Formatting for 2 titles:
	 * Input: { name: "jane smith", titles: ["CEO", "Founder"] }
	 * Output: "Jane Smith, CEO & Founder"
	 *
	 * Formatting for 1 title:
	 * Input: { name: "jane smith", titles: ["manager"] }
	 * Output: "Jane Smith, Manager"
	 */
	const hasOneTitle = titles.length === 1;
	const hasTwoTitles = titles.length === 2;
	const formattedTitles = titles.reduce((acc, title, i) => {
		if (!title) return acc; // Skip empty titles

		const isLastTitle = i === titles.length - 1;

		if (isLastTitle && !hasOneTitle) {
			if (hasTwoTitles) {
				return `${acc} & ${title}`;
			}

			return `${acc}, & ${title}`;
		}

		return `${acc}, ${title}`;
	}, "");

	const formattedName = capitalizeStringArray(person.name);
	return formattedTitles.length
		? `${formattedName}${formattedTitles}`
		: formattedName;
}

export const formatAddress = (
	address:
		| (Pick<
				AddressSource,
				| "address_line_1"
				| "address_line_2"
				| "city"
				| "state"
				| "postal_code"
		  > & {
				country?: string;
		  })
		| PrimaryAddressValue
		| Owner
		| string
		| null
		| undefined,
) => {
	let output: string | null = null;
	let parts: string[] = [];
	let country: string | null = null;

	if (typeof address === "string") {
		output = address;
	} else if (isAddressSource(address)) {
		parts = [
			address.address_line_1,
			address.address_line_2 ?? "",
			[address.city, address.state].filter(Boolean).join(", "),
			address.postal_code,
			address.country,
		];
	} else if (isPrimaryAddressValue(address)) {
		parts = [
			address.line_1 ?? "",
			address.apartment ?? "",
			[address.city, address.state].filter(Boolean).join(", "),
			address.postal_code ?? "",
			address.country ?? "",
		];
	} else if (isOwner(address)) {
		country = address.address_country ?? null;
		parts = [
			address.address_line_1,
			address.address_line_2 ?? "",
			[address.address_city, address.address_state]
				.filter(Boolean)
				.join(", "),
			address.address_postal_code,
			address.address_country,
		];
	}

	if (parts.length) output = parts.filter(Boolean).join(", ").trim();
	if (!output) return null;

	output = output
		// Replace multiple spaces with a single space
		.replace(/\s+/g, " ")
		// Replace multiple commas with a single comma
		.replace(/,+/g, ",")
		// Trim leading and trailing spaces
		.trim();

	try {
		if (isUSAddress(output)) {
			return `${parseAddress(output).formattedAddress}, United States`;
		} else if (isUkAddress(output)) {
			return `${parseAddress(output).formattedAddress}, United Kingdom`;
		} else if (isCanadianAddress(output)) {
			return `${parseAddress(output).formattedAddress}, Canada`;
		}

		return `${parseAddress(output).formattedAddress}, ${country}`;
	} catch (error) {
		console.error("Error parsing address:", output, error);
		return output;
	}
};

export const formatPhoneNumber = (
	phone: string | null | undefined,
	defaultRegion: CountryCode = "US",
) => {
	if (!phone) return null;

	const parsed = parsePhoneNumberFromString(phone, {
		defaultCountry: defaultRegion,
	});

	if (!parsed?.isValid()) return phone;
	const countryCode = `+${parsed.countryCallingCode}`;
	const national = parsed.formatNational();
	return `${countryCode} ${national}`;
};

export const formatName = (person: {
	first_name: string | null | undefined;
	last_name: string | null | undefined;
}) => {
	return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim();
};
