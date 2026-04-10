import { create } from "zustand";
import { logger } from "./logger";

import { PERMISSION_DEPENDENCIES } from "@/constants";

/**
 * Centralized dependency enforcement function.
 * Ensures permission dependencies are maintained:
 * - If a trigger permission is present, at least one required permission must be present
 *   (auto-adds the first required permission if none are present)
 * - If all required permissions are removed, the trigger permission is also removed
 * - If a trigger permission is removed, no action is taken on required permissions
 */
export function enforceDependencies(permissions: string[]) {
	const result = [...permissions];

	PERMISSION_DEPENDENCIES.forEach((dep) => {
		const hasTrigger = result.includes(dep.trigger_permission);
		const hasAnyRequired = dep.required_permissions.some((rp) =>
			result.includes(rp),
		);

		if (hasTrigger) {
			// If trigger is present, ensure at least one required permission is present
			if (!hasAnyRequired && dep.required_permissions.length > 0) {
				result.push(dep.required_permissions[0]);
			}
		} else if (hasAnyRequired) {
			// If trigger is not present but required permissions are, check if we should remove them
			// Actually, we should keep required permissions even if trigger is removed
			// (they might be used independently), so no action needed here
		}

		// If all required permissions are removed, remove the trigger permission
		const allRequiredRemoved = dep.required_permissions.every(
			(rp) => !result.includes(rp),
		);
		if (allRequiredRemoved && hasTrigger) {
			const triggerIndex = result.indexOf(dep.trigger_permission);
			if (triggerIndex > -1) {
				result.splice(triggerIndex, 1);
			}
		}
	});

	return { permissions: result };
}

interface PermissionState {
	permissions: string[];
}

export interface PermissionStore extends PermissionState {
	addPermission: (args: string) => void;
	removePermission: (args: string) => void;
	removePermissions: (args: string[]) => void;
	setPermissions: (args: string[]) => void;
	addPermissions: (args: string[]) => void;
}

const initialState: Pick<PermissionStore, keyof PermissionState> = {
	permissions: [],
};

const usePermissionStore = create<PermissionStore>()(
	logger<PermissionStore>(
		(set, get) => ({
			...initialState,
			addPermission: (permission: string) => {
				const prevPermissions = [...get().permissions, permission];
				const enforced = enforceDependencies(prevPermissions);
				set((state) => ({
					...state,
					permissions: Array.from(new Set(enforced.permissions)),
				}));
			},
			removePermission: (permission: string) => {
				const prevPermissions = get().permissions.filter(
					(p) => p !== permission,
				);
				const enforced = enforceDependencies(prevPermissions);
				set((state) => ({
					...state,
					permissions: Array.from(new Set(enforced.permissions)),
				}));
			},
			removePermissions: (permissionsToRemove: string[]) => {
				const prevPermissions = get().permissions.filter(
					(p) => !permissionsToRemove.includes(p),
				);
				const enforced = enforceDependencies(prevPermissions);
				set((state) => ({
					...state,
					permissions: Array.from(new Set(enforced.permissions)),
				}));
			},
			setPermissions: (permissions: string[]) => {
				const enforced = enforceDependencies(permissions);
				set(() => ({
					permissions: Array.from(new Set(enforced.permissions)),
				}));
			},
			addPermissions: (permissionsToAdd: string[]) => {
				const prevPermissions = Array.from(
					new Set([...get().permissions, ...permissionsToAdd]),
				);
				const enforced = enforceDependencies(prevPermissions);
				set((state) => ({
					...state,
					permissions: Array.from(new Set(enforced.permissions)),
				}));
			},
		}),
		"permissionStore",
	),
);

export default usePermissionStore;
