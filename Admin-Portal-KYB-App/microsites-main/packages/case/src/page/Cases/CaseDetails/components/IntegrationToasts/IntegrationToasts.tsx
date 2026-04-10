import React, { useEffect, useState } from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { type IntegrationStatus } from "@/hooks";
import {
	type ActiveToast,
	INTEGRATION_TOASTS,
	useIntegrationToasts,
} from "@/hooks/useIntegrationToasts";
import { type Case } from "@/types/case";
import { AnimatedEntry, ANIMATION_DURATION_MS } from "./AnimatedEntry";
import { IntegrationToast } from "./IntegrationToast";

export const IntegrationToasts: React.FC<{
	caseData: Pick<Case, "id"> | undefined;
	integrationStatus: IntegrationStatus;
	runIntegrationsForEditedFacts: () => Promise<void>;
}> = ({ caseData, integrationStatus, runIntegrationsForEditedFacts }) => {
	const {
		activeToast,
		handleReRun,
		handleDismissRerun,
		handleDismissStatus,
	} = useIntegrationToasts(
		caseData,
		integrationStatus,
		runIntegrationsForEditedFacts,
	);

	/**
	 * Lags one transition behind `activeToast` so that when switching between
	 * toasts, the current one fully exits before the next one enters.
	 */
	const [displayedToast, setDisplayedToast] =
		useState<ActiveToast>(activeToast);

	useEffect(() => {
		if (activeToast === displayedToast) return;

		if (displayedToast !== null) {
			/** Something is visible: dismiss it first, then show the next after exit completes */
			setDisplayedToast(null);
			const t = setTimeout(() => {
				setDisplayedToast(activeToast);
			}, ANIMATION_DURATION_MS);
			return () => {
				clearTimeout(t);
			};
		} else {
			/** Nothing visible: show immediately */
			setDisplayedToast(activeToast);
		}
	}, [activeToast]);

	return (
		<div
			// For consistency, use the same attributes as the sonner toaster for positioning
			data-sonner-toaster
			data-x-position="right"
			data-y-position="bottom"
			className="fixed z-50 flex flex-col gap-3 items-end"
		>
			<AnimatedEntry
				visible={displayedToast === INTEGRATION_TOASTS.COMPLETE}
			>
				<IntegrationToast
					icon={
						<CheckCircleIcon className="h-5 w-5 text-green-600" />
					}
					title={
						<h3 className="text-green-600 font-medium text-sm">
							Integration processing is now complete
						</h3>
					}
					subtitle={
						<p className="text-gray-500">
							All data sources have been pulled successfully.
						</p>
					}
					dismissible
					onDismiss={handleDismissStatus}
				/>
			</AnimatedEntry>
			<AnimatedEntry
				visible={displayedToast === INTEGRATION_TOASTS.RUNNING}
			>
				<IntegrationToast
					icon={<ArrowPathIcon className="h-5 w-5 text-yellow-600" />}
					title={
						<h3 className="text-yellow-600 font-medium text-sm">
							Integrations are currently processing.
						</h3>
					}
					subtitle={
						<p className="text-gray-500">
							Data on this case is still populating. Please wait
							until this process is done before reviewing this
							case.
						</p>
					}
				/>
			</AnimatedEntry>
			<AnimatedEntry
				visible={displayedToast === INTEGRATION_TOASTS.RERUN}
			>
				<IntegrationToast
					title={
						<h3 className="font-medium text-sm">
							Ready to Re-Run Integrations
						</h3>
					}
					subtitle={
						<p className="text-gray-500">
							Recent edits on this case may impact the overall
							accuracy. Click Re-Run to update fields and refresh
							the case.
						</p>
					}
					actions={[
						{
							label: "Re-Run",
							onClick: () => {
								void handleReRun();
							},
						},
						{
							label: "Not Now",
							onClick: handleDismissRerun,
						},
					]}
				/>
			</AnimatedEntry>
		</div>
	);
};
