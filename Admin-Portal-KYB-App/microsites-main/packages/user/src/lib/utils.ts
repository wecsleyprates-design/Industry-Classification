import { type ClassValue, clsx } from "clsx";
import {
	type CountryCode,
	parsePhoneNumberFromString,
} from "libphonenumber-js";
import { twMerge } from "tailwind-merge";

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
