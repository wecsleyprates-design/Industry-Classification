import React, { useCallback, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { generatePath, useNavigate } from "react-router";
import {
	DocumentMagnifyingGlassIcon,
	PencilIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AgingThresholdsCard } from "@/components/AgingThresholds";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetInsightsReport } from "@/services/queries/insights.query";
import {
	useGetCustomerIntegrationSettings,
	useGetMerchantProfiles,
} from "@/services/queries/integration.query";
import {
	useGetAuditTrail,
	useGetAuditTrailActions,
} from "@/services/queries/notification.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type GetAuditTrailDataRecord } from "@/types/notifications";
import { KeyPeople } from "./KeyPeople";

import { URL, VALUE_NOT_AVAILABLE } from "@/constants";
import {
	type ActivityItem,
	EnhancedActivityFeed,
	type FilterFormData,
	SkeletonActivityFeed,
} from "@/ui/activity-feed";
import { Card } from "@/ui/card";
import { CaseSummaryHeader } from "@/ui/case-summary-header";
import { type FilterConfigItem, FilterForm } from "@/ui/filter-form";
import { createFilterSchema } from "@/ui/filter-form-schema";
import { KeyInsights } from "@/ui/key-insights";

export interface CaseDetailsOverviewTabProps {
	caseId: string;
	userOptions: string[];
}

const filterFormSchema = z.object({
	users: z.array(z.string()).default([]),
	actions: z.array(z.string()).default([]),
	dateRange: z
		.object({
			from: z.date().optional(),
			to: z.date().optional(),
		})
		.optional(),
});

type FilterFormValues = z.infer<typeof filterFormSchema>;

interface AuditTrailAction {
	code: string | number;
	label: string;
}

const SEARCH_TO_ACTION_CODE_MAP: Record<string, string> = {
	status: "case_status_change",
	assignment: "case_assignment",
	score: "score_updates",
	connect: "integration",
	connected: "integration",
	integration: "integration",
	comment: "comments",
	upload: "file_upload",
	file: "file_upload",
	invitation: "invitations",
	invite: "invitations",
	creation: "case_creation",
	created: "case_creation",
	onboarded: "case_creation",
	onboarding: "case_creation",
};

const ITEMS_PER_PAGE = 10;

const CaseOverviewEmptyState: React.FC = () => (
	<div className="flex flex-col items-center justify-center h-full gap-4 p-16">
		<div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg">
			<DocumentMagnifyingGlassIcon className="w-8 h-8 text-blue-600" />
		</div>
		<h3 className="text-xl font-semibold text-gray-800">
			Overview Unavailable
		</h3>
		<p className="max-w-md text-center text-gray-500">
			We don't have enough data on this case to provide insights. This
			section will update as we gather more data on this business.
		</p>
	</div>
);

interface PreloadEnhancedActivityFeedProps {
	businessId: string;
	caseId: string;
	userOptions: string[];
}

const PreloadEnhancedActivityFeed: React.FC<
	PreloadEnhancedActivityFeedProps
