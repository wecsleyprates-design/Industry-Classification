import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import * as qs from "qs";
import { twMerge } from "tailwind-merge";
import { type IPayload } from "@/lib/types/common";
import { type IPermission } from "./types/auth";
import { type TAllPermissions } from "./types/store";
import { getItem } from "./localStorage";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import {
	ACCESS,
	type TAccessType,
	type TCodeModule,
} from "@/constants/Modules";

dayjs.extend(utc);

export const formatDate = (date: Date | string): string => {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
	});
};

export const convertToLocalDate = (
	date: string | number | Date | null,
	foramt:
		| "MM-DD-YYYY - h:mmA"
		| "MM-DD-YYYY"
		| "D MMM YYYY "
		| "MMM’YY"
		| "MMMM DD, YYYY"
		| "MMM'YY"
		| "YYYY"
		| "MM/DD/YYYY"
		| "MMM DD, YYYY"
		| "DD/MM/YYYY"
		| "YYYY-MM-DD",
) => {
	if (!date) return null;
	return dayjs(date).format(foramt);
};

/**
 * @description Function is used to capitalize the first letter of each word in a string array.
 */
export const capitalizeStringArray = (title: string) => {
	return title
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
};

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

/**
 * Adds 'tw-' prefix to Tailwind CSS class names
 * Handles negative classes like '-mt-8' -> '-tw-mt-8'
 *
 * @param {string} classNames - Space-separated Tailwind class names
 * @returns {string} - Updated class names with 'tw-' prefix
 */
export const cx = (className: string) => {
	const classNames = className
		.split(" ") // Split class names by space
		.map((cls) => {
			// Check for negative classes starting with '-'
			if (cls.startsWith("-")) {
				return `-tw-${cls.slice(1)}`; // Add 'tw-' after the dash
			}
			return `tw-${cls}`; // Add 'tw-' prefix for regular classes
		})
		.join(" "); // Join back the class names

	return twMerge(classNames);
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
		sort: qs.parse(searchParams.get("sort") ?? { [defaultSortParam]: "DESC" }),
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

/*
 * Check if user has access to a feature based on permission code
 * @param {string} permissionCode - The permission code to check (e.g., "case:read")
 * @returns {boolean} - Returns true if the user has access, otherwise false
 */
export const checkFeatureAccess = (permissionCode: string): boolean => {
	const permissions: string[] = getItem(LOCALSTORAGE.allPermissions) ?? [];
	return permissions.includes(permissionCode);
};
