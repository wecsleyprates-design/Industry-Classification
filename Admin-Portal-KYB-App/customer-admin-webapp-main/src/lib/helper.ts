import axios from "axios";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import * as qs from "qs";
import { type Ttype } from "@/components/Badge/StatusBadge";
import { type DateRangeType, type DateType } from "@/components/Filter/types";
import { type IPermission } from "@/types/auth";
import {
	type IPayload,
	type SnakeDateType,
	type TAccessType,
	type TAllPermissions,
	type TCodeModule,
	type TPermissionResponse,
} from "@/types/common";
import { type AdverseMediaResponseDataArticle } from "@/types/publicRecords";
import { type GetWebhookEventsData } from "@/types/webhooks";
import { URL } from "../constants";
import { loadRemoteModule } from "./utils/loadRemote";
import { getItem } from "./localStorage";

import { envConfig } from "@/config/envConfig";
import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { ACCESS } from "@/constants/Modules";
import { remoteAppNames, remoteAppUrls } from "@/constants/remoteUrls";

// Adverse Media Helper Functions
export const getRelevantArticles = (
	articles: AdverseMediaResponseDataArticle[],
) => {
	return articles.filter(
		(article) =>
			(article.entity_focus_score || 0) >= 8 &&
			(article.risk_level === "MEDIUM" || article.risk_level === "HIGH"),
	);
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

export const formatAdverseMediaSourceAndDate = (
	source?: string,
	date?: string | null,
) => {
	if (source && date) {
		return `${source} • ${date}`;
	}
	return source || date || "";
};

dayjs.extend(utc);
dayjs.extend(timezone);

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
		| "MMM D, YYYY"
		| "MMM’YY"
		| "MMM YY"
		| "YYYY"
		| "MMMM DD, YYYY"
		| "MM/DD/YYYY"
		| "MMM DD, YYYY"
		| "MM/DD/YY",
) => {
	if (!date) return "-";
	return dayjs(date).format(foramt);
};
export const convertToLocalDateStripe = (
	date: number,
	foramt: "MM-DD-YYYY - h:mmA" | "MM-DD-YYYY" | "MMM D, YYYY",
) => {
	if (!date) return null;
	return dayjs(date * 1000).format(foramt);
};
export const getSlugReplacedURL = (
	url: string,
	slug: string | string[],
	keys?: string[],
): string => {
	if (!slug || !url) return "";
	if (typeof slug === "string") return url.replace(":slug", slug);
	if (slug.length === 0 || keys?.length === 0) return url;
	let newURL = url;
	if (Array.isArray(keys)) {
		const keysLength = keys ? keys?.length : 0;
		for (let index: number = 0; index < keysLength; index++) {
			newURL = newURL.replace(keys[index], slug[index]);
		}
	}
	return newURL;
};

export const getSearchPayload = (
	searchParams: URLSearchParams,
	defaultSortParam: string = "data_cases.created_at",
	pagination: boolean = true,
): IPayload => {
	const filterRaw = searchParams.get("filter");
	const filterDateRaw = searchParams.get("filter_date");
	const payloadObj: IPayload = {
		page: parseInt(searchParams.get("page") ?? "1"),
		pagination,
		items_per_page: parseInt(searchParams.get("itemsPerPage") ?? "10"),
		sort: qs.parse(searchParams.get("sort") ?? { [defaultSortParam]: "DESC" }),
		...(filterRaw && {
			filter: qs.parse(filterRaw ?? ""),
		}),
		...(searchParams.get("search") && {
			search: qs.parse(searchParams.get("search") ?? ""),
		}),
		...(filterDateRaw && {
			filter_date: qs.parse(filterDateRaw ?? ""),
		}),
	};
	return payloadObj;
};

export const convertStartEndDateSnakeCase = (
	selectedDates: Partial<Record<string, DateRangeType>>,
) => {
	const newDates: Record<string, SnakeDateType> = {};

	for (const [key, value] of Object.entries(selectedDates)) {
		if (value?.startDate && value?.endDate)
			newDates[key] = { start_date: value.startDate, end_date: value.endDate };
	}

	return newDates;
};

export const convertToStartEndDate = (
	selectedDates: Record<string, DateType[]>,
) => {
	const newDates: Record<string, DateRangeType> = {};

	for (const [key, value] of Object.entries(selectedDates)) {
		if (value[0] && value[1])
			newDates[key] = { startDate: value[0], endDate: value[1] };
	}

	return newDates;
};

