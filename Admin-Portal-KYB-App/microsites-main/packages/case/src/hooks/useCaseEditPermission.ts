import { useFlags } from "launchdarkly-react-client-sdk";
import { getItem } from "@/lib/localStorage";
import { isCaseEditAllowed } from "@/lib/permissions/isCaseEditAllowed";
import { useAppContextStore } from "@/store/useAppContextStore";
import type { Subrole } from "@/types/auth";

import { LOCALSTORAGE } from "@/constants";
import FEATURE_FLAGS from "@/constants/FeatureFlags";

/**
 * Hook to check if the current user can edit cases inline.
 *
 * Returns `true` if:
 * - The PAT_874_CM_APP_EDITING feature flag is ON
 * - AND one of the following:
 *   - User is an admin (platformType === "admin")
 *   - User role is 'Admin' or 'Risk Analyst' (allowed by default)
 *   - User has 'Edit Application' permission (for custom roles)
 *
 * @returns `true` if the user can edit cases, `false` otherwise
 *
 * @example
 * ```tsx
 * const canEdit = useCaseEditPermission();
 * <EditableField editingEnabled={canEdit} ... />
 * ```
 */
export const useCaseEditPermission = (): boolean => {
	const { platformType } = useAppContextStore();
	const flags = useFlags();

	const isFeatureFlagEnabled =
		flags[FEATURE_FLAGS.PAT_874_CM_APP_EDITING] ?? false;

	// Admin platform users always have access (bypass feature flag for admin platform)
	if (platformType === "admin") {
		return true;
	}

	// Get user role from subrole in localStorage
	const subrole: Subrole | null = getItem("subrole");
	const userRole = subrole?.label ?? "";

	// Get permissions from localStorage
	const permissions: string[] = getItem(LOCALSTORAGE.allPermissions) ?? [];

	return isCaseEditAllowed({
		userRole,
		userPermissions: permissions,
		isFeatureFlagEnabled,
	});
};

export default useCaseEditPermission;
