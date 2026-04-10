import React, { useEffect, useMemo } from "react";
import {
	getPermissionLabel,
	navigateToRequiredPermission,
} from "@/lib/permissionNavigation";
import usePermissionStore from "@/store/usePermissionStore";
import { type Child } from "@/types/roles";

import { PERMISSION_DEPENDENCIES } from "@/constants";
import {
	dependencyMapping,
	getDependentPermissionStrings,
	isDependentPermission,
	isDependentPermissionEditable,
	normalizeDependentPermissions,
} from "@/constants/Roles";
import Toggle from "@/ui/Toggle";
import { Tooltip } from "@/ui/tooltip";

const getChildPermissions = (children: Child[]) => {
	if (!children) return [];
	const permissions: string[] = [];
	const traverse = (items: Child[]) => {
		items.forEach((item) => {
			if (item.node_type === "toggle" && item.actions.length > 0) {
				permissions.push(item.actions[0]);
			}
			if (item.children && item.children.length > 0) {
				traverse(item.children);
			}
		});
	};
	traverse(children);
	return permissions;
};

interface ToggleProps {
	actions: string[];
	permissionCode?: string | null;
	expanded?: boolean;
	setExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
	childs?: Child[];
	setTabValue?: (tab: "admin" | "features") => void;
}

const PermissionToggle: React.FC<ToggleProps> = ({
	permissionCode,
	setExpanded,
	expanded,
	actions,
	childs,
	setTabValue,
}) => {
	const permissions = usePermissionStore((state) => state.permissions);
	const addPermission = usePermissionStore((state) => state.addPermission);
	const removePermissions = usePermissionStore(
		(state) => state.removePermissions,
	);
	const addPermissions = usePermissionStore((state) => state.addPermissions);

	const isChecked = permissions.includes(actions[0]);
	const childPermissions = getChildPermissions(childs ?? []);

	// Find if this permission is a trigger_permission in any dependency
	const currentPermissionCode = permissionCode ?? actions[0];
	// Match by current code first, then by any action in the row (e.g. API may pass different permission_code for Send Invites)
	const dependencyConfig =
		PERMISSION_DEPENDENCIES.find(
			(dep) => dep.trigger_permission === currentPermissionCode,
		) ??
		PERMISSION_DEPENDENCIES.find((dep) =>
			(actions ?? []).includes(dep.trigger_permission),
		);

	// Check if any of the required permissions are present (exact match)
	const isRequiredAccessPresent = dependencyConfig
		? permissions.some((perm) =>
				dependencyConfig.required_permissions.includes(perm),
			)
		: true; // If no dependency, allow toggle

	const isDisabledByDependency = !!dependencyConfig && !isRequiredAccessPresent;

	// Check if this permission is a child permission in dependencyMapping
	// Child permissions are automatically included when parent is selected
	const isChildPermission = isDependentPermission(actions[0] ?? "");

	// Memoize finding the parent permission to avoid recalculating on every render
	const parentPermission = useMemo(() => {
		const currentAction = actions[0] ?? "";
		for (const [parent, deps] of Object.entries(dependencyMapping)) {
			const depStrings = getDependentPermissionStrings(deps);
			if (depStrings.includes(currentAction)) {
				return parent;
			}
		}
		return null;
	}, [actions[0]]);

	const isEditableChild =
		parentPermission &&
		isDependentPermissionEditable(parentPermission, actions[0] ?? "");

	// Child permissions should be disabled only if they are not editable
	const isDisabledAsChild = isChildPermission && !isEditableChild;

	const handleNavigateToRequiredPermission = () => {
		if (dependencyConfig) {
			navigateToRequiredPermission(currentPermissionCode, setTabValue);
		}
	};

	useEffect(() => {
		if (typeof isChecked === "boolean") {
			setExpanded?.(isChecked);
		}
	}, [isChecked, setExpanded]);

	// Memoize dependent permissions calculation to avoid recalculating on every render
	const dependentPermissionStrings = useMemo(() => {
		const dependentPermissions = dependencyMapping[actions[0] ?? ""] ?? [];
		return getDependentPermissionStrings(dependentPermissions);
	}, [actions[0]]);

	// Memoize normalized dependents to avoid recalculating on every render
	const normalizedDependents = useMemo(() => {
		const dependentPermissions = dependencyMapping[actions[0] ?? ""] ?? [];
		return normalizeDependentPermissions(dependentPermissions);
	}, [actions[0]]);

	const toggleComponent = (
		<Toggle
			value={isChecked}
			disabled={isDisabledByDependency || isDisabledAsChild}
			onChange={() => {
				if (isChecked) {
					// When turning off, remove the permission and all its dependent permissions
					removePermissions([
						...childPermissions,
						...dependentPermissionStrings,
						actions[0] ? actions[0] : "",
					]);
				} else {
					// When turning on, add the permission and ALL its dependent permissions
					// (both editable and non-editable) to ensure all related permissions are enabled
					const dependentsToAdd = normalizedDependents.map(
						(dep) => dep.permission,
					);

					if (dependentsToAdd.length > 0) {
						addPermissions([actions[0], ...dependentsToAdd]);
					} else {
						addPermission(actions[0]);
					}
				}
			}}
		/>
	);

	// Get the first required permission label for display
	const getDisplayPermissionLabel = (): string => {
		if (!dependencyConfig) return "";

		// Get the first required permission code
		const firstRequiredPerm = dependencyConfig.required_permissions[0];
		if (!firstRequiredPerm) return "";

		// Get the label from required_permissions_labels if available
		if (dependencyConfig.required_permissions_labels?.[firstRequiredPerm]) {
			return dependencyConfig.required_permissions_labels[firstRequiredPerm];
		}

		// Fallback to getPermissionLabel utility
		return getPermissionLabel(firstRequiredPerm, dependencyConfig);
	};

	const displayPermissionLabel = getDisplayPermissionLabel();

	const triggerPermissionLabel = dependencyConfig
		? getPermissionLabel(currentPermissionCode, dependencyConfig)
		: currentPermissionCode;

	return isDisabledByDependency ? (
		<Tooltip
			trigger={<span>{toggleComponent}</span>}
			content={
				<div>
					You need{" "}
					<a
						href="#"
						tabIndex={0}
						className="text-blue-600 underline cursor-pointer font-bold hover:text-blue-700"
						onClick={(e) => {
							e.preventDefault();
							handleNavigateToRequiredPermission();
						}}
					>
						{displayPermissionLabel}
					</a>{" "}
					access or higher to toggle <b>{triggerPermissionLabel}</b> permission.
				</div>
			}
		/>
	) : (
		toggleComponent
	);
};

export default PermissionToggle;
