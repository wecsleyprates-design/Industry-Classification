import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import qs from "qs";
import { type IPermission } from "@/types/auth";
import { type IPayload, type TAllPermissions } from "@/types/common";

import { DATE_FORMATS } from "@/constants";
import {
	ACCESS,
	type TAccessType,
	type TCodeModule,
} from "@/constants/Modules";

dayjs.extend(utc);

// Adverse Media Helper Functions
export const formatAdverseMediaSourceAndDate = (
	source?: string,
	date?: string | null,
) => {
	if (source && date) {
		return `${source} • ${date}`;
	}
	return source ?? date ?? "";
};

export const truncateTitle = (
	title: string,
	maxLength: number = 512,
): string => {
	if (title.length <= maxLength) {
		return title;
	}
	return title.substring(0, maxLength - 3) + "...";
};

export const formatDate = (
	date: Date | string,
	format = DATE_FORMATS.DEFAULT,
	options = { local: true },
): string => {
	const d = options.local ? dayjs.utc(date).local() : dayjs.utc(date);
	return d.format(format);
};

/**
 * Returns the current system timezone using the native Intl API
 * @returns {string} IANA timezone identifier (e.g., "America/New_York")
 */
export const getCurrentTimezone = () => {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const convertToLocalDate = (
	date: string | number | Date | null | undefined,
	format:
		| "MM-DD-YYYY - h:mmA"
		| "MM-DD-YYYY"
		| "D MMM YYYY "
		| "MMM'YY"
		| "MMMM DD, YYYY"
		| "MMM'YY"
		| "YYYY"
		| "MM/DD/YYYY"
		| "MM/DD/YYYY, h:mm A"
		| "MMM DD, YYYY"
		| "DD/MM/YYYY"
		| "YYYY-MM-DD",
) => {
	if (!date) return null;
	return dayjs(date).format(format);
};

/**
 * @description Function is used to capitalize the first letter of each word in a string array.
 */
export function capitalizeStringArray(title: string): string;
export function capitalizeStringArray(title: null): null;
export function capitalizeStringArray(title: undefined): undefined;
export function capitalizeStringArray(
	title: string | null | undefined,
): string | null | undefined;
export function capitalizeStringArray(
	title?: string | undefined | null,
): string | undefined | null {
	if (!title) return title;

	return title
		.split(" ")
		.map(
			(word) =>
				word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
		)
		.join(" ");
}

export const capitalize = capitalizeStringArray;

export const formatPriceWithSuffix = (
	price: number | null,
	fraction?: number,
): string => {
	if (!price && price !== 0) return "-";

	const suffixes = ["", "K", "M", "B", "T"];
	const magnitude = Math.floor(Math.log10(Math.abs(price)) / 3);

	const formattedPrice = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: fraction ?? 2,
		maximumFractionDigits: fraction ?? 2,
	}).format(price !== 0 ? price / Math.pow(10, magnitude * 3) : 0);

	return `${formattedPrice}${suffixes[magnitude] ?? ""}`;
};

export const indexBasedOnMonth = (
	key:
		| "January"
		| "February"
		| "March"
		| "April"
		| "May"
		| "June"
		| "July"
		| "August"
		| "September"
		| "October"
		| "November"
		| "December",
) => {
	const months = {
		January: 0,
		February: 1,
		March: 2,
		April: 3,
		May: 4,
		June: 5,
		July: 6,
		August: 7,
		September: 8,
		October: 9,
		November: 10,
		December: 11,
		Jan: 0,
		Feb: 1,
		Mar: 2,
		Apr: 3,
		// May: 4,
		Jun: 5,
		Jul: 6,
		Aug: 7,
		Sep: 8,
		Oct: 9,
		Nov: 10,
		Dec: 11,
	};

	return months[key] !== undefined ? months[key] : -1;
};

export const getSearchPayload = (
	searchParams: URLSearchParams,
	defaultSortParam: string = "data_cases.created_at",
	pagination: boolean = true,
): IPayload => {
	const payloadObj: IPayload = {
		page: parseInt(searchParams.get("page") ?? "1"),
		pagination,
		items_per_page: parseInt(searchParams.get("itemsPerPage") ?? "10"),
		sort: qs.parse(
			searchParams.get("sort") ?? { [defaultSortParam]: "DESC" },
		),
		...(searchParams.get("filter") && {
			filter: qs.parse(searchParams.get("filter") ?? ""),
		}),
		...(searchParams.get("search") && {
			search: qs.parse(searchParams.get("search") ?? ""),
		}),
		...(searchParams.get("filter_date") && {
			filter_date: qs.parse(searchParams.get("filter_date") ?? ""),
		}),
	};
	return payloadObj;
};

export const concatString = (values: string[]) => {
	return values.filter((value) => value?.trim()).join(" ") || "-";
};

export const getAllPermissions = (
	permissions: unknown,
	module: string[],
): Partial<TAllPermissions> => {
	if (!Array.isArray(permissions)) return {};

	const val = (permissions as IPermission[]).reduce(
		(acc: Partial<TAllPermissions>, item) => {
			const itemCode = item.code.split(":");
			const [itemModule, itemPermission] = itemCode as [
				TCodeModule,
				TAccessType,
			];

			if (module.includes(itemModule)) {
				if (itemPermission === ACCESS.READ) {
					acc[itemModule] = { ...acc[itemModule], read: true };
				} else if (itemPermission === ACCESS.WRITE) {
					acc[itemModule] = { ...acc[itemModule], write: true };
				} else if (itemPermission === ACCESS.CREATE) {
					acc[itemModule] = { ...acc[itemModule], create: true };
				}
			}
			return acc;
		},
		{},
	);
	return val;
};

export function serializeFilters(payload: any) {
	const serialized: Record<string, any> = {};

	if (payload.filter) {
		const flattenFilter = (obj: any, parentKey = "") => {
			for (const key in obj) {
				const value = obj[key];
				const fullKey = parentKey ? `${parentKey}.${key}` : key;

				if (Array.isArray(value)) {
					value.forEach((v, idx) => {
						serialized[`filter[${fullKey}][${idx}]`] = v;
					});
				} else if (
					value &&
					typeof value === "object" &&
					("from" in value || "to" in value)
				) {
					if (value.from)
						serialized[`filter_date[${fullKey}][0]`] = new Date(
							value.from,
						).toISOString();
					if (value.to)
						serialized[`filter_date[${fullKey}][1]`] = new Date(
							value.to,
						).toISOString();
				} else if (value && typeof value === "object") {
					flattenFilter(value, fullKey);
				} else {
					serialized[`filter[${fullKey}]`] = value;
				}
			}
		};

		flattenFilter(payload.filter);
	}

	if (payload.sort) {
		for (const sortKey in payload.sort) {
			serialized[`sort[${sortKey}]`] = payload.sort[sortKey];
		}
	}

	for (const key in payload) {
		if (key !== "filter" && key !== "sort") {
			serialized[key] = payload[key];
		}
	}

	return serialized;
}
