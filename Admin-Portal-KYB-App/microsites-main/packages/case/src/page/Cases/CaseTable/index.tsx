import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import { generatePath } from "react-router";
import { Link, useSearchParams } from "react-router-dom";
import {
	ArrowDownTrayIcon,
	EyeIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFlags } from "launchdarkly-react-client-sdk";
import * as qs from "qs";
import Badge from "@/components/Badge";
import { EmptyState } from "@/components/case-table/empty-state";
import { HeaderLoadingState } from "@/components/case-table/loading-states";
import { DownloadReportButtons } from "@/components/DownloadReportButtons";
import Spinner from "@/components/Spinner/Spinner";
import { useSearchPayload } from "@/hooks";
import CaseWrapper from "@/layouts/CaseWrapper";
import { capitalize, concatString } from "@/lib/helper";
import {
	useGetBusinessApplicantConfig,
	useGetCustomerApplicantConfig,
} from "@/services/queries/aging.query";
import { useExportCases, useGetCaseTypes } from "@/services/queries/case.query";
import {
	type ModuleType,
	useAppContextStore,
} from "@/store/useAppContextStore";
import {
	type Case,
	type CaseType,
	type CustomerApplicantConfigResponseDataConfig,
	type GetCasesResponse,
	type GetCaseTypesResponse,
} from "@/types/case";
import { type IPayload } from "@/types/common";