> = ({ businessId, caseId, userOptions }) => {
	const [activities, setActivities] = React.useState<ActivityItem[]>([]);
	const [currentPage, setCurrentPage] = React.useState(1);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [currentFilters, setCurrentFilters] =
		React.useState<FilterFormValues>({
			users: [],
			actions: [],
			dateRange: { from: undefined, to: undefined },
		});

	const getActionCodesFromSearch = useCallback((query: string): string[] => {
		return query
			.toLowerCase()
			.split(/\s+/)
			.map((word) => SEARCH_TO_ACTION_CODE_MAP[word])
			.filter((code): code is string => code !== undefined);
	}, []);

	const {
		data: auditTrailData,
		isLoading,
		refetch,
	} = useGetAuditTrail({
		businessID: businessId,
		params: {
			suppress_pagination_error: true,
			items_per_page: ITEMS_PER_PAGE,
			page: currentPage,
			pagination: true,
			case_id: caseId,
			...(searchQuery
				? {
						filter: {
							"data_case_audit_trails.message": searchQuery,
							"metadata.customer_user_name": searchQuery,
							"metadata.applicant_name": searchQuery,
							"core_audit_trail_actions.code": [
								...getActionCodesFromSearch(searchQuery),
								...(currentFilters.actions ?? []),
							],
							...(currentFilters.users?.length
								? {
										"metadata.customer_user_name":
											currentFilters.users,
										"metadata.applicant_name":
											currentFilters.users,
									}
								: {}),
						},
					}
				: {
						filter: {
							...(currentFilters.users?.length
								? {
										"metadata.customer_user_name":
											currentFilters.users,
										"metadata.applicant_name":
											currentFilters.users,
									}
								: {}),
							...(currentFilters.actions?.length
								? {
										"core_audit_trail_actions.code":
											currentFilters.actions,
									}
								: {}),
						},
					}),
			...((currentFilters.dateRange?.from ?? currentFilters.dateRange?.to)
				? {
						filter_date: {
							"data_case_audit_trails.created_at": (() => {
								const fromDate =
									currentFilters.dateRange?.from ??
									currentFilters.dateRange?.to;
								const toDate =
									currentFilters.dateRange?.to ??
									currentFilters.dateRange?.from;

								if (!fromDate || !toDate) return [];

								return [
									new Date(fromDate).toISOString(),
									new Date(
										new Date(toDate).setHours(
											23,
											59,
											59,
											999,
										),
									).toISOString(),
								];
							})(),
						},
					}
				: {}),
		},
	});

	const handleSearch = useCallback((query: string) => {
		setSearchQuery(query);
		setCurrentPage(1);
	}, []);

	const handleFilter = useCallback((filters: FilterFormValues) => {
		setCurrentFilters(filters);
		setCurrentPage(1);
	}, []);

	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
	}, []);

	const handleCommentPosted = useCallback(() => {
		setCurrentPage(1);
		void refetch();
	}, [refetch]);

	const [actionOptions, setActionOptions] = React.useState<
		Array<{ label: string; value: string }>
	>([]);

	const { data: auditTrailActionsData } = useGetAuditTrailActions();

	useEffect(() => {
		if (auditTrailActionsData?.status === "success") {
			const transformed = auditTrailActionsData.data.map(
				(item: AuditTrailAction) => ({
					label: item.label,
					value: item.code.toString(),
				}),
			);
			setActionOptions(transformed);
		}
	}, [auditTrailActionsData]);

	const filterConfig: FilterConfigItem[] = [
		{
			type: "checkbox-group",
			name: "users",
			label: "Users",
			options: userOptions.map((user) => ({
				label: user,
				value: user,
			})),
			hidden: true,
		},
		{
			type: "checkbox-group",
			name: "actions",
			label: "Actions",
			options: actionOptions,
		},
		{
			type: "date-range",
			name: "dateRange",
			label: "Date Range",
		},
	];

	const filterSchema = createFilterSchema(filterConfig);

	const form = useForm({
		resolver: zodResolver(filterSchema),
		defaultValues: currentFilters,
	});

	const handleSubmit = (data: FilterFormValues) => {
		handleFilter(data);
	};

	const mapAuditTrailData = useCallback(
		(records: GetAuditTrailDataRecord[] = []): ActivityItem[] => {
			return (
				records?.map((item: GetAuditTrailDataRecord) => ({
					id: item.id,
					user: {
						name:
							item.metadata.customer_user_name ??
							item.metadata.applicant_name ??
							"System",
						avatar: "",
					},
					actionCode: item.action?.code?.toString() ?? "",
					message: {
						text: item.message
							.replace(/^Case [^:]+: /, "")
							.replace(
								item.metadata.applicant_name
									? new RegExp(
											`^${item.metadata.applicant_name}\\s*:?\\s*`,
										)
									: /^$^/,
								"",
							)
							.replace(
								item.metadata.applicant_name
									? new RegExp(
											`^${item.metadata.applicant_name}\\s*:?\\s*`,
										)
									: /^$^/,
								"",
							),
						boldSegments: item.to_be_bold
							.map((key) => {
								const value =
									item.metadata[
										key as keyof typeof item.metadata
									];
								return value ? String(value) : "";
							})
							.filter(Boolean),
					},
					timestamp: item.created_at,
					attachments: item.attachments?.map((attachment) => ({
						fileName: attachment.file_name,
						url: attachment.file_details.signedRequest,
					})),
				})) ?? []
			);
		},
		[],
	);

	React.useEffect(() => {
		if (auditTrailData?.data?.records) {
			setActivities((prev: ActivityItem[]) => {
				if (currentPage === 1) {
					return mapAuditTrailData(auditTrailData.data.records);
				}
				const existingIds = new Set(
					prev.map((activity) => activity.id),
				);
				const newActivities = mapAuditTrailData(
					auditTrailData.data.records.filter(
						(activity: GetAuditTrailDataRecord) =>
							!existingIds.has(activity.id),
					),
				);
				return [...prev, ...newActivities];
			});
		}
	}, [auditTrailData, mapAuditTrailData]);

	if (isLoading && currentPage === 1) {
		return <SkeletonActivityFeed />;
	}

	return (
		<FormProvider {...form}>
			<EnhancedActivityFeed
				activities={activities}
				onFilter={handleFilter as (filters: FilterFormData) => void}
				onSearch={handleSearch}
				searchValue={searchQuery}
				itemsPerPage={ITEMS_PER_PAGE}
				filterForm={
					<FilterForm form={form} filterConfig={filterConfig} />
				}
				filterConfig={filterConfig}
				onFilterChange={handleSubmit}
				currentPage={currentPage}
				totalPages={auditTrailData?.data?.total_pages ?? 1}
				onPageChange={handlePageChange}
				totalItems={auditTrailData?.data?.total_items ?? 0}
				caseId={caseId}
				businessId={businessId}
				onCommentPosted={handleCommentPosted}
				isLoading={isLoading}
			/>
		</FormProvider>
	);
};

