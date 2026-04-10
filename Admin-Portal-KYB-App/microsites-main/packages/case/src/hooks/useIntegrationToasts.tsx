import { useCallback, useEffect, useState } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { useCustomToast } from "@/hooks/useCustomToast";
import { getItem, setItem } from "@/lib/localStorage";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { type Case } from "@/types/case";
import useCaseEditPermission from "./useCaseEditPermission";
import { usePreviousValue } from "./usePreviousValue";
import {
	INTEGRATION_STATUS,
	type IntegrationStatus,
} from "./useReRunIntegrationsForEditedFacts";

import { FEATURE_FLAGS, LOCALSTORAGE } from "@/constants";

export const INTEGRATION_TOASTS = {
	RERUN: "rerun",
	RUNNING: "running",
	COMPLETE: "complete",
} as const;

export type ActiveToast =
	| (typeof INTEGRATION_TOASTS)[keyof typeof INTEGRATION_TOASTS]
	| null;

/**
 * Pure logic hook — computes which integration toast should be visible and
 * returns handlers. All rendering is delegated to <IntegrationToasts />.
 *
 * Visibility rules (only one toast visible at a time):
 * 1. PAT_961 off → none.
 * 2. Rerun toast takes precedence over status toasts.
 * 3. Running status takes precedence over complete status.
 *
 * Rerun hidden if: no permission, no edits, case-editing flag off, rerun in flight, or dismissed.
 * Status hidden if: rerun toast visible, or dismissed.
 */
export const useIntegrationToasts = (
	caseData: Pick<Case, "id"> | undefined,
	integrationStatus: IntegrationStatus,
	rerunIntegrationsForEditedFacts: () => Promise<void>,
): {
	activeToast: ActiveToast;
	handleReRun: () => Promise<void>;
	handleDismissRerun: () => void;
	handleDismissStatus: () => void;
} => {
	const caseId = caseData?.id;

	const { errorToast } = useCustomToast();
	const { hasEdits, editedFacts } = useInlineEditStore(caseId ?? "");
	const canRerunIntegrations = useCaseEditPermission();

	const [dismissedToastIds, setDismissedToastIds] = useState<string[]>(() => {
		const stored = getItem(LOCALSTORAGE.dismissedIntegrationToasts);
		return Array.isArray(stored) ? stored : [];
	});

	const isPersistentToastDismissed = (toastId: string): boolean =>
		dismissedToastIds.includes(toastId);

	const dismissToast = useCallback((toastId: string) => {
		setDismissedToastIds((prev) => {
			if (prev.includes(toastId)) return prev;
			const next = [...prev, toastId];
			setItem(LOCALSTORAGE.dismissedIntegrationToasts, next);
			return next;
		});
	}, []);

	const undismissToast = useCallback((toastId: string) => {
		setDismissedToastIds((prev) => {
			const next = prev.filter((id) => id !== toastId);
			setItem(LOCALSTORAGE.dismissedIntegrationToasts, next);
			return next;
		});
	}, []);

	const flags = useFlags();
	const isIntegrationsRunningFlagEnabled: boolean =
		flags[FEATURE_FLAGS.PAT_961_DISPLAY_INTEGRATIONS_RUNNING] ?? false;

	const rerunToastId = `rerun-integrations-${caseId ?? ""}`;
	const statusToastId = `integration-status-${caseId ?? ""}`;
	const previousEditedFacts = usePreviousValue(editedFacts);

	const handleReRun = useCallback(async () => {
		try {
			await rerunIntegrationsForEditedFacts();
		} catch (error) {
			errorToast(error);
		}
	}, [rerunIntegrationsForEditedFacts, errorToast]);

	const handleDismissRerun = useCallback(() => {
		dismissToast(rerunToastId);
	}, [dismissToast, rerunToastId]);

	const handleDismissStatus = useCallback(() => {
		dismissToast(statusToastId);
	}, [dismissToast, statusToastId]);

	/** Undismiss toasts when integrations complete (editedFacts cleared by rerun finishing) */
	useEffect(() => {
		if (
			previousEditedFacts &&
			previousEditedFacts.length > 0 &&
			editedFacts.length === 0
		) {
			undismissToast(rerunToastId);
			undismissToast(statusToastId);
		}
	}, [
		editedFacts,
		previousEditedFacts,
		rerunToastId,
		statusToastId,
		undismissToast,
	]);

	/** Only enable the toasts if the feature flag is enabled and the case has been loaded */
	const isEnabled = isIntegrationsRunningFlagEnabled && !!caseId;

	/** Check if the user has edits, has permission to rerun integrations, and the rerun toast has not been dismissed. */
	const canShowRerunToast =
		/** Check if the user has permission to rerun integrations. */
		canRerunIntegrations &&
		/** Check if the user has edits. */
		hasEdits &&
		/** Check if a rerun request is currently in flight to prevent the user from making simultaneous rerun requests. */
		integrationStatus !== INTEGRATION_STATUS.TRIGGERING &&
		/** Check if the rerun toast has not been dismissed. */
		!isPersistentToastDismissed(rerunToastId);

	/** Check if integrations have been started or are currently running async on the backend. */
	const isIntegrationInProgress =
		integrationStatus === INTEGRATION_STATUS.RUNNING ||
		integrationStatus === INTEGRATION_STATUS.TRIGGERING;

	/** Check if integrations have been completed and the "Integrations Complete" toast has not been dismissed. */
	const isCompleteAndNotDismissed =
		integrationStatus === INTEGRATION_STATUS.COMPLETE &&
		!isPersistentToastDismissed(statusToastId);

	/** Priority: rerun > running > complete */

	// prettier-ignore
	const activeToast: ActiveToast =
		/** If the feature flag is disabled or the case has not been loaded, don't show any toasts */
		!isEnabled         	 		? null
		/** If there are edits, show the rerun toast. Even if integrations are currently running, the user can still rerun them. */
		: canShowRerunToast  		? INTEGRATION_TOASTS.RERUN
		/** If integrations are currently running, show the running toast. */
		: isIntegrationInProgress   ? INTEGRATION_TOASTS.RUNNING
		/** If integrations have been completed and the "Integrations Complete" toast has not been previously dismissed, show the complete toast. */
		: isCompleteAndNotDismissed ? INTEGRATION_TOASTS.COMPLETE
		: null;

	return {
		activeToast,
		handleReRun,
		handleDismissRerun,
		handleDismissStatus,
	};
};
