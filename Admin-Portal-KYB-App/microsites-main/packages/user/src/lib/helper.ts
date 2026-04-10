import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import qs from "qs";
import { type AllPermissions, type Permission } from "@/types/common";
import { type PaginatedApiRequest } from "@/types/PaginatedAPIRequest";
import { type Child, type SubroleConfig } from "@/types/roles";
import { getItem } from "./localStorage";

import { LOCALSTORAGE } from "@/constants";
import { ACCESS, type AccessType, type CodeModule } from "@/constants/Modules";

dayjs.extend(utc);

export const formatDate = (
	date: Date | string,
	format = "MM/DD/YYYY",
	options = { local: true },
): string => {
	const d = options.local ? dayjs : dayjs.utc;
	return d(date).format(format);
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
export const capitalize = (title?: string) => {
	if (!title) return undefined;

	return title
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
};

export const getSearchPayload = <P extends PaginatedApiRequest>(
	searchParams: URLSearchParams,
	defaultSortParam: string = "",
	pagination: boolean = true,
	defaultSortDirection: "ASC" | "DESC" = "DESC",
): P => {
	return {
		page: parseInt(searchParams.get("page") ?? "1"),
		pagination,
		items_per_page: parseInt(searchParams.get("itemsPerPage") ?? "10"),
		sort: qs.parse(
			searchParams.get("sort") ?? { [defaultSortParam]: defaultSortDirection },
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
	} as P;
};

export const getAllPermissions = (
	permissions: unknown,
	module: string[],
): Partial<AllPermissions> => {
	if (!Array.isArray(permissions)) return {};

	const val = (permissions as Permission[]).reduce(
		(acc: Partial<AllPermissions>, item) => {
			const itemCode = item.code.split(":");
			const [itemModule, itemPermission] = itemCode as [CodeModule, AccessType];

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

export const formatPermissionCode = (code: string): string => {
	if (!code) return "";
	return code
		.split(":")[0]
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
};

export const extractPermissionsFromConfig = (
	configs: SubroleConfig[],
	availableOnly = false,
): string[] => {
	const permissions: string[] = [];

	const traverse = (items: Array<SubroleConfig | Child>) => {
		items.forEach((item) => {
			// initial check if node is code permission node
			if (Object.hasOwn(item, "permission_code") && item.permission_code) {
				if (
					item.permissions_id &&
					item.node_type === "toggle" &&
					!availableOnly
				) {
					permissions.push(item.permission_code);
				} else if (item.node_type === "access" && !availableOnly) {
					permissions.push(item.permission_code);
				}
			}
			if (availableOnly) {
				if (item.node_type === "toggle" && item.actions.length > 0) {
					// If only available permissions are needed
					permissions.push(item.actions[0]);
				} else if (item.node_type === "access") {
					permissions.push(item.actions[0]);
				}
			}
			if (item.children && item.children.length > 0 && !!item.is_enabled) {
				traverse(item.children);
			}
		});
	};

	traverse(configs);
	return permissions;
};

export const getCollapsiblePermissions = (node: any, permissions: string[]) => {
	const newPermission = permissions.map((perm) => {
		const last = perm.lastIndexOf(":");
		return perm.slice(0, last);
	});
	const available = extractPermissionsFromConfig(node, true).map((perm) => {
		const last = perm.lastIndexOf(":");
		return perm.slice(0, last);
	});
	const current: string[] = newPermission.filter((perm) => {
		return available.includes(perm);
	});
	return { current, available };
};

export const getBadge = (children: any[], permissions: string[]) => {
	const { current, available } = getCollapsiblePermissions(
		children,
		permissions,
	);

	return `${current.length}/${available.length} Included`;
};

export const getFeatureBadge = (
	nodes: any[],
	toggles: Record<string, boolean>,
): string => {
	let total = 0;
	let active = 0;

	const traverse = (list: any[], parentEnabled: boolean) => {
		for (const node of list) {
			const key = node.code || node.label;

			if (node.node_type === "access" || node.node_type === "toggle") {
				total++;
				const isActive = parentEnabled && toggles[key];
				if (isActive) active++;

				if (node.children?.length) {
					traverse(node.children, isActive);
				}
			} else {
				if (node.children?.length) {
					traverse(node.children, parentEnabled);
				}
			}
		}
	};
	traverse(nodes, true);
	return total > 0 ? `${active}/${total} Included` : "";
};

export const isAdminSubdomain = (url: string) => {
	try {
		const { hostname, pathname, port } = new URL(url);
		// Check for production/staging admin subdomain (e.g., admin.joinworth.com or admin.staging.joinworth.com)
		if (/^admin\.([^.]+\.)?joinworth\.com$/i.test(hostname)) {
			return true;
		}
		// Check for localhost Worth Admin (usually port 5175)
		if (hostname === "localhost" || hostname === "127.0.0.1") {
			return port === "5175" || pathname.includes("/customers");
		}
		return false;
	} catch {
		return false;
	}
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
