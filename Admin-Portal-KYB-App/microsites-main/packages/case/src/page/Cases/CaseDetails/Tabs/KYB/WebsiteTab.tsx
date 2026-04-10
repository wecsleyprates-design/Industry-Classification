import React, { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { useCaseEditPermission } from "@/hooks/useCaseEditPermission";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useAppContextStore } from "@/store/useAppContextStore";
import { DetailsCard, InternalFieldFooter } from "../../components";
import { useOverrideUsers } from "../../hooks/useOverrideUsers";
import {
	useWebsiteNonEditableFields,
	useWebsiteTabData,
	useWebsiteTabEditState,
	useWebsiteTabFieldRenderer,
	useWebsiteTabForm,
	useWebsiteTabSuggestions,
} from "./hooks/WebsiteTab";
import {
	transformWebsitePage,
	WebsiteDetailsSkeleton,
	WebsitePageItem,
	WebsitePagesSkeleton,
} from "./components";

import { Badge, VerificationBadge } from "@/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

export interface WebsiteTabProps {
	caseId: string;
}

export const WebsiteTab: React.FC<WebsiteTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? "";

	// Check editing permissions
	const canEdit = useCaseEditPermission();

	const { data, loadingStates, originalValues, guestOwnerEdits } =
		useWebsiteTabData(businessId, caseData);

	const factsDataSources = useMemo(
		() => [data.factsBusinessDetails?.data],
		[data.factsBusinessDetails?.data],
	);
	const userNameMap = useOverrideUsers(factsDataSources);

	const { form, isFieldDirty, getOriginalValue } = useWebsiteTabForm({
		originalValues,
		isLoading: loadingStates.websiteDetails,
	});

	// Generate all suggestions
	const suggestions = useWebsiteTabSuggestions(data);

	// Manage edit state (save status tracking and fact override handler)
	const { getSaveStatus, handleEditComplete } = useWebsiteTabEditState(
		caseId,
		businessId,
		data,
	);

	const { websiteDetails } = useWebsiteTabFieldRenderer({
		originalValues,
		loadingStates,
		canEdit,
		getSaveStatus,
		handleEditComplete,
		suggestions,
		guestOwnerEdits,
		data,
		isFieldDirty,
		getOriginalValue,
		userNameMap,
	});

	// Check if website field has been edited (is dirty)
	const isWebsiteDirty = isFieldDirty("website");

	// Get non-editable fields (Creation Date, Expiration Date, Parked Domain, Status)
	const nonEditableFields = useWebsiteNonEditableFields(
		data.businessWebsiteData?.data,
		isWebsiteDirty,
	);

	// Combine editable and non-editable fields
	const allWebsiteDetails = useMemo(() => {
		const editableFields = websiteDetails || [];
		return [
			...editableFields,
			...nonEditableFields.map((field) => {
				return {
					label: field.label,
					value: field.badge ? (
						<VerificationBadge
							variant={field.badge.variant}
							className="px-2 py-1 text-sm"
						>
							{field.badge.icon ? (
								<field.badge.icon className="inline" />
							) : null}
							{field.badge.text}
						</VerificationBadge>
					) : (
						<span className="text-sm text-gray-900">
							{field.value}
						</span>
					),
				};
			}),
		];
	}, [websiteDetails, nonEditableFields]);

	// Transform website pages data
	const websitePages = useMemo(() => {
		if (!data.businessWebsiteData?.data?.pages) {
			return [];
		}

		return (data.businessWebsiteData.data.pages || [])
			.filter((page: any) => page.url)
			.map(transformWebsitePage);
	}, [data.businessWebsiteData]);

	const allDetails = websiteDetails || [];
	const hasApplicantFields = allDetails.some(
		(d) => d.fieldSource?.type === "applicant",
	);
	const hasInternalFields = allDetails.some(
		(d) => d.fieldSource?.type === "internal",
	);

	return (
		<FormProvider {...form}>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					{loadingStates.websiteDetails ? (
						<>
							<WebsiteDetailsSkeleton />
							<WebsitePagesSkeleton />
						</>
					) : (
						<>
							<DetailsCard
								title="Website Details"
								details={allWebsiteDetails}
							/>
							{websitePages.length > 0 && !isWebsiteDirty && (
								<Card>
									<CardHeader>
										<CardTitle>Website Pages</CardTitle>
									</CardHeader>
									<CardContent className="space-y-4">
										{websitePages.map((page, index) => (
											<WebsitePageItem
												key={index}
												page={page}
											/>
										))}
									</CardContent>
								</Card>
							)}
						</>
					)}
					<InternalFieldFooter
						hasApplicantFields={hasApplicantFields}
						hasInternalFields={hasInternalFields}
					/>
				</div>
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		</FormProvider>
	);
};
