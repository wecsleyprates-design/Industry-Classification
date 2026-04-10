export interface DependentPermission {
	permission: string;
	editable?: boolean; // If true, the dependent permission can be independently toggled
	// (e.g., turned off) by the user even while the parent permission remains enabled. Defaults to false.
}

export const dependencyMapping: Record<
	string,
	Array<string | DependentPermission>
> = {
	"case:read": [
		{ permission: "case:read:pii_data", editable: false },
		{ permission: "case:write:status", editable: true },
		{ permission: "case:write:comments", editable: false },
		{ permission: "case:write:additional_info", editable: false },
	],
};

/**
 * Normalizes a dependency mapping entry to an array of DependentPermission objects
 * Handles both string (backward compatibility) and object formats
 */
export const normalizeDependentPermissions = (
	deps: Array<string | DependentPermission>,
): DependentPermission[] => {
	return deps.map((dep) =>
		typeof dep === "string" ? { permission: dep, editable: false } : dep,
	);
};

/**
 * Gets the list of permission strings from a dependency mapping entry
 */
export const getDependentPermissionStrings = (
	deps: Array<string | DependentPermission>,
): string[] => {
	return normalizeDependentPermissions(deps).map((dep) => dep.permission);
};

/**
 * Checks if a permission should be editable based on the dependency mapping
 * Returns true if the permission is editable, false otherwise
 */
export const isDependentPermissionEditable = (
	parentPermission: string,
	childPermission: string,
): boolean => {
	const deps = dependencyMapping[parentPermission];
	if (!deps) return false;

	const normalized = normalizeDependentPermissions(deps);
	const dep = normalized.find((d) => d.permission === childPermission);
	return dep?.editable ?? false;
};

/**
 * Checks if a permission is a dependent (child) permission in the dependency mapping
 */
export const isDependentPermission = (permission: string): boolean => {
	return Object.values(dependencyMapping).some((deps) =>
		getDependentPermissionStrings(deps).includes(permission),
	);
};
