import React, { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { useCaseEditPermission } from "@/hooks/useCaseEditPermission";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useAppContextStore } from "@/store/useAppContextStore";
import { InternalFieldFooter } from "../../components";
import { DetailsCard } from "../../components/DetailsCard";
import { useOverrideUsers } from "../../hooks/useOverrideUsers";
import {
	useBackgroundTabData,
	useBackgroundTabEditState,
	useBackgroundTabForm,
	useBackgroundTabSuggestions,
	useDoctorsDetails,
	useFieldRenderer,
	useNpiDetails,
} from "./hooks/BackgroundTab";
import { DoctorsResult } from "./DoctorsResult";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { BusinessLocationGoogleMap } from "@/ui/business-location-google-map";
import { Card } from "@/ui/card";

export interface BackgroundTabProps {
	caseId: string;
}

export const BackgroundTab: React.FC<BackgroundTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	const canEdit = useCaseEditPermission();

	const {
		data,
		loadingStates,
		originalValues,
		derivedData,
		countryCode,
		phoneNumber,
		npiNumber,
	} = useBackgroundTabData(businessId, caseData);

	const factsDataSources = useMemo(
		() => [
			data.factsBusinessDetails?.data,
			data.getFactsKybData?.data,
			data.getFactsFinancialsData?.data,
		],
		[
			data.factsBusinessDetails?.data,
			data.getFactsKybData?.data,
			data.getFactsFinancialsData?.data,
		],
	);
	const userNameMap = useOverrideUsers(factsDataSources);

	const { form, isFieldDirty, getOriginalValue } = useBackgroundTabForm({
		originalValues,
		isLoading: loadingStates.businessDetails || loadingStates.kyb,
	});

	const suggestions = useBackgroundTabSuggestions(data);

	// Manage edit state (save status tracking and fact override handler)
	const { getSaveStatus, handleEditComplete, clearedChildFields } =
		useBackgroundTabEditState(caseId, businessId, data);

	const { businessDetails, industryDetails } = useFieldRenderer({
		originalValues,
		loadingStates,
		canEdit,
		getSaveStatus,
		handleEditComplete,
		suggestions,
		guestOwnerEdits: derivedData.guestOwnerEdits,
		data,
		countryCode,
		phoneNumber,
		isFieldDirty,
		getOriginalValue,
		clearedChildFields,
		userNameMap,
	});

	const { npiDetails, formattedNpiDetails } = useNpiDetails({
		npiData: data.npiDetails,
		factsNpiNumber: npiNumber,
		isLoading: loadingStates.npi && loadingStates.kyb,
		isNPIEnabled: derivedData.isNPIEnabled,
		canEdit,
		getSaveStatus,
		handleEditComplete,
		clearedChildFields,
	});

	const { doctorsList, showExistingNpi, showDoctorsResult } =
		useDoctorsDetails({
			businessId,
			isNPIEnabled: derivedData.isNPIEnabled,
			hasFormattedNpiDetails: Boolean(formattedNpiDetails),
		});

	const allDetails = [...businessDetails, ...industryDetails];
	const hasApplicantFields = allDetails.some(
		(d) => d.fieldSource?.type === "applicant",
	);
	const hasInternalFields = allDetails.some(
		(d) => d.fieldSource?.type === "internal",
	);
	const showFieldSourceLegend =
		hasApplicantFields ||
		hasInternalFields ||
		(derivedData.isNPIEnabled &&
			!!npiDetails?.data?.guest_owner_edits?.length);

	return (
		<FormProvider {...form}>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					{(loadingStates.address || derivedData.location) && (
						<Card>
							<BusinessLocationGoogleMap
								location={derivedData.location}
								isLoadingAddress={loadingStates.address}
							/>
						</Card>
					)}
					<DetailsCard
						title="Business Details"
						details={businessDetails}
					/>
					<DetailsCard title="Industry" details={industryDetails} />
					{showExistingNpi && formattedNpiDetails && (
						<DetailsCard
							title="NPI"
							details={formattedNpiDetails}
						/>
					)}
					{showDoctorsResult && (
						<DoctorsResult
							caseId={caseId}
							doctorsList={doctorsList}
						/>
					)}
					{showFieldSourceLegend && (
						<InternalFieldFooter
							hasApplicantFields={hasApplicantFields}
							hasInternalFields={hasInternalFields}
						/>
					)}
				</div>
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		</FormProvider>
	);
};
