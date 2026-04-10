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

/**
 * Extracts filename from Content-Disposition header
 */
export const extractFilenameFromHeader = (
	contentDisposition: string | undefined,
	fallbackPrefix = "download",
): string => {
	if (contentDisposition) {
		const match = contentDisposition.match(/filename="?([^"]+)"?/);
		if (match?.[1]) {
			return match[1];
		}
	}
	return `${fallbackPrefix}_${
		new Date().toISOString().replace(/:/g, "-").split(".")[0]
	}.csv`;
};

/**
 * Triggers a file download from blob data
 */
export const downloadBlobAsFile = (
	data: BlobPart,
	filename: string,
	mimeType = "text/csv;charset=utf-8",
): void => {
	const blob = new Blob([data], { type: mimeType });
	const blobUrl = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = blobUrl;
	link.setAttribute("download", filename);
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.URL.revokeObjectURL(blobUrl);
};
