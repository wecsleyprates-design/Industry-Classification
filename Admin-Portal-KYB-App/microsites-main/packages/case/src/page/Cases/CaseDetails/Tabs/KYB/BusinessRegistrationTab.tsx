import React, { useEffect, useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { generatePath, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import {
	type IntegrationStatus,
	useCaseEditPermission,
	useShouldHideSosForIntegration,
} from "@/hooks";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import { useAppContextStore } from "@/store/useAppContextStore";
import { useInlineEditStore } from "@/store/useInlineEditStore";
import { useOverrideUsers } from "../../hooks/useOverrideUsers";
import {
	BusinessRegistrationCard,
	BusinessRegistrationSkeleton,
	ShareholderDocumentCard,
	SOSFilingCard,
	SOSFilingsSkeleton,
} from "./components/BusinessRegistrationTab";
import {
	type EnhancedSOSFilingDetail,
	useBusinessRegistrationTabData,
	useBusinessRegistrationTabDetails,
	useBusinessRegistrationTabEditState,
	useBusinessRegistrationTabForm,
	useBusinessRegistrationTabSuggestions,
} from "./hooks/BusinessRegistrationTab";

import { URL } from "@/constants";
import {
	InternalFieldFooter,
	NullState,
} from "@/page/Cases/CaseDetails/components";
import { Card } from "@/ui/card";

export interface BusinessRegistrationTabProps {
	caseId: string;
	/** From case details page: gate SOS visibility while integrations run. */
	integrationStatus?: IntegrationStatus;
	isPending?: boolean;
}

export const BusinessRegistrationTab: React.FC<
	BusinessRegistrationTabProps
> = ({ caseId, integrationStatus, isPending }) => {
	const navigate = useNavigate();
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? "";

	// Check editing permissions
	const canEdit = useCaseEditPermission();

	// Fetch all data and extract original values
	const { data, loadingStates, errors, originalValues, derivedData } =
		useBusinessRegistrationTabData(businessId, caseData);

	// Handle errors from data fetching
	useEffect(() => {
		if (errors.getFactsKybError) {
			toast.error("Error fetching KYB data");
			navigate(generatePath(URL.CASE_DETAILS, { id: caseId }));
		}
	}, [errors.getFactsKybError, navigate, caseId]);

	useEffect(() => {
		if (errors.getFactsBusinessDetailsError) {
			toast.error("Error fetching business details");
		}
	}, [errors.getFactsBusinessDetailsError]);

	const { form, dirtyFieldKeys } = useBusinessRegistrationTabForm({
		originalValues,
		isLoading: loadingStates.kyb,
	});

	const suggestions = useBusinessRegistrationTabSuggestions({
		getFactsKybData: data.getFactsKybData,
		factsBusinessDetails: data.factsBusinessDetails,
	});

	// Manage edit state (save status tracking and fact override handler)
	const { getSaveStatus, handleEditComplete } =
		useBusinessRegistrationTabEditState(caseId, businessId, data);

	const getFactsKybData = data.getFactsKybData;
	const isLoading = loadingStates.kyb;
	const guestOwnerEdits = derivedData.guestOwnerEdits;
	const countryCode = derivedData.countryCode;

	const factsDataSources = useMemo(
		() => [getFactsKybData?.data],
		[getFactsKybData?.data],
	);
	const userNameMap = useOverrideUsers(factsDataSources);

	// Check if any business registration field is currently dirty (being edited)
	const hasDirtyBusinessRegistrationFields = useMemo(() => {
		return dirtyFieldKeys.some(
			(key) => key === "business_name" || key === "tin",
		);
	}, [dirtyFieldKeys]);

	const shouldHideSosForIntegration = useShouldHideSosForIntegration(
		integrationStatus,
		isPending,
	);

	const { editedFacts } = useInlineEditStore(caseId);

	// SoS verification depends on both business name and TIN, so any edit
	// to these fields means the existing SoS findings may be stale.
	const isSosInvalidated = useMemo(() => {
		if (hasDirtyBusinessRegistrationFields) return true;

		if (editedFacts.includes("tin") || editedFacts.includes("legal_name"))
			return true;

		return false;
	}, [hasDirtyBusinessRegistrationFields, editedFacts]);

	// Generate tax details and enhanced SOS filings details
	const { taxDetails, enhancedSosFilingsDetails, shareholderDocument } =
		useBusinessRegistrationTabDetails({
			getFactsKybData,
			countryCode,
			guestOwnerEdits,
			shouldHideSosForIntegration,
			hasDirtyBusinessRegistrationFields,
			userNameMap,
		});

	const hasApplicantFields = taxDetails.some(
		(d) => d.fieldSource?.type === "applicant",
	);
	const hasInternalFields = taxDetails.some(
		(d) => d.fieldSource?.type === "internal",
	);

	return (
		<FormProvider {...form}>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				{isLoading ? (
					<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
						<BusinessRegistrationSkeleton />
						<SOSFilingsSkeleton />
					</div>
				) : (
					<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
						<BusinessRegistrationCard
							loading={isLoading}
							kybFactsData={getFactsKybData?.data}
							taxContentProps={{
								taxDetails,
								canEdit,
								getSaveStatus,
								handleEditComplete,
								suggestions,
								originalValues,
								countryCode,
							}}
						/>
						{shouldHideSosForIntegration ||
						enhancedSosFilingsDetails.length === 0 ? (
							<Card>
								<div className="flex flex-col bg-white rounded-xl">
									<NullState
										title="No Registry Data to Display"
										description={`No Secretary of State filings were found for the associated ${getTaxIdLabel(
											countryCode,
											"long",
										)}`}
									/>
								</div>
							</Card>
						) : (
							enhancedSosFilingsDetails.map(
								(
									enhancedSosFilingDetails: EnhancedSOSFilingDetail,
									index: number,
								) => (
									<SOSFilingCard
										key={index}
										countryCode={countryCode}
										sosFiling={
											enhancedSosFilingDetails.sosFiling
										}
										rows={enhancedSosFilingDetails.rows}
										isInvalidated={isSosInvalidated}
									/>
								),
							)
						)}
						{shareholderDocument && (
							<ShareholderDocumentCard
								document={shareholderDocument}
							/>
						)}
						<InternalFieldFooter
							hasApplicantFields={hasApplicantFields}
							hasInternalFields={hasInternalFields}
						/>
					</div>
				)}

				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		</FormProvider>
	);
};
