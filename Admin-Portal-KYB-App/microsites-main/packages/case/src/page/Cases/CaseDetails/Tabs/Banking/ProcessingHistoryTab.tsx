import { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { useFlags } from "launchdarkly-react-client-sdk";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { useCaseEditPermission } from "@/hooks/useCaseEditPermission";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import {
	useGetProcessingHistory,
	useGetProcessingHistoryFacts,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { InternalFieldFooter } from "../../components";
import type { FieldSource } from "../../components/fieldSource.types";
import { SYSTEM_SOURCE } from "../../components/fieldSource.types";
import { useOverrideUsers } from "../../hooks/useOverrideUsers";
import {
	EditablePointOfSaleVolumeCard,
	EditableProcessingVolumeCard,
	EditableSeasonalDataCard,
} from "./components/EditableProcessingHistoryCards";
import {
	PointOfSaleVolumeCard,
	PointOfSaleVolumeCardSkeleton,
	ProcessingVolumeCard,
	ProcessingVolumeCardSkeleton,
	SeasonalDataCard,
	SeasonalDataCardSkeleton,
	StatementsCard,
	StatementsCardSkeleton,
} from "./components/ProcessingHistoryCards";
import {
	buildApplicantFactKeySet,
	buildFactFieldSourceMap,
	transformFactsToCardData,
} from "./hooks/useProcessingHistoryEditState";
import { useProcessingHistoryForm } from "./hooks/useProcessingHistoryForm";

import FEATURE_FLAGS from "@/constants/FeatureFlags";

export const ProcessingHistoryTab: React.FC<{
	caseId: string;
}> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const flags = useFlags();

	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? "";

	const { data: processingHistoryData, isLoading: processingHistoryLoading } =
		useGetProcessingHistory(businessId, caseId);

	// Fetch facts data for overrides and proper fact structure
	const { data: factsResponse, isLoading: factsLoading } =
		useGetProcessingHistoryFacts(businessId);
	const factsData = factsResponse?.data;

	// processingHistoryData.data is returned as an array, but for now we can assume there is only a single entry
	// we can revisit this if/when we need to support multiple entries
	const processingHistory = processingHistoryData?.data?.[0];

	// Check if inline editing is enabled
	const isInlineEditingEnabled =
		flags[FEATURE_FLAGS.PAT_874_CM_APP_EDITING] ?? false;
	const canEdit = useCaseEditPermission();
	const editingEnabled = isInlineEditingEnabled && canEdit;

	// Combined loading state - wait for both raw data and facts
	const isLoading = processingHistoryLoading || factsLoading;

	const factsDataSources = useMemo(
		() => [factsData as Record<string, any> | undefined],
		[factsData],
	);
	const userNameMap = useOverrideUsers(factsDataSources);

	const applicantFactKeys = useMemo(
		() =>
			buildApplicantFactKeySet(
				(factsData as Record<string, any> | undefined)
					?.guest_owner_edits,
			),
		[factsData],
	);

	const cardDataFromFacts = useMemo(
		() =>
			transformFactsToCardData(factsData, userNameMap, applicantFactKeys),
		[factsData, userNameMap, applicantFactKeys],
	);

	const fieldSourceMap = useMemo(
		() =>
			buildFactFieldSourceMap(factsData, userNameMap, applicantFactKeys),
		[factsData, userNameMap, applicantFactKeys],
	);

	// Initialize form for inline editing
	const { form, getSaveStatus, getOriginalValue, handleEditComplete } =
		useProcessingHistoryForm({
			data: processingHistory,
			factsData,
			businessId,
			caseId,
			isLoading,
		});

	const statements = useMemo(() => {
		return processingHistory?.file
			? [
					{
						fileName: processingHistory?.file.fileName,
						signedUrl: processingHistory?.file.signedRequest,
					},
				]
			: [];
	}, [processingHistory]);

	// Check if any fields have guest owner edits (for showing internal field footer)
	const hasGuestEditsFromFacts = useMemo(() => {
		if (!cardDataFromFacts) return null;
		return Object.values(cardDataFromFacts).some(
			(section) => section?.guest_owner_edits?.length > 0,
		);
	}, [cardDataFromFacts]);

	// each section has its own guest_owner_edits
	const hasGuestEditsFromRawData = processingHistoryData?.data?.some((item) =>
		Object.values(item).some(
			(value) => value?.guest_owner_edits?.length > 0,
		),
	);

	// Facts is the source of truth; raw data is the fallback
	const hasGuestOwnerEdits =
		hasGuestEditsFromFacts ?? hasGuestEditsFromRawData ?? false;

	// guest_owner_edits for statements lives on the processing history entry and is represented by "file_name" field
	const statementsApplicantProvided =
		processingHistory?.guest_owner_edits?.includes("file_name");

	const statementsFieldSource: FieldSource = statementsApplicantProvided
		? { type: "applicant" }
		: SYSTEM_SOURCE;

	const hasApplicantFields =
		hasGuestOwnerEdits ||
		statementsApplicantProvided ||
		applicantFactKeys.size > 0;
	const hasInternalFields = useMemo(() => {
		if (!cardDataFromFacts) return false;
		return Object.values(cardDataFromFacts).some(
			(section) =>
				section?.fieldSources &&
				Object.keys(section.fieldSources).length > 0,
		);
	}, [cardDataFromFacts]);

	const renderContent = () => {
		if (isLoading) {
			return (
				<>
					<ProcessingVolumeCardSkeleton title="General" />
					<SeasonalDataCardSkeleton />
					<ProcessingVolumeCardSkeleton title="Visa/Mastercard/Discover" />
					<ProcessingVolumeCardSkeleton title="American Express" />
					<PointOfSaleVolumeCardSkeleton />
					<StatementsCardSkeleton />
				</>
			);
		}

		if (editingEnabled) {
			return (
				<FormProvider {...form}>
					<EditableProcessingVolumeCard
						title="General"
						editingEnabled={editingEnabled}
						getSaveStatus={getSaveStatus}
						getOriginalValue={getOriginalValue}
						onEditComplete={handleEditComplete}
						fieldSourceMap={fieldSourceMap}
					/>
					<EditableSeasonalDataCard
						editingEnabled={editingEnabled}
						getSaveStatus={getSaveStatus}
						getOriginalValue={getOriginalValue}
						onEditComplete={handleEditComplete}
						fieldSourceMap={fieldSourceMap}
					/>
					<EditableProcessingVolumeCard
						title="Visa/Mastercard/Discover"
						editingEnabled={editingEnabled}
						getSaveStatus={getSaveStatus}
						getOriginalValue={getOriginalValue}
						onEditComplete={handleEditComplete}
						fieldSourceMap={fieldSourceMap}
					/>
					<EditableProcessingVolumeCard
						title="American Express"
						editingEnabled={editingEnabled}
						getSaveStatus={getSaveStatus}
						getOriginalValue={getOriginalValue}
						onEditComplete={handleEditComplete}
						fieldSourceMap={fieldSourceMap}
					/>
					<EditablePointOfSaleVolumeCard
						editingEnabled={editingEnabled}
						getSaveStatus={getSaveStatus}
						getOriginalValue={getOriginalValue}
						onEditComplete={handleEditComplete}
						fieldSourceMap={fieldSourceMap}
					/>
					{!!statements?.length && (
						<StatementsCard
							statements={statements}
							fieldSource={statementsFieldSource}
						/>
					)}
				</FormProvider>
			);
		}

		// Use facts data for display values (includes overrides), fall back to raw data
		return (
			<>
				<ProcessingVolumeCard
					title="General"
					data={
						cardDataFromFacts.general_data ??
						processingHistory?.general_data
					}
				/>
				<SeasonalDataCard
					data={
						cardDataFromFacts.seasonal_data ??
						processingHistory?.seasonal_data
					}
				/>
				<ProcessingVolumeCard
					title="Visa/Mastercard/Discover"
					data={
						cardDataFromFacts.card_data ??
						processingHistory?.card_data
					}
				/>
				<ProcessingVolumeCard
					title="American Express"
					data={
						cardDataFromFacts.american_express_data ??
						processingHistory?.american_express_data
					}
				/>
				<PointOfSaleVolumeCard
					data={
						cardDataFromFacts.point_of_sale_data ??
						processingHistory?.point_of_sale_data
					}
				/>
				{!!statements?.length && (
					<StatementsCard
						statements={statements}
						fieldSource={statementsFieldSource}
					/>
				)}
			</>
		);
	};

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="space-y-4 lg:col-span-8">
				{renderContent()}
				<InternalFieldFooter
					hasApplicantFields={hasApplicantFields}
					hasInternalFields={hasInternalFields}
				/>
			</div>
			<div className="lg:col-span-4">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
