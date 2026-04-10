import { useFlags } from "launchdarkly-react-client-sdk";
import { getItem } from "@/lib/localStorage";
import { useAppContextStore } from "@/store/useAppContextStore";

import { LOCALSTORAGE } from "@/constants";

/**
 * Hook to check if the current user has a given permission code.
 * Reads from the nearest PermissionProvider — flags and localStorage
 * are resolved once at the provider level, not per call.
 * @param {string} permissionCode - The permission code to check (e.g., "case:read")
 * @returns {boolean} - Returns true if the user has the permission, otherwise false
 */
export const usePermission = (permissionCode: string): boolean => {
	const { platformType } = useAppContextStore();
	const flags = useFlags();

	// Admin users always have access
	if (platformType === "admin") return true;

	// If feature flag is disabled, skip permission check and allow access
	if (!flags.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE) return true;

	// If feature flag is enabled, check permissions from localStorage
	const permissions: string[] = getItem(LOCALSTORAGE.allPermissions) ?? [];
	return permissions.includes(permissionCode);
};
