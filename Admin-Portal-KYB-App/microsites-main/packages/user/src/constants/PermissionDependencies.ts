export type PermissionDependency = {
	trigger_permission: string; // The permission code that triggers the dependency
	trigger_permission_label?: string; // User-readable name for the trigger permission
	required_permissions: string[]; // The permission that must be present/active
	required_permissions_labels?: Record<string, string>; // User-readable names for required permissions (key: permission code, value: label)
	required_permissions_code?: string; // The code of the required permission
};

export const PERMISSION_DEPENDENCIES: PermissionDependency[] = [
	{
		trigger_permission: "case:write:assignment",
		trigger_permission_label: "Assign Cases",
		required_permissions: [
			"customer_user:read",
			"customer_user:write",
			"customer_user:create",
		],
		required_permissions_labels: {
			"customer_user:read": "Users View",
			"customer_user:write": "Users Edit",
			"customer_user:create": "Users Create & Delete",
		},
		required_permissions_code: "permission-users",
	},
	{
		trigger_permission: "businesses:create:invite",
		trigger_permission_label: "Send Invites",
		required_permissions: ["businesses:write", "businesses:create"],
		required_permissions_labels: {
			"businesses:write": "Business Edit",
			"businesses:create": "Business Create",
		},
		required_permissions_code: "permission-businesses",
	},
];
