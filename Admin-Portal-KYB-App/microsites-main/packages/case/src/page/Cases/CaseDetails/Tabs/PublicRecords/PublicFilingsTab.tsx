import React from "react";
import { FormProvider } from "react-hook-form";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { useCaseEditPermission } from "@/hooks/useCaseEditPermission";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useAppContextStore } from "@/store/useAppContextStore";
import { ComplaintsCard } from "./components/PublicFilingsTab/ComplaintsCard";
import {
	usePublicFilingsFieldRenderer,
	usePublicFilingsTabData,
	usePublicFilingsTabEditState,
	usePublicFilingsTabForm,
	usePublicFilingsTabSuggestions,
} from "./hooks/PublicFilingsTab";

import { DetailsCard } from "@/page/Cases/CaseDetails/components";

export interface PublicFilingsTabProps {
	caseId: string;
}

export const PublicFilingsTab: React.FC<PublicFilingsTabProps> = ({
	caseId,
}) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? "";

	const canEdit = useCaseEditPermission();

	// Fetch all data and extract original values
	const { data, loadingStates, originalValues } = usePublicFilingsTabData(
		businessId,
		caseId,
	);

	// Initialize react-hook-form with data
	const { form } = usePublicFilingsTabForm({
		originalValues,
		isLoading: loadingStates.bjl,
	});

	// Generate all suggestions from BJL alternatives
	const suggestions = usePublicFilingsTabSuggestions(data);

	// Manage edit state (save status tracking and fact override handler)
	const { getSaveStatus, handleEditComplete } = usePublicFilingsTabEditState(
		caseId,
		businessId,
		data,
	);

	// Render fields from configs
	const { judgementsDetails, liensDetails, bankruptciesDetails } =
		usePublicFilingsFieldRenderer({
			originalValues,
			isLoading: loadingStates.bjl,
			canEdit,
			getSaveStatus,
			handleEditComplete,
			suggestions,
			data,
		});

	return (
		<FormProvider {...form}>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					{/* Complaints Section - Read-only, no inline editing */}
					<ComplaintsCard businessId={businessId} caseId={caseId} />

					{/* Judgements Section - Editable */}
					<DetailsCard
						title="Judgments"
						details={judgementsDetails}
					/>

					{/* Liens Section - Editable */}
					<DetailsCard title="Liens" details={liensDetails} />

					{/* Bankruptcies Section - Editable */}
					<DetailsCard
						title="Bankruptcies"
						details={bankruptciesDetails}
					/>
				</div>
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		</FormProvider>
	);
};
