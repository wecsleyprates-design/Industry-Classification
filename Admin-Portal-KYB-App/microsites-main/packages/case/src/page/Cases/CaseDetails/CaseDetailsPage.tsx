import React, { useState } from "react";
import { useReRunIntegrationsForEditedFacts } from "@/hooks";
import CaseWrapper from "@/layouts/CaseWrapper";
import { useGetBusinessReportStatus } from "@/services/queries/report.query";
import { type CaseData } from "@/types/case";
import { IntegrationToasts } from "./components/IntegrationToasts";
import CaseDetailsHeader from "./CaseDetailsHeader";
import { CaseDetailsTabs } from "./CaseDetailsTabs";
import { useAutoRegenerateReport, useRegenerateReport } from "./hooks";

import { ToastProvider } from "@/providers/ToastProvider";

export const CaseDetailsPage: React.FC<{
	backNavigateTo?: string;
	caseData?: CaseData;
	isLoading?: boolean;
	refetchCaseDetails: () => void;
}> = ({ backNavigateTo, caseData, isLoading, refetchCaseDetails }) => {
	// Auto-regenerate 360 report when URL has ?regenerateReport=1
	const [isRegenerating, setIsRegenerating] = useState(false);
	const { regenerateReport } = useRegenerateReport(caseData);
	const { data: businessReportStatusData } = useGetBusinessReportStatus({
		businessId: caseData?.business_id ?? "",
		caseId: caseData?.id,
	});
	const reportStatus = businessReportStatusData?.data?.status;

	useAutoRegenerateReport({
		businessId: caseData?.business_id ?? "",
		caseId: caseData?.id ?? "",
		customerId: caseData?.customer_id ?? "",
		generateReport: regenerateReport,
		isRegenerating,
		setIsRegenerating,
		reportStatus,
	});

	const { runIntegrationsForEditedFacts, integrationStatus, isPending } =
		useReRunIntegrationsForEditedFacts(caseData);

	return (
		<CaseWrapper>
			<ToastProvider />
			<div className="flex flex-col case">
				<CaseDetailsHeader
					backNavigateTo={backNavigateTo}
					caseData={caseData}
					isCaseDataLoading={isLoading}
					refetchCaseDetails={refetchCaseDetails}
					runIntegrationsForEditedFacts={
						runIntegrationsForEditedFacts
					}
					integrationStatus={integrationStatus}
				/>
				<CaseDetailsTabs
					caseData={caseData}
					sosIntegration={{ integrationStatus, isPending }}
				/>
				<IntegrationToasts
					caseData={caseData}
					integrationStatus={integrationStatus}
					runIntegrationsForEditedFacts={
						runIntegrationsForEditedFacts
					}
				/>
			</div>
		</CaseWrapper>
	);
};
