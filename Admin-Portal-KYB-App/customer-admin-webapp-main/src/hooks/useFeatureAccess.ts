import { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { getItem } from "@/lib/localStorage";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

/**
 * Custom hook to check if user has access to features based on permission codes
 * @returns {Object} - Object containing checkAccess function and permissions array
 */
export const useFeatureAccess = () => {
	const flags = useFlags();

	const permissions: string[] = useMemo(() => {
		return getItem(LOCALSTORAGE.allPermissions) ?? [];
	}, []);

	/**
	 * Check if user has access to a feature based on permission code
	 * @param {string} permissionCode - The permission code to check (e.g., "case:read")
	 * @returns {boolean} - Returns true if the user has access, otherwise false
	 */
	const checkAccess = (permissionCode: string): boolean => {
		if (!flags[FEATURE_FLAGS.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE]) return true;
		return permissions.includes(permissionCode);
	};

	/**
	 * Check if user has any of the provided permission codes
	 * @param {string[]} permissionCodes - Array of permission codes to check
	 * @returns {boolean} - Returns true if user has any of the permissions
	 */
	const hasAnyAccess = (permissionCodes: string[]): boolean => {
		if (!flags[FEATURE_FLAGS.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE]) return true;
		return permissionCodes.some((code) => permissions.includes(code));
	};

	/**
	 * Check if user has all of the provided permission codes
	 * @param {string[]} permissionCodes - Array of permission codes to check
	 * @returns {boolean} - Returns true if user has all permissions
	 */
	const hasAllAccess = (permissionCodes: string[]): boolean => {
		if (!flags[FEATURE_FLAGS.PAT_779_ENABLE_CUSTOM_ROLES_FEATURE]) return true;
		return permissionCodes.every((code) => permissions.includes(code));
	};

	return {
		checkAccess,
		hasAnyAccess,
		hasAllAccess,
		permissions,
	};
};
