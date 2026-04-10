import { useMemo } from "react";
import { getItem } from "@/lib/localStorage";
import { useAppContextStore } from "@/store/useAppContextStore";
import type { User } from "@/types/User";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { PLATFORM } from "@/constants/Platform";
import { SUBROLES } from "@/constants/Roles";

/**
 * Subrole data structure from localStorage.
 * Uses Pick from User type to maintain consistency and avoid duplication.
 */
type SubroleData = Pick<User["subrole"], "id" | "code" | "label">;

/**
 * Return type for useWorkflowPermissions hook
 */
interface WorkflowPermissions {
	canRead: boolean;
	canWrite: boolean;
	isReadOnly: boolean;
	isOwner: boolean;
	isWorthAdmin: boolean;
}

/**
 * Hook to check workflow permissions based on user subrole and platform.
 *
 * During beta, only Worth Admins have write access. Customer users (regardless of subrole)
 * have read-only access to view configurations and download reports.
 *
 * Permissions:
 * - WORTH ADMIN (platformType="admin"): Full access (READ + WRITE)
 * - CUSTOMER OWNER (subrole="owner"): READ only (beta restriction)
 * - CUSTOMER CRO (subrole="cro"): READ only (beta restriction)
 * - CUSTOMER RISK_ANALYST (subrole="risk_analyst"): READ only
 * - APPLICANT: No access (blocked)
 */
export const useWorkflowPermissions = (): WorkflowPermissions => {
	const platformType = useAppContextStore((state) => state.platformType);
	const subrole = getItem<SubroleData>(LOCALSTORAGE.subrole);

	return useMemo(() => {
		const isWorthAdmin = platformType === PLATFORM.admin;

		if (isWorthAdmin) {
			return {
				canRead: true,
				canWrite: true,
				isReadOnly: false,
				isOwner: false,
				isWorthAdmin: true,
			};
		}

		if (!subrole) {
			return {
				canRead: false,
				canWrite: false,
				isReadOnly: true,
				isOwner: false,
				isWorthAdmin: false,
			};
		}

		const subroleCode = subrole.code?.toLowerCase();
		const isOwner = subroleCode === SUBROLES.OWNER.toLowerCase();
		const isCRO = subroleCode === SUBROLES.CRO.toLowerCase();
		const isRiskAnalyst = subroleCode === SUBROLES.RISK_ANALYST.toLowerCase();
		const canReadWorkflow = isOwner || isCRO || isRiskAnalyst;

		return {
			canRead: canReadWorkflow,
			canWrite: false,
			isReadOnly: true,
			isOwner,
			isWorthAdmin: false,
		};
	}, [platformType, subrole]);
};
