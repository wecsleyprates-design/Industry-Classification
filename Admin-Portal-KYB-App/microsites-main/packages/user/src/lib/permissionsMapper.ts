export const permissionMapping: Record<
	string,
	{
		access: string;
		mainGroup: string;
		description: string;
		type: "Admin" | "Feature";
		label: string;
	}
> = {
	// ---------------- Team Management ----------------
	"customer_user:create": {
		type: "Admin",
		mainGroup: "Team Management",
		description: "User, role, and permission management.",
		label: "Customer user Create",
		access: "Create",
	},
	"customer_user:write": {
		type: "Admin",
		mainGroup: "Team Management",
		description: "User, role, and permission management.",
		label: "Customer user Read Write",
		access: "Write",
	},
	"customer_user:read": {
		type: "Admin",
		mainGroup: "Team Management",
		description: "User, role, and permission management.",
		label: "Customer user Read Only",
		access: "Read",
	},

	// ---------------- Case Management ----------------
	"case:read": {
		type: "Feature",
		mainGroup: "Case Management",
		description: "Manage and view applicant cases.",
		label: "Applicant Case Read Only",
		access: "Read",
	},
	"case:write": {
		type: "Feature",
		mainGroup: "Case Management",
		description: "Manage and view applicant cases.",
		label: "Applicant Case Read Write",
		access: "Write",
	},
	"case:write:assignment": {
		type: "Feature",
		mainGroup: "Case Management",
		description: "Assign cases to different team members or self-assign.",
		label: "Assign Cases",
		access: "Write",
	},

	"businesses:create:invite": {
		type: "Feature",
		mainGroup: "Application Management",
		description: "Create application invites.",
		label: "Send Invites",
		access: "Create",
	},

	"businesses:create:application": {
		type: "Feature",
		mainGroup: "Application Management",
		description: "Start applications.",
		label: "Start Applications",
		access: "Create",
	},

	// ---------------- Profile ----------------
	"profile:read": {
		type: "Feature",
		mainGroup: "Profile",
		description: "Manage and view user profile.",
		label: "Profile Read",
		access: "Read",
	},
	"profile:write": {
		type: "Feature",
		mainGroup: "Profile",
		description: "Manage and view user profile.",
		label: "Profile Write",
		access: "Write",
	},

	// ---------------- Business Management ----------------
	"businesses:read": {
		type: "Admin",
		mainGroup: "Business Management",
		description: "Business related permissions.",
		label: "Businesses Read Only",
		access: "Read",
	},
	"businesses:write": {
		type: "Admin",
		mainGroup: "Business Management",
		description: "Business related permissions.",
		label: "Businesses owner Read Write",
		access: "Write",
	},
	"businesses:create": {
		type: "Admin",
		mainGroup: "Business Management",
		description: "Business related permissions.",
		label: "Businesses owner Create",
		access: "Create",
	},

	// ---------------- Onboarding Module ----------------
	"onboarding_module:read": {
		type: "Feature",
		mainGroup: "Onboarding Module",
		description: "Access to onboarding module.",
		label: "Onboarding Module Read Only",
		access: "Read",
	},
	"onboarding_module:write": {
		type: "Feature",
		mainGroup: "Onboarding Module",
		description: "Access to onboarding module.",
		label: "Onboarding Module Read Write",
		access: "Write",
	},

	// ---------------- Risk Monitoring ----------------
	"risk_monitoring_module:read": {
		type: "Feature",
		mainGroup: "Risk Monitoring",
		description: "Monitor and manage risk alerts.",
		label: "Risk Monitoring Module Read Only",
		access: "Read",
	},
	"risk_monitoring_module:write": {
		type: "Feature",
		mainGroup: "Risk Monitoring",
		description: "Monitor and manage risk alerts.",
		label: "Risk Monitoring Module Read Write",
		access: "Write",
	},

	// ---------------- Dashboards ----------------
	"cro_dashboard:read": {
		type: "Feature",
		mainGroup: "Dashboards",
		description: "Access CRO dashboards.",
		label: "CRO Dashboard Read Only",
		access: "Read",
	},
};

export const formatAccess = (accessList: string[]): string => {
	if (accessList.length <= 1) return accessList.join("");
	return (
		accessList.slice(0, -1).join(", ") +
		" & " +
		accessList[accessList.length - 1]
	);
};

const typeHeadingMap: Record<"Admin" | "Feature", string> = {
	Admin: "Admin Permissions",
	Feature: "Feature Permissions",
};

export const transformRolesData = (apiRolesData: any[]) => {
	return apiRolesData.map((role) => {
		const groupedByType: Record<"Admin" | "Feature", any[]> = {
			Admin: [],
			Feature: [],
		};

		role.permissions.forEach((perm: { code: string }) => {
			const mapping = permissionMapping[perm.code];
			if (mapping) {
				const category = mapping.type;
				groupedByType[category].push({
					code: perm.code,
					label: mapping.label,
					mainGroup: mapping.mainGroup,
					access: mapping.access,
					description: mapping.description,
				});
			}
		});

		// consolidate by mainGroup
		(Object.keys(groupedByType) as Array<"Admin" | "Feature">).forEach(
			(type) => {
				const groupedByMainGroup: Record<string, any> = {};

				groupedByType[type].forEach((perm) => {
					if (!groupedByMainGroup[perm.mainGroup]) {
						groupedByMainGroup[perm.mainGroup] = {
							mainGroup: perm.mainGroup,
							description: perm.description,
							label: perm.label,
							code: perm.code,
							access: new Set<string>(),
						};
					}
					groupedByMainGroup[perm.mainGroup].access.add(perm.access);
				});

				groupedByType[type] = Object.values(groupedByMainGroup).map(
					(g: any) => ({
						...g,
						access: formatAccess(Array.from(g.access)),
					}),
				);
			},
		);

		const permissionsWithHeadings = Object.fromEntries(
			(Object.keys(groupedByType) as Array<"Admin" | "Feature">).map((key) => [
				typeHeadingMap[key],
				groupedByType[key],
			]),
		);

		return {
			...role,
			permissions: permissionsWithHeadings,
		};
	});
};