import { URL } from "@/constants";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
import {
	getApplicantName,
	getCaseStatusVariant,
	getCaseTypeBadge,
	getStatusId,
	getStatusLabel,
	isValidCaseData,
	isValidCaseTypesData,
} from "@/helpers/case";
import { ToastProvider } from "@/providers/ToastProvider";
import { CaseStatusBadge, IntegrationsStatusBadge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { DataTable, type DataTableColumn } from "@/ui/DataTable/DataTable";
import {
	type FilterConfigItem,
	FilterForm,
	type FilterFormValues,
} from "@/ui/filter-form";
import { createFilterSchema } from "@/ui/filter-form-schema";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { Pagination } from "@/ui/pagination";
import { PaginationDescription } from "@/ui/PaginationDescription";
import { SearchField } from "@/ui/search-field";
import { Skeleton } from "@/ui/skeleton";
import { Table, TableBody } from "@/ui/table";
import { Tooltip } from "@/ui/tooltip";

const createCaseTableColumns = (
	caseTypesResponse: GetCaseTypesResponse | undefined,
	getCaseRedirectURL: (id: string) => string,
	moduleType: ModuleType,
	isAgingThresholdEnabled?: boolean,
	agingThresholdConfig?: CustomerApplicantConfigResponseDataConfig[],
	refetchTableData?: () => Promise<void>,
	showIntegrationsColumn?: boolean,
): Array<DataTableColumn<Case>> => [
	{
		label: "Case #",
		accessor: "id",
		render: (id: string) => {
			const truncatedId = id.length > 8 ? `${id.slice(0, 8)}...` : id;
			return (
				<Link
					to={getCaseRedirectURL(id)}
					className="text-blue-500 cursor-pointer hover:underline block"
					title={id}
				>
					{truncatedId}
				</Link>
			);
		},
	},

	{
		label: "Date",
		accessor: "created_at",
		sortable: true,
		sortKey: "data_cases.created_at",
		render: (date) => new Date(date).toLocaleDateString(),
	},
	{
		label: "Type",
		accessor: "case_type",
		render: (caseType) => {
			if (!caseTypesResponse) {
				return <Skeleton className="h-4 w-[60px]" />;
			}
			if (isValidCaseTypesData(caseTypesResponse)) {
				return (
					<span className="flex gap-1">
						{getCaseTypeBadge(
							caseType,
							caseTypesResponse.data.records,
						)}
					</span>
				);
			}
			return <span className="text-gray-500">-</span>;
		},
	},
	{
		label: "Business Name",
		accessor: "business_name",
		sortable: true,
		sortKey: "data_businesses.name",
		render: (businessName, caseItem) => {
			const displayName = caseItem?.dba_name
				? `${caseItem.dba_name} (${businessName})`
				: businessName;
			return (
				<span
					className="min-w-[200px] max-w-[200px] truncate block"
					title={displayName}
				>
					{displayName}
				</span>
			);
		},
	},
	{
		...((moduleType !== "standalone_case" && isAgingThresholdEnabled
			? {
					label: (
						<div className="translate-y-2.5 flex flex-row items-center gap-1">
							<span className="whitespace-nowrap">
								Aging Threshold
							</span>
							<Tooltip
								trigger={
									<div className="translate-y-0.5">
										<InformationCircleIcon className="text-gray-500 min-w-4 min-h-4" />
									</div>
								}
								content={
									<p className="w-[367px]">
										Aging Threshold represents how long an
										application has been invited but not
										submitted. The thresholds are assigned
										after:
										<br />
										Low ={" "}
										{agingThresholdConfig?.find(
											(item) => item.urgency === "low",
										)?.threshold ?? 30}{" "}
										days
										<br />
										Medium ={" "}
										{agingThresholdConfig?.find(
											(item) => item.urgency === "medium",
										)?.threshold ?? 60}{" "}
										days
										<br />
										High ={" "}
										{agingThresholdConfig?.find(
											(item) => item.urgency === "high",
										)?.threshold ?? 90}{" "}
										days
									</p>
								}
							/>
						</div>
					),
					accessor: "aging_threshold_config",
					render: (agingThreshold: {
						urgency: string;
						config_source: "business" | "customer";
					}) => {
						let color: "red" | "green" | "yellow" | null = null;
						if (agingThreshold)
							switch (agingThreshold.urgency) {
								case "low":
									color = "green";
									break;
								case "medium":
									color = "yellow";
									break;
								case "high":
									color = "red";
									break;
								default:
									color = null;
							}
						return color === null ? (
							<>-</>
						) : (
							<Badge
								color={color}
								text={
									capitalize(
										`${agingThreshold.urgency}${
											agingThreshold.config_source ===
											"business"
												? " • Custom "
												: ""
										}`,
									) ?? ""
								}
								className="text-xs"
							/>
						);
					},
				}
			: {}) as any),
	},
	{
		label: "Status",
		accessor: "status_label",
		render: (statusLabel) => (
			<CaseStatusBadge
				variant={getCaseStatusVariant(statusLabel?.toLowerCase())}
				label={getStatusLabel(statusLabel)}
			/>
		),
	},
	...(showIntegrationsColumn
		? [
				{
					label: "Integrations",
					accessor: "is_integration_complete",
					render: (isIntegrationComplete: boolean | null) => (
						<IntegrationsStatusBadge
							isComplete={isIntegrationComplete}
						/>
					),
				} as DataTableColumn<Case>,
			]
		: []),
	{
		label: "Applicant",
		accessor: "applicant",
		sortKey: "data_applicants.first_name",
		render: (applicant) => (
			<span className="min-w-[150px]">{getApplicantName(applicant)}</span>
		),
	},
	{
		label: "Assignee",
		accessor: "assignee",
		render: (assignee) => (
			<span className="min-w-[150px]">
				{concatString([
					String(assignee?.first_name ?? ""),
					String(assignee?.last_name ?? ""),
				])}
			</span>
		),
	},
	{
		label: "Actions",
		accessor: "id",
		render: (id, caseItem) => (
			<div className="flex space-x-2">
				<Tooltip
					trigger={
						<Link to={getCaseRedirectURL(id)}>
							<EyeIcon className="w-5 h-5 text-blue-700 cursor-pointer" />
						</Link>
					}
					content="View Case"
				/>
				<DownloadReportButtons
					status={caseItem?.report_status}
					businessId={caseItem?.business_id}
					caseId={caseItem?.id}
					reportId={caseItem?.report_id}
					onModalClose={refetchTableData}
				/>
			</div>
		),
	},
];

const CaseTable: FC<{
	title?: string;
	isLoadingCaseData: boolean;
	customerCasesData?: GetCasesResponse;
	updatePayload: (newPayload: IPayload) => void;
	customerId?: string;
	businessId?: string;
	refetchTableData?: () => Promise<void>;
}> = ({
	title = "Cases",
	isLoadingCaseData,
	customerCasesData,
	updatePayload,
	customerId,
	refetchTableData,
	businessId,
}) => {
	const flags = useFlags();
	const [searchParams] = useSearchParams();
	const [hasLoadedDataBefore, setHasLoadedDataBefore] = useState(false);
	const [currentSort, setCurrentSort] = useState<string>("");
	const { moduleType, platformType } = useAppContextStore();

	const { data: caseTypesResponse } = useGetCaseTypes({
		pagination: false,
	});

	const {
		data: customerApplicantConfigData,
		isInitialLoading: customerApplicantConfigLoading,
	} = useGetCustomerApplicantConfig(customerId ?? "");

	const { data: businessApplicantConfigData } = useGetBusinessApplicantConfig(
		businessId ?? "",
	);

	const {
		payload,
		sortHandler,
		paginationHandler,
		searchHandler,
		filterHandler,
	} = useSearchPayload();

	const searchTriggerHandler = useCallback(
		(value: string) => {
			if (!value.trim()) {
				searchHandler("", []);
				return;
			}

			searchHandler(value, [
				"data_cases.id",
				"data_businesses.name",
				"data_businesses.tin",
				"data_business_names.name",
				"first_name",
				"last_name",
				"applicant_id",
			]);
		},
		[searchHandler],
	);

	const handleSort = (key: string) => {
		const newDirection: "ASC" | "DESC" | null =
			currentSort === `${key}:ASC`
				? "DESC"
				: currentSort === `${key}:DESC`
					? null
					: "ASC";

		const newSort = newDirection ? `${key}:${newDirection}` : "";
		setCurrentSort(newSort);

		if (!newDirection) {
			sortHandler(null, null);
		} else {
			sortHandler(newDirection, key);
		}
	};

	const currentPage = payload.page ?? 1;

	// Prevent infinite render loop: only propagate payload when its deep value changes
	const prevPayloadRef = useRef<IPayload | undefined>(undefined);

	const { mutateAsync: exportCases, isPending: exportCasesLoading } =
		useExportCases();

	useEffect(() => {
		if (!payload) return;

		const hasChanged =
			JSON.stringify(payload) !== JSON.stringify(prevPayloadRef.current);

		if (hasChanged) {
			updatePayload(payload);
			prevPayloadRef.current = payload;
		}
	}, [payload, updatePayload]);

	useEffect(() => {
		if (isValidCaseData(customerCasesData)) {
			if (!hasLoadedDataBefore) {
				setHasLoadedDataBefore(true);
			}
		}
	}, [customerCasesData, hasLoadedDataBefore]);

	const isInitialLoading = isLoadingCaseData && !hasLoadedDataBefore;
	const hasValidData = isValidCaseData(customerCasesData);

	const getCaseRedirectURL = useCallback(
		(id: string) => {
			if (moduleType === "standalone_case") {
				return generatePath(URL.STANDALONE_CASE_DETAILS, { id });
			}
			if (moduleType === "customer_case" && platformType === "admin") {
				return generatePath(URL.CUSTOMER_APPLICANT_CASE_DETAILS, {
					slug: customerId,
					id,
				});
			}
			if (
				moduleType === "business_case" &&
				platformType === "admin" &&
				businessId
			) {
				return generatePath(URL.BUSINESS_APPLICANT_CASE_DETAILS, {
					businessId,
					id,
				});
			}
			return generatePath(URL.CASE_DETAILS, { id });
		},
		[flags, customerId, moduleType, platformType],
	);

	const filterDropdownRef = useRef<{
		setOpen: (open: boolean) => void;
	}>(null);

	const caseTypes = useMemo(() => {
		if (!caseTypesResponse?.data?.records) return [];
		return caseTypesResponse.data.records.map((type) => {
			const label = type.label;
			switch (label.toLowerCase()) {
				case "onboarding":
					return { label: "Onboarding", value: label };
				case "risk":
					return { label: "Risk", value: label };
				case "application edit":
				case "application_edit":
					return { label: "Application Edit", value: label };
				default:
					return { label, value: label };
			}
		});
	}, [caseTypesResponse]);

	const shouldPauseTransition =
		flags[FEATURE_FLAGS.PAT_926_PAUSE_DECISIONING] ?? false;
	const caseStatuses = useMemo(() => {
		const validStatuses = shouldPauseTransition
			? ["invited", "created", "onboarding", "submitted"]
			: [
					"manually-rejected",
					"auto-rejected",
					"auto-approved",
					"manually-approved",
					"under-manual-review",
					"information-requested",
					"pending-decision",
					"submitted",
					"score-generated",
					"archived",
					"information-updated",
					"onboarding",
					"risk-alert",
					"investigating",
					"dismissed",
					"paused",
					"escalated",
					"invited",
				];
		return validStatuses.map((status) => ({
			label: getStatusLabel(status),
			value: status,
		}));
	}, [shouldPauseTransition]);

	const agingThresholds = useMemo(() => {
		let config = customerApplicantConfigData?.data?.config ?? [];
		if (moduleType === "business_case") {
			config =
				businessApplicantConfigData?.data?.config ??
				customerApplicantConfigData?.data?.config ??
				[];
		}
		return config.reduce<Record<"low" | "medium" | "high", number>>(
			(acc, item) => {
				acc[item.urgency] = item.threshold;
				return acc;
			},
			{ low: 30, medium: 60, high: 90 },
		);
	}, [businessApplicantConfigData, customerApplicantConfigData, moduleType]);

	const filterConfig: FilterConfigItem[] = [
		{
			type: "checkbox-group",
			name: "caseType",
			label: "Case Type",
			options: caseTypes,
		},
		{
			type: "checkbox-group",
			name: "status",
			label: "Status",
			options: caseStatuses,
		},
		{
			...(moduleType !== "standalone_case" &&
			customerApplicantConfigData?.data?.is_enabled
				? {
						type: "checkbox-group",
						name: "agingThreshold",
						label: (
							<div>
								Aging Threshold{"  "}
								<Tooltip
									trigger={
										<div className="translate-y-[2.5px]">
											<InformationCircleIcon className="text-gray-500 min-w-4 min-h-4" />
										</div>
									}
									content={
										<p className="w-[367px]">
											Aging Threshold represents how long
											an application has been invited but
											not submitted. The thresholds are
											assigned after:
											<br />
											Low = {agingThresholds?.low} days
											<br />
											Medium = {
												agingThresholds?.medium
											}{" "}
											days
											<br />
											High = {agingThresholds?.high} days
										</p>
									}
								/>
							</div>
						),
						options: [
							{ label: "Low", value: "low" },
							{ label: "Medium", value: "medium" },
							{ label: "High", value: "high" },
						],
					}
				: ({} as FilterConfigItem)),
		},
		{
			type: "date-range",
			name: "onboardingDate",
			label: "Date Range",
		},
	].filter((e) => {
		return !!e.type;
	}) as FilterConfigItem[];

	const filterSchema = createFilterSchema(filterConfig);

	const getInitialFilterValues = useCallback(() => {
		const filterStr = searchParams.get("filter");
		const filterDateStr = searchParams.get("filter_date");
		const sortStr = searchParams.get("sort");

		const filters = filterStr ? qs.parse(filterStr) : {};
		const dateFilters = filterDateStr ? qs.parse(filterDateStr) : {};
		const caseTypes: string[] = [];
		const statuses: string[] = [];

		// Extract case types from filters
		const caseTypeValue = filters["data_cases.case_type"];
		if (caseTypeValue) {
			const caseTypeIds = Array.isArray(caseTypeValue)
				? caseTypeValue
				: [caseTypeValue];

			caseTypeIds.forEach((value) => {
				const caseTypeId =
					typeof value === "string" ? parseInt(value, 10) : NaN;
				if (!isNaN(caseTypeId) && caseTypesResponse?.data?.records) {
					const caseTypeRecord = caseTypesResponse.data.records.find(
						(record: CaseType) => record.id === caseTypeId,
					);
					if (caseTypeRecord?.label) {
						caseTypes.push(caseTypeRecord.label);
					}
				}
			});
		}

		// Extract statuses from filters
		const statusValue = filters["data_cases.status"];
		if (statusValue) {
			const statusIds = Array.isArray(statusValue)
				? statusValue
				: [statusValue];

			statusIds.forEach((value) => {
				const valueAsNumber =
					typeof value === "string" ? parseInt(value, 10) : value;
				const matchingStatus = caseStatuses.find(
					(status) => getStatusId(status.value) === valueAsNumber,
				);
				if (matchingStatus) {
					statuses.push(matchingStatus.value);
				}
			});
		}

		// Set initial sort from URL
		if (sortStr) {
			const sortData = qs.parse(sortStr);
			const [sortKey] = Object.keys(sortData);
			if (sortKey) {
				const sortDirection = String(sortData[sortKey]).toUpperCase();
				if (sortDirection === "ASC" || sortDirection === "DESC") {
					setCurrentSort(`${sortKey}:${sortDirection}`);
				}
			}
		}

		// Extract date range from date filters
		let fromDate;
		let toDate;
		if (Array.isArray(dateFilters?.["data_cases.created_at"])) {
			fromDate = dateFilters?.["data_cases.created_at"][0];
			toDate = dateFilters?.["data_cases.created_at"][1];
		}

		return {
			caseType: caseTypes,
			status: statuses,
			minWorthScore: "",
			maxWorthScore: "",
			onboardingDate: {
				from: fromDate ? new Date(String(fromDate)) : undefined,
				to: toDate ? new Date(String(toDate)) : undefined,
			},
		};
	}, [searchParams]);

	const form = useForm<FilterFormValues>({
		resolver: zodResolver(filterSchema),
		defaultValues: {
			caseType: [],
			status: [],
			minWorthScore: "",
			maxWorthScore: "",
			onboardingDate: {
				from: undefined,
				to: undefined,
			},
		},
	});

	// Update form values when case types are loaded or URL changes
	useEffect(() => {
		if (caseTypesResponse?.data?.records) {
			const initialValues = getInitialFilterValues();
			form.reset(initialValues);
		}
	}, [caseTypesResponse?.data?.records]);

	const handleFilterChange = useCallback(
		(values: FilterFormValues) => {
			const filters: Record<string, unknown> = {};

			if (values.caseType?.length) {
				values.caseType.forEach((typeValue: string, index: number) => {
					const caseTypeRecord =
						caseTypesResponse?.data?.records.find(
							(record: CaseType) =>
								record.label.toLowerCase() ===
								typeValue.toLowerCase(),
						);
					if (caseTypeRecord?.id) {
						filters[`data_cases.case_type[${index}]`] =
							caseTypeRecord.id;
					}
				});
			}

			if (values.status?.length) {
				values.status.forEach((statusValue: string, index: number) => {
					const statusId = getStatusId(statusValue);
					if (statusId) {
						filters[`data_cases.status[${index}]`] = statusId;
					}
				});
			}

			if (values?.agingThreshold?.length) {
				values.agingThreshold.forEach(
					(agingThreshold: string, index: number) => {
						if (agingThreshold) {
							filters[`aging_threshold[${index}]`] =
								agingThreshold;
						}
					},
				);
			}

			if (values.onboardingDate?.from ?? values.onboardingDate?.to) {
				const dateFilters: Record<string, string> = {};

				if (values.onboardingDate?.from) {
					dateFilters["data_cases.created_at[0]"] =
						values.onboardingDate.from.toISOString();
				}

				if (values.onboardingDate?.to) {
					const endDate = new Date(values.onboardingDate.to);
					endDate.setHours(23, 59, 59, 999);
					dateFilters["data_cases.created_at[1]"] =
						endDate.toISOString();
				}

				filterHandler(filters, dateFilters);
			} else {
				filterHandler(filters);
			}
		},
		[filterHandler, caseTypesResponse?.data?.records],
	);

	const filteredTableColumns = useMemo(() => {
		const showIntegrationsColumn =
			flags[FEATURE_FLAGS.PAT_961_DISPLAY_INTEGRATIONS_RUNNING] ?? false;

		const columns = createCaseTableColumns(
			caseTypesResponse,
			getCaseRedirectURL,
			moduleType,
			customerApplicantConfigData?.data?.is_enabled,
			moduleType === "business_case"
				? (businessApplicantConfigData?.data?.config ??
						customerApplicantConfigData?.data?.config ??
						[])
				: (customerApplicantConfigData?.data?.config ?? []),
			refetchTableData,
			showIntegrationsColumn,
		);

		if (moduleType === "standalone_case") {
			return columns.filter(
				(col): col is DataTableColumn<Case> =>
					!!col && col.label !== "Assignee",
			);
		}

		if (platformType === "admin") {
			return columns.filter(
				(col): col is DataTableColumn<Case> =>
					!!col && col.label !== "Applicant",
			);
		}

		return columns;
	}, [
		caseTypesResponse,
		getCaseRedirectURL,
		refetchTableData,
		moduleType,
		platformType,
		customerApplicantConfigData,
		flags,
	]);

	return (
		<CaseWrapper>
			<ToastProvider />
			<div className="p-8 case">
				<Card className="p-6 space-y-4">
					{isInitialLoading ? (
						<HeaderLoadingState />
					) : (
						<div className="flex items-center justify-between">
							<FormProvider {...form}>
								<div>
									<h1 className="text-lg font-semibold">
										{title}
									</h1>
								</div>
								<div className="flex items-center gap-2">
									<SearchField
										placeholder="Search cases..."
										className="rounded-lg drop-shadow-none h-11"
										onSearch={searchTriggerHandler}
									/>
									<FilterOptionsDropdown
										dropdownRef={filterDropdownRef}
										filterConfig={filterConfig}
										onFilterChange={handleFilterChange}
										onClose={() => {
											filterDropdownRef.current?.setOpen(
												false,
											);
										}}
										form={
											<FilterForm
												form={form}
												filterConfig={filterConfig}
											/>
										}
									/>
									{flags[
										FEATURE_FLAGS
											.BEST_23_CUSTOMER_CASES_DETAILS
									] && (
										<Tooltip
											content="Export CSV Files"
											side="bottom"
											trigger={
												<Button
													variant="outline"
													size="lg"
													onClick={async () => {
														await exportCases(
															customerId ?? "",
														).then((e) => {
															window.open(
																e.data
																	.file_path,
																"_blank",
															);
														});
													}}
													disabled={
														exportCasesLoading
													}
												>
													{exportCasesLoading ? (
														<Spinner />
													) : (
														<ArrowDownTrayIcon className="w-5 h-5 text-gray-800" />
													)}
												</Button>
											}
										/>
									)}
								</div>
							</FormProvider>
						</div>
					)}

					{!hasLoadedDataBefore &&
					!hasValidData &&
					!isInitialLoading ? (
						<Table>
							<TableBody>
								<EmptyState />
							</TableBody>
						</Table>
					) : !hasValidData &&
					  (form.getValues().caseType.length > 0 ||
							form.getValues()?.status?.length > 0 ||
							!!form.getValues()?.onboardingDate.from ||
							!!payload.search) ? (
						<Table>
							<TableBody>
								<EmptyState showNoResultsMessage />
							</TableBody>
						</Table>
					) : (
						<>
							<DataTable<Case>
								columns={filteredTableColumns.filter((col) => {
									return !!col?.label;
								})}
								data={customerCasesData}
								isLoading={
									isLoadingCaseData ||
									(moduleType === "standalone_case" ||
									moduleType === "business_case"
										? false
										: customerApplicantConfigLoading)
								}
								currentPage={currentPage}
								onPageChange={paginationHandler}
								currentSort={currentSort}
								onSort={handleSort}
							/>

							<div className="flex items-center justify-between px-2 pb-6">
								{!isLoadingCaseData ? (
									<PaginationDescription
										totalItems={
											customerCasesData?.data
												?.total_items ?? 0
										}
										currentPage={currentPage}
										itemsPerPage={
											payload.items_per_page ?? 10
										}
									/>
								) : (
									<Skeleton className="h-6 w-[200px]" />
								)}

								{customerCasesData?.data ? (
									<Pagination
										currentPage={currentPage}
										totalPages={
											customerCasesData?.data
												?.total_pages ?? 1
										}
										onPageChange={paginationHandler}
									/>
								) : (
									<Skeleton className="h-8 w-[300px]" />
								)}
							</div>
						</>
					)}
				</Card>
			</div>
		</CaseWrapper>
	);
};
export default CaseTable;
