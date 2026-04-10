import FEATURE_FLAGS from "@/constants/FeatureFlags";

/**
 * User role types that are allowed to edit cases
 */
export type UserRole = "Admin" | "Risk Analyst" | "Customer" | string;

/**
 * Permission code that grants edit access
 */
export const EDIT_APPLICATION_PERMISSION = "Edit Application";

/**
 * Parameters for checking if case edit is allowed
 */
export interface CaseEditPermissionParams {
	/** The user's current role */
	userRole: UserRole;
	/** List of permissions the user has */
	userPermissions: string[];
	/** Whether the PAT_874_CM_APP_EDITING feature flag is enabled */
	isFeatureFlagEnabled: boolean;
}

/**
 * Determines if inline editing should be enabled for the current user.
 *
 * Returns `true` only if:
 * - The PAT_874_CM_APP_EDITING feature flag is ON
 * - AND one of the following:
 *   - Role is 'Admin' (allowed by default)
 *   - Role is 'Risk Analyst' (allowed by default)
 *   - User has 'Edit Application' permission (for custom roles)
 *
 * @param params - The parameters to check
 * @returns `true` if the user can edit cases, `false` otherwise
 *
 * @example
 * ```tsx
 * import { useFlags } from 'launchdarkly-react-client-sdk';
 *
 * const flags = useFlags();
 * const canEdit = isCaseEditAllowed({
 *   userRole: 'Admin',
 *   userPermissions: ['View Cases', 'Edit Application'],
 *   isFeatureFlagEnabled: flags.PAT_874_CM_APP_EDITING,
 * });
 * ```
 */
export const isCaseEditAllowed = ({
	userRole,
	userPermissions,
	isFeatureFlagEnabled,
}: CaseEditPermissionParams): boolean => {
	// Feature flag must be enabled
	if (!isFeatureFlagEnabled) {
		return false;
	}

	// Admin and Risk Analyst roles have access by default
	const defaultAllowedRoles: UserRole[] = ["Admin", "Owner", "Risk Analyst"];
	if (defaultAllowedRoles.includes(userRole)) {
		return true;
	}

	// For custom roles, check if user has "Edit Application" permission
	const hasEditPermission = userPermissions.includes(
		EDIT_APPLICATION_PERMISSION,
	);

	return hasEditPermission;
};

/**
 * Feature flag key for case editing
 */
export const CASE_EDIT_FEATURE_FLAG = FEATURE_FLAGS.PAT_874_CM_APP_EDITING;

export default isCaseEditAllowed;
