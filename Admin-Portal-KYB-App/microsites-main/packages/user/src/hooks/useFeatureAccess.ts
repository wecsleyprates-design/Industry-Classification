import { useFlags } from "launchdarkly-react-client-sdk";
import { isAdminSubdomain } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";

import { LOCALSTORAGE } from "@/constants";

/**
 * Hook to check if user has access to a feature based on permission code with feature flag control
 * @param {string} permissionCode - The permission code to check (e.g., "case:read")
 * @returns {boolean} - Returns true if the user has access, otherwise false
 */
export const useFeatureAccess = (permissionCode: string): boolean => {
	const flags = useFlags();

	// Admin users always have access
	if (isAdminSubdomain(window.location.href)) return true;

	// If feature flag is disabled, skip permission check and allow access
	if (!flags.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE) return true;

	// If feature flag is enabled, check permissions from localStorage
	const permissions: string[] = getItem(LOCALSTORAGE.allPermissions) ?? [];
	return permissions.includes(permissionCode);
};