export const getPermissions = (
	permissions: IPermission[],
	module: string,
): Partial<TPermissionResponse> => {
	if (!Array.isArray(permissions)) return {};
	const val = permissions.reduce((acc: Partial<TPermissionResponse>, item) => {
		const itemCode = item.code.split(":");
		const itemModule = itemCode?.[0];
		const itemPermission = itemCode?.[1];

		if (itemModule === module) {
			if (itemPermission === ACCESS.READ) {
				acc.read = true;
			} else if (itemPermission === ACCESS.WRITE) {
				acc.write = true;
			} else if (itemPermission === ACCESS.CREATE) {
				acc.create = true;
			}
		}
		return acc;
	}, {});
	return val;
};

export const getAllPermissions = (
	permissions: IPermission[],
	module: string[],
): Partial<TAllPermissions> => {
	if (!Array.isArray(permissions)) return {};

	const val = permissions.reduce((acc: Partial<TAllPermissions>, item) => {
		const itemCode = item.code.split(":");
		const [itemModule, itemPermission] = itemCode as [TCodeModule, TAccessType];

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
	}, {});
	return val;
};

export const concatenate = (values: string[], separator: string = " ") => {
	return values
		.filter((value) => value !== null && value?.trim() !== "")
		.join(separator)
		.trim();
};

export const getPlaidIdvRiskScoreLevel = (
	score?: number,
): { type: Ttype; text: string } | null => {
	if (typeof score === "number") {
		if (score >= 0 && score <= 40) {
			return { type: "green_tick", text: "Low Risk" };
		} else if (score > 40 && score <= 70) {
			return { type: "warning", text: "Moderate Risk" };
		} else if (score > 70) {
			return { type: "red_cross", text: "High Risk" };
		}
	}
	return null;
};

export const concatenateAddress = (values: Array<string | null>) => {
	const filteredValues = values.filter(Boolean);
	if (filteredValues.length === 0) return "-";
	const concatenatedValues = filteredValues.map((value) => {
		if (typeof value === "string" && value.endsWith(",")) {
			return value.slice(0, -1);
		}
		return value;
	});
	const concatenatedString = concatenatedValues.join(", ");

	return concatenatedString.trim() !== "" ? concatenatedString : "-";
};

/**
 * @returns timezone
 */
