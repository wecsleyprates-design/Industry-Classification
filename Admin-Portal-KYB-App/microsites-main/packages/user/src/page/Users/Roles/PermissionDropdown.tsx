import React, { useMemo } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
	getPermissionLabel,
	navigateToTriggerPermission,
} from "@/lib/permissionNavigation";
import usePermissionStore from "@/store/usePermissionStore";

import { PERMISSION_DEPENDENCIES } from "@/constants";
import {
	dependencyMapping,
	getDependentPermissionStrings,
} from "@/constants/Roles";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Tooltip } from "@/ui/tooltip";

interface DropdownProps {
	actions: string[];
	permissionCode?: string | null;
	setTabValue?: (tab: "admin" | "features") => void;
}

const PermissionDropdown: React.FC<DropdownProps> = ({
	actions,
	permissionCode,
	setTabValue,
}) => {
	const permissions = usePermissionStore((state) => state.permissions);
	const setPermissions = usePermissionStore((state) => state.setPermissions);

	const actualCode = permissionCode ?? actions[0];
	const lastIndex = actualCode.lastIndexOf(":");
	const code = actualCode.slice(0, lastIndex);

	const actionMap: Record<string, { label: string; value: string }> = {
		read: { label: "View", value: "read" },
		write: { label: "Edit", value: "write" },
		create: { label: "Create & Delete", value: "create" },
	};

	// Level order: no_access < read (View) < write (Edit) < create (Create & Delete)
	const LEVEL_ORDER: Record<string, number> = {
		no_access: 0,
		read: 1,
		write: 2,
		create: 3,
	};

	const dropdownOptions = [
		{ label: "No Access", value: "no_access" },
		...actions.map((act) => {
			const key = act.slice(lastIndex + 1);
			return actionMap[key] ?? { label: act, value: key };
		}),
	];

	// Find dependency config where this dropdown is a dependee: any of its actions are required by a trigger (e.g. Business dropdown required by Send Invites)
	const dependencyConfig = useMemo(
		() =>
			PERMISSION_DEPENDENCIES.find((dep) =>
				dep.required_permissions.some((rp) =>
					(actions ?? [actualCode]).includes(rp),
				),
			),
		[actualCode, actions],
	);

	const isDependencyActive = useMemo(
		() =>
			dependencyConfig &&
			permissions.includes(dependencyConfig.trigger_permission),
		[dependencyConfig, permissions],
	);

	// Minimum required level for *this* dropdown when dependency is active (e.g. Send Invites → Edit; Assign Cases → View)
	const minRequiredLevel = useMemo(() => {
		if (!dependencyConfig || !isDependencyActive) return null;
		const requiredForThisDropdown =
			dependencyConfig.required_permissions.filter((rp) =>
				actions.includes(rp),
			);
		if (requiredForThisDropdown.length === 0) return null;
		const levels = requiredForThisDropdown.map((rp) => rp.split(":")[1]);
		const minLevel = levels.reduce((a, b) =>
			LEVEL_ORDER[a] <= LEVEL_ORDER[b] ? a : b,
		);
		return minLevel;
	}, [dependencyConfig, isDependencyActive, actions]);

	const currentOption =
		dropdownOptions.find((opt) =>
			permissions.includes(`${code}:${opt.value}`),
		) ?? dropdownOptions[0];

	const handleSelect = (optValue: string) => {
		// When dependency is active, disallow only options below the minimum required level
		if (
			minRequiredLevel != null &&
			LEVEL_ORDER[optValue] < LEVEL_ORDER[minRequiredLevel]
		) {
			return;
		}
		// Atomically replace all required permissions with the selected one
		// by calculating final state and setting it directly to avoid enforceDependencies
		const newPermission =
			optValue !== "no_access"
				? actions.find((act) => act.endsWith(optValue))
				: null;

		// Calculate final permissions: remove all actions for this permission code, add new one
		const finalPermissions = permissions.filter(
			(perm) => !actions.includes(perm),
		); // Remove all old permissions for this code

		if (newPermission) {
			finalPermissions.push(newPermission);

			// Check if this permission is a parent permission in dependencyMapping
			// If so, also add ALL its dependent permissions (both editable and non-editable)
			const dependentPermissions = dependencyMapping[newPermission] ?? [];
			if (dependentPermissions.length > 0) {
				const dependentPermissionStrings =
					getDependentPermissionStrings(dependentPermissions);
				finalPermissions.push(...dependentPermissionStrings);
			}
		} else {
			// When removing (no_access), also remove all dependent permissions
			// Find all permissions that are children of any action we're removing
			const permissionsToRemove: string[] = [];
			actions.forEach((act) => {
				const dependents = dependencyMapping[act] ?? [];
				const dependentPermissionStrings =
					getDependentPermissionStrings(dependents);
				permissionsToRemove.push(...dependentPermissionStrings);
			});

			// Remove dependent permissions from finalPermissions
			permissionsToRemove.forEach((perm) => {
				const index = finalPermissions.indexOf(perm);
				if (index > -1) {
					finalPermissions.splice(index, 1);
				}
			});
		}

		// Set permissions atomically - enforceDependencies will run once on final state
		setPermissions(finalPermissions);
	};

	const handleNavigateToTriggerPermission = () => {
		if (dependencyConfig) {
			navigateToTriggerPermission(actualCode, setTabValue);
		}
	};

	const renderDropdown = (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="relative w-[163px] h-[40px] flex items-center justify-between border border-gray-300 rounded-lg bg-white shadow-sm font-inter font-medium text-[14px] leading-[20px] tracking-[0px] text-gray-900 px-3">
					<span className="truncate">
						<span className="truncate">{currentOption.label}</span>
					</span>
					<ChevronDownIcon className="w-4 h-4 text-gray-500 pointer-events-none" />
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent className="w-[180px] font-inter font-medium text-[14px] leading-[20px] tracking-[0px] text-gray-900">
				{dropdownOptions.map((opt) => {
					// When dependency is active, disable only options below the minimum required level
					const isDisabledByDependency =
						minRequiredLevel != null &&
						LEVEL_ORDER[opt.value] < LEVEL_ORDER[minRequiredLevel];
					return (
						<DropdownMenuItem
							key={opt.value}
							onSelect={() => {
								handleSelect(opt.value);
							}}
							disabled={isDisabledByDependency}
						>
							{opt.label}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	// Get the access level label for the minimum required level (for this dropdown)
	const getRequiredAccessLevel = (): string => {
		const accessLevelMap: Record<string, string> = {
			read: "View",
			write: "Edit",
			create: "Create & Delete",
		};
		return (minRequiredLevel && accessLevelMap[minRequiredLevel]) ?? "View";
	};

	return isDependencyActive ? (
		<Tooltip
			trigger={<span>{renderDropdown}</span>}
			content={
				<div>
					At least <b>{getRequiredAccessLevel()}</b> access is required because{" "}
					<a
						href="#"
						tabIndex={0}
						className="text-blue-600 underline cursor-pointer font-bold hover:text-blue-700"
						onClick={(e) => {
							e.preventDefault();
							handleNavigateToTriggerPermission();
						}}
					>
						{dependencyConfig
							? getPermissionLabel(
									dependencyConfig.trigger_permission,
									dependencyConfig,
								)
							: ""}
					</a>{" "}
					is enabled.
				</div>
			}
		/>
	) : (
		renderDropdown
	);
};

export default PermissionDropdown;
