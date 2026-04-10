import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFlags } from "launchdarkly-react-client-sdk";
import { toast } from "sonner";
import { getFactsKyc } from "@/services/api/integration.service";
import { useRerunIntegrations } from "@/services/queries/integration.query";
import { useGenerateReport } from "@/services/queries/report.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { type CaseData } from "@/types/case";

import FEATURE_FLAGS from "@/constants/FeatureFlags";

export const INTEGRATION_STATUS = {
	IDLE: "idle",
	TRIGGERING: "triggering",
	RUNNING: "running",
	COMPLETE: "complete",
} as const;

export type IntegrationStatus =
	(typeof INTEGRATION_STATUS)[keyof typeof INTEGRATION_STATUS];

export type UseReRunIntegrationsForEditedFactsResult = Omit<
	ReturnType<typeof useRerunIntegrations>,
	"mutateAsync" | "isPending"
> & {
	integrationStatus: IntegrationStatus;
	runIntegrationsForEditedFacts: () => Promise<void>;
	/** True while the rerun mutation is in flight OR while subsequent queries are being refetched. */
	isPending: boolean;
};

type ReRunCaseContext = Pick<
	CaseData,
	"id" | "business_id" | "customer_id" | "is_integration_complete"
>;

export const useReRunIntegrationsForEditedFacts = (
	caseData: ReRunCaseContext | undefined,
): UseReRunIntegrationsForEditedFactsResult => {
	const caseId = caseData?.id;
	const businessId = caseData?.business_id;

	const queryClient = useQueryClient();
	const flags = useFlags();
	const { moduleType } = useAppContextStore();
	const { mutateAsync: generateReport } = useGenerateReport();
	const {
		mutateAsync: rerunIntegrations,
		isPending: isMutationPending,
		...useMutationResult
	} = useRerunIntegrations();
	const { editedFacts, clearEditedFacts } = useInlineEditStore(caseId ?? "");
	const [isRefetchingAfterRerun, setIsRefetchingAfterRerun] = useState(false);

	const runIntegrationsForEditedFacts = useCallback(async () => {
		if (!businessId) throw new Error("Business ID is required");

		const body = { fact_names: editedFacts };
		await rerunIntegrations({ businessId, body });

		setIsRefetchingAfterRerun(true);
		try {
			// Fetch KYC facts with noCache=true to bypass backend cache
			// Then update the React Query cache with fresh data
			const freshKycData = await getFactsKyc(businessId, true);
			queryClient.setQueryData(["getKycFacts", businessId], freshKycData);

			// Refetch other queries that may have been affected
			await Promise.all([
				queryClient.refetchQueries({
					queryKey: ["getApplicantVerificationDetails"],
				}),
				queryClient.refetchQueries({
					queryKey: ["getFactsKyb", businessId],
				}),
				queryClient.refetchQueries({
					queryKey: ["getFactsBusinessDetails", businessId],
				}),
				queryClient.refetchQueries({
					queryKey: ["getFactsBusinessFinancials", businessId],
				}),
				queryClient.refetchQueries({
					queryKey: ["getCaseById"],
				}),
			]);
		} finally {
			setIsRefetchingAfterRerun(false);
		}

		clearEditedFacts();

		// Best-effort 360 regeneration: must not affect rerun success if this fails.
		const worth360Enabled =
			flags[FEATURE_FLAGS.DOS_48_WORTH_360_REPORT] === true;
		const canRequestCustomerReport =
			!!businessId &&
			!!caseData?.customer_id &&
			moduleType !== "standalone_case";
		const canRequestStandaloneReport =
			!!businessId && moduleType === "standalone_case";

		if (
			worth360Enabled &&
			(canRequestCustomerReport || canRequestStandaloneReport)
		) {
			void (async () => {
				try {
					await generateReport({
						customerId: caseData?.customer_id ?? "",
						businessId,
						caseId,
						moduleType,
					});
				} catch {
					toast.error("Unable to start 360 report regeneration");
					return;
				}
				toast.success("Report regeneration in progress");
				try {
					await queryClient.refetchQueries({
						queryKey: [
							"getBusinessReportStatus",
							businessId,
							caseId,
						],
					});
				} catch {
					toast.error("Error refetching report status");
				}
			})();
		}
	}, [
		caseId,
		businessId,
		caseData?.customer_id,
		editedFacts,
		queryClient,
		clearEditedFacts,
		rerunIntegrations,
		flags,
		moduleType,
		generateReport,
	]);

	const isPending = isMutationPending || isRefetchingAfterRerun;

	const integrationStatus = useMemo(() => {
		/** If the rerun request is in flight or the queries are being refetched, return TRIGGERING. */
		if (isPending) return INTEGRATION_STATUS.TRIGGERING;
		/** If the case data has not yet been loaded, return IDLE. */
		if (caseData?.is_integration_complete == null)
			return INTEGRATION_STATUS.IDLE;
		/** If the integrations are complete, return COMPLETE. */
		if (caseData?.is_integration_complete)
			return INTEGRATION_STATUS.COMPLETE;
		/** Else, if the integrations are still running, return RUNNING. */
		return INTEGRATION_STATUS.RUNNING;
	}, [isPending, caseData?.is_integration_complete]);

	return {
		...useMutationResult,
		integrationStatus,
		isPending,
		runIntegrationsForEditedFacts,
	};
};
