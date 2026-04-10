import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import qs from "qs";
import { type IPermission } from "@/types/auth";
import {
	type IPayload,
	type TAccessType,
	type TAllPermissions,
	type TCodeModule,
} from "@/types/common";
import { type CustomerStatusVariant } from "@/types/customer";
import { ACCESS } from "../constants";

dayjs.extend(utc);

// NOTE: Reverted to date-only formatting to align with existing tests & reviewer comment
export const formatDate = (date: Date | string): string => {
	return new Date(date).toLocaleDateString();
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

export const convertToLocalDate = (
	date: string | number | Date | null,
	format:
		| "MM-DD-YYYY - h:mmA"
		| "MM/DD/YYYY, hh:mm a"
		| "MM-DD-YYYY"
		| "MMM D, YYYY"
		| "MMM’YY"
		| "MMM YY"
		| "YYYY"
		| "MMMM DD, YYYY"
		| "MM/DD/YYYY"
		| "MMM DD, YYYY"
		| "MM/DD/YY"
		| "MMMM",
) => {
	if (!date) return "-";
	return dayjs(date).format(format);
};

export const getSearchPayload = (
	searchParams: URLSearchParams,
	defaultSortParam?: string,
	pagination: boolean = true,
): IPayload => {
	const sortParam = defaultSortParam ?? "data_cases.created_at";
	const payloadObj: IPayload = {
		page: parseInt(searchParams.get("page") ?? "1"),
		pagination,
		items_per_page: parseInt(searchParams.get("itemsPerPage") ?? "10"),
		sort: searchParams.get("sort")
			? qs.parse(searchParams.get("sort") as string)
			: { [sortParam]: "DESC" },
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

export const isValidCustomerStatusVariant = (
	status: string,
): status is CustomerStatusVariant => {
	const validVariants: CustomerStatusVariant[] = [
		"invited",
		"active",
		"invite-expired",
		"inactive",
	];
	return validVariants.includes(status as CustomerStatusVariant);
};

export const getCustomerStatusVariant = (
	statusLabel?: string,
): CustomerStatusVariant => {
	if (!statusLabel) return "invited";
	const normalized = statusLabel.toLowerCase().replace(/[\s_]+/g, "-");
	if (normalized === "expired") return "invite-expired";

	// Validate the normalized value is a valid CustomerStatusVariant
	if (isValidCustomerStatusVariant(normalized)) {
		return normalized;
	}

	// Return default for unrecognized status values
	return "invited";
};

export const getCustomerStatusLabel = (statusLabel?: string): string => {
	const labelMap: Record<CustomerStatusVariant, string> = {
		invited: "Invited",
		active: "Active",
		"invite-expired": "Invite Expired",
		inactive: "Inactive",
	};

	if (!statusLabel) return "Invited";
	const normalized = statusLabel.toLowerCase().replace(/[_ ]/g, "-");
	return labelMap[normalized as CustomerStatusVariant] ?? "Invited";
};

/**
 * Capitalizes string
 * @param str: string
 * @returns Capitalized word
 */
export const capitalize = (str: string) => {
	str = str?.toLowerCase();
	return str?.charAt(0)?.toUpperCase() + str?.slice(1);
};

export const getFlagValue = (flag: any): boolean => {
	if (flag !== null && typeof flag === "object" && "value" in flag) {
		return Boolean(flag.value);
	}
	return Boolean(flag);
};