export const CaseDetailsOverviewTab: React.FC<CaseDetailsOverviewTabProps> = ({
	caseId,
	userOptions,
}) => {
	const navigate = useNavigate();
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;
	const caseCreatedAt = caseData?.data?.created_at ?? "";
	const businessName = caseData?.data?.business.name;
	const dbaName =
		caseData?.data?.business_names?.find((dba) => !dba.is_primary)?.name ??
		undefined;
	const applicant = caseData?.data?.applicant;
	const applicantName = `${applicant?.first_name ?? ""} ${
		applicant?.last_name ?? ""
	}`.trim();

	const { data: customerIntegrationStatusData } =
		useGetCustomerIntegrationSettings(customerId);

	const { data: merchantProfileData, isLoading: merchantProfileLoading } =
		useGetMerchantProfiles(
			customerIntegrationStatusData?.data?.settings
				?.processor_orchestration?.isEnabled
				? {
						businessId,
						customerId,
					}
				: {},
		);

	const { data: insightsReport, isLoading: isLoadingInsightsReport } =
		useGetInsightsReport(caseId);
	const insightsSummary = insightsReport?.data?.summary ?? "";
	const impactOfWorthScore =
		insightsReport?.data?.reportBreakDown.impactOfWorthScore ?? "";
	const impactOfPublicRecordsScore =
		insightsReport?.data?.reportBreakDown.impactOfPublicRecordsScore ?? "";
	const impactOfCompanyProfileScore =
		insightsReport?.data?.reportBreakDown.impactOfCompanyProfileScore ?? "";
	const impactOfFinancialTrendsScore =
		insightsReport?.data?.reportBreakDown.impactOfFinancialTrendsScore ??
		"";

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<CaseSummaryHeader
					title={businessName}
					dbaName={dbaName}
					timestamp={caseCreatedAt}
					caseId={caseId}
					businessId={businessId}
				/>

				<KeyPeople
					applicant={{
						name: applicantName,
						role: "applicant",
						// todo: chat w/ product we're missing email from the API response
					}}
					caseId={caseId}
				/>

				<Card className="flex flex-col gap-2 p-4 bg-white">
					{!businessId ? (
						<SkeletonActivityFeed />
					) : (
						<PreloadEnhancedActivityFeed
							businessId={businessId}
							caseId={caseId}
							userOptions={userOptions}
						/>
					)}
				</Card>
				{customerIntegrationStatusData?.data?.settings
					?.processor_orchestration?.isEnabled &&
				!merchantProfileLoading &&
				!!merchantProfileData?.data ? (
					<Card className="flex flex-col gap-2 bg-white">
						<div className="rounded-2xl bg-white py-6 px-4 shadow-sm">
							<h2 className="mb-5 text-xl font-semibold text-gray-900">
								Merchant Profiles
							</h2>
							<div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4">
								<div className="space-y-2">
									<div className="text-base font-semibold text-gray-900">
										{
											merchantProfileData?.data?.profile
												.business_name
										}
									</div>
									<span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FEF9C3] text-[#CA8A04] text-sm font-medium">
										<span className="h-2 w-2 rounded-full bg-[#CA8A04]" />
										Pending
									</span>
								</div>

								<button
									type="button"
									onClick={() => {
										navigate(
											generatePath(URL.BUSINESS_CASES, {
												slug: businessId,
											}),
										);
									}}
									className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
								>
									<PencilIcon className="h-4 w-4" />
									Edit
								</button>
							</div>
						</div>
					</Card>
				) : null}
			</div>

			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				<AgingThresholdsCard
					businessId={businessId}
					customerId={customerId}
					aging={caseData?.data?.aging}
				/>
				<Card>
					<div className="flex flex-col gap-2 p-4">
						<h2 className="text-lg font-semibold">Case Overview</h2>
						{!isLoadingInsightsReport &&
						(!insightsReport?.data || !insightsSummary) ? (
							<CaseOverviewEmptyState />
						) : (
							<KeyInsights
								summary={insightsSummary}
								reportBreakDown={{
									impactOfWorthScore,
									impactOfPublicRecordsScore,
									impactOfCompanyProfileScore,
									impactOfFinancialTrendsScore,
								}}
								isLoading={isLoadingInsightsReport}
							/>
						)}
					</div>
				</Card>
			</div>
		</div>
	);
};