export const getCurrentTimezone = () => {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

export const capitalize = (str: string, fallbackValue?: string) => {
	if (!str && fallbackValue !== undefined) {
		return fallbackValue;
	}
	str = str?.toLowerCase();
	return str?.charAt(0)?.toUpperCase() + str?.slice(1);
};

export const getStatusType = (status: string): Ttype => {
	switch (status) {
		case "ONBOARDING":
			return "green_clock";
		case "AUTO_APPROVED":
			return "green_tick";
		case "SCORE_CALCULATED":
			return "green_clock";
		case "ACTIVE":
			return "active";
		case "INACTIVE":
			return "inactive";
		case "INVITED":
			return "yellow_clock";
		case "UNDER_MANUAL_REVIEW":
			return "red_exclamation_triangle";
		case "MANUALLY_APPROVED":
			return "yellow_clock";
		case "INVITE_EXPIRED":
			return "red_cross";
		case "NOT_SUBSCRIBED":
			return "grey_user";
		case "CANCELLED":
			return "red_exclamation_triangle";
		case "REJECTED":
			return "red_exclamation_circle";
		case "ARCHIVED":
			return "red_exclamation_triangle";
		case "VERIFIED":
			return "green_tick";
		case "UNVERIFIED":
			return "red_cross";
		case "EXPIRED":
			return "red_cross";
		case "ACCEPTED":
			return "green_tick";
		case "COMPLETED":
			return "green_tick";
		case "SUBMITTED":
			return "green_tick";
		case "PENDING_DECISION":
			return "yellow_spiral";
		case "MANUALLY_REJECTED":
			return "red_exclamation_triangle";
		case "INFORMATION_REQUESTED":
			return "yellow_clock";
		case "RISK_ALERT":
			return "red_exclamation_circle";
		case "INVESTIGATING":
			return "yellow_spiral";
		case "ESCALATED":
			return "yellow_clock";
		case "DISMISSED":
			return "green_tick";
		case "PAUSED":
			return "yellow_spiral";
		case "check_connection":
			return "red_exclamation_circle";
		// case "active":
		// 	return "active";
		// case "inactive":
		// 	return "inactive";
		default:
			return "green_clock";
	}
};

export const formatPrice = (price: number | null) => {
	if (!price && price !== 0) return "-";
	const formattedPrice = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(price);
	return formattedPrice;
};

export const convertToYearRange = (year: number) => {
	const academicYear = year + 1;
	const academicYearString = `${year}-${academicYear}`;
	return academicYearString;
};

export const classNames = (...classes: string[]) => {
	return classes.filter(Boolean).join(" ");
};

export const convertToDateRange = (
	startDateString: string,
	endDateString: string,
) => {
	const startDate = new Date(startDateString);
	const endDate = new Date(endDateString);

	const formattedStartDate = `${(startDate.getMonth() + 1)
		.toString()
		.padStart(2, "0")}/${startDate
		.getDate()
		.toString()
		.padStart(2, "0")}/${startDate.getFullYear()}`;

	const formattedEndDate = `${(endDate.getMonth() + 1)
		.toString()
		.padStart(2, "0")}/${endDate
		.getDate()
		.toString()
		.padStart(2, "0")}/${endDate.getFullYear()}`;

	return `${formattedStartDate} - ${formattedEndDate}`;
};

export const formatSSN = (number: string | null, visible: boolean): string => {
	if (!number) {
		return "-";
	}
	const lastFourDigits: string = number.slice(-4);
	if (visible) {
		return `${number.slice(0, 3)}-${number.slice(3, 5)}-${lastFourDigits}`;
	}
	return `XXX-XX-${lastFourDigits}`;
};

export const formatSensitiveField = (
	value: string | null,
	visible: boolean,
): string => {
	if (!value) {
		return "-";
	}

	if (visible) {
		return value;
	}

	if (value.length <= 4) {
		return "X".repeat(value.length);
	}

	const lastFourDigits: string = value.slice(-4);
	const maskedPart: string = "X".repeat(value.length - 4);
	return `${maskedPart}${lastFourDigits}`;
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
		| "December"
		| "Jan"
		| "Feb"
		| "Mar"
		| "Apr"
		| "Jun"
		| "Jul"
		| "Aug"
		| "Sep"
		| "Oct"
		| "Nov"
		| "Dec",
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
 *
 * @param formatNumber to return with suffix
 * @returns
 */
export const formatNumberWithSuffix = (
	formatNumber: number | null,
	fraction?: number,
): string => {
	if (formatNumber === null || formatNumber === undefined) return "-";

	const suffixes = ["", "K", "M", "B", "T"];
	const magnitude = Math.floor(Math.log10(Math.abs(formatNumber)) / 3);
	const suffix = suffixes[magnitude] ?? "";

	let formattedNumber;

	if (suffix) {
		formattedNumber = (formatNumber / Math.pow(10, magnitude * 3)).toFixed(
			fraction ?? 2,
		);
	} else {
		formattedNumber = formatNumber.toString();
	}

	return `${formattedNumber}${suffix}`;
};

/**
 * Makes handle bar text bold
 * @param // Replace '{{' with '<b>{{' and '}}' with '}}</b>'
 * @returns string
 */
export const transformText = (text: string) => {
	return text
		.replace(/{{/g, "<b>{{")
		.replace(/}}/g, "}}</b>")
		.replace(/<b>{{(caseId|invitationId)}}<\/b>/g, "<b>{{$1 this}}</b>");
};

export const transformText2 = (
	text: string,
	variableNames: string[],
	toBeHyperlinked: string[],
) => {
	// Add <b> tags to variables in variableNames
	variableNames.forEach((variable) => {
		const pattern = new RegExp(`{{${variable}}}`, "g");
		text = text.replace(pattern, `<b>{{${variable}}}</b>`);
	});

	// Add " this" to variables in toBeHyperlinked
	toBeHyperlinked.forEach((variable) => {
		const pattern = new RegExp(`{{${variable}}}`, "g");
		text = text.replace(pattern, `{{${variable} this}}`);
	});
	return text;
};

// Sort variables that are present in the template
export const sortVariables = (
	text: string,
	metadata: Record<string, unknown>,
) => {
	const result: Record<string, unknown> = {};
	for (const key in metadata) {
		if (
			Object.prototype.hasOwnProperty.call(metadata, key) &&
			(text.includes(`{{${key}}}`) || key === "business_id")
		) {
			result[key] = metadata[key];
		}
	}
	return result;
};

export const getImageTypeAndData = async (url: string) => {
	return await fetch(url)
		.then(async (res) => await res.blob()) // Gets the response and returns it as a blob
		.then(async (blob) => {
			const objectURL = await blob.text();
			if (objectURL.includes("<svg") && objectURL.includes("</svg>")) {
				return { svg: true, objectUrl: objectURL };
			} else {
				return { svg: false, objectUrl: url };
			}
		})
		.catch(() => {
			return { svg: false, objectUrl: url };
		});
};

/**
 * sortEventList to show default category first
 */
export const sortEventList = (
	data: GetWebhookEventsData[] | undefined,
): GetWebhookEventsData[] => {
	const defaultCategory = data?.find(
		(item) => item.category_code === "default",
	);
	const otherCategories =
		data?.filter((item) => item.category_code !== "default") || [];

	if (defaultCategory) {
		defaultCategory.category_label = "Default Events";
	}

	return [defaultCategory, ...otherCategories].filter(
		Boolean,
	) as GetWebhookEventsData[];
};

export const convertToBytes = (sizeStr: string | null) => {
	if (!sizeStr) {
		return null;
	}
	const unitMultipliers: Record<string, number> = {
		B: 1,
		KB: 1024,
		MB: 1024 ** 2,
		GB: 1024 ** 3,
		TB: 1024 ** 4,
	};
	sizeStr = sizeStr.trim().toUpperCase();
	const numStr = sizeStr?.match(/\d+/)?.[0] ?? "0";
	const unitStr: string = sizeStr?.match(/[A-Z]+/)?.[0] ?? "B";
	if (!unitStr) {
		return 0;
	}
	const sizeNum = parseInt(numStr, 10);
	const multiplier = unitMultipliers[unitStr];
	const sizeInBytes = sizeNum * multiplier;
	return sizeInBytes;
};

export const fileNameFormater = (filename: string): string => {
	if (!filename) return "";
	const lastDashIndex = filename.lastIndexOf("-{");
	const lastCurlyCloseIndex = filename.lastIndexOf("}");

	if (
		lastDashIndex === -1 ||
		lastCurlyCloseIndex === -1 ||
		lastCurlyCloseIndex < lastDashIndex
	) {
		return filename;
	}

	if (lastCurlyCloseIndex > lastDashIndex) {
		const beforeSuffix = filename.substring(0, lastDashIndex);
		const afterSuffix = filename.substring(lastCurlyCloseIndex + 1);
		return beforeSuffix + afterSuffix;
	}

	return filename;
};

export const fileDownloader = async (file: string, fileName: string) => {
	try {
		const response = await axios.get(file, {
			responseType: "blob",
		});
		const blob = new Blob([response.data], {
			type: response.headers["content-type"],
		});
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.setAttribute("download", fileNameFormater(fileName));
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.URL.revokeObjectURL(url);
	} catch (error) {
		window.open(file, "_blank");
		console.error(error);
	}
};

export function extractCaseIdFromUrl(url: string): string | null {
	const match = url.match(/\/cases\/([0-9a-fA-F-]{36})/);
	return match ? match[1] : null;
}

export function extractSubroleIdFromUrl(url: string): string | null {
	const match = url.match(/\/subroles\/([0-9a-fA-F-]{36})/);
	return match ? match[1] : null;
}

export const hasAccess = (
	permissions: Record<string, Record<string, any>>,
	modules: string[],
	permReqs: string[],
): boolean => {
	if (!modules.length || !permReqs.length) return false;
	if (modules.length !== permReqs.length) return false;

	return modules.every((module, index) => {
		const permission = permReqs[index];
		return Boolean(permissions[module]?.[permission]);
	});
};

export const checkFeatureAccess = (permissionCode: string): boolean => {
	const permissions: string[] = getItem(LOCALSTORAGE.allPermissions) ?? [];
	return permissions.includes(permissionCode);
};

export const defaultHomePage = (): string => {
	const permissions: string[] = getItem(LOCALSTORAGE.allPermissions) ?? [];

	// Define route priorities with their permissions and corresponding URLs
	const routePriorities = [
		{ permission: "case:read", url: URL.CASE },
		{ permission: "cro_dashboard:read", url: URL.DASHBOARD },
		{ permission: "businesses:read", url: URL.BUSINESSES },
		{ permission: "customer_user:read", url: URL.USERS },
		{ permission: "roles:read", url: URL.ROLES },
	];

	// Find the first route the user has permission for
	const defaultRoute = routePriorities.find((route) =>
		permissions.includes(route.permission),
	);

	return defaultRoute?.url ?? URL.CASE;
};

export const getRemoteComponent = async (
	microsite: "case" | "customer" | "dashboard" | "user",
	component: string,
) => {
	const remoteName = remoteAppNames[microsite];
	const baseUrl =
		remoteAppUrls[microsite]?.replace("/assets/remoteEntry.js", "") ?? "";
	try {
		return await loadRemoteModule(
			{
				remoteName,
				baseUrl,
			},
			`./${component}`,
		);
	} catch (error) {
		const message = envConfig.DEV
			? `Failed to load remote component: ${microsite} - ${component} at url ${baseUrl}. Is the remote component container running?`
			: `Failed to load remote component.`;
		console.error(message, microsite, component, error);
		return {
			default: () => message,
		};
	}
};
