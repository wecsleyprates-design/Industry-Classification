import React, { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { generatePath, useNavigate } from "react-router";
import { EyeIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { ArrowUpDown } from "lucide-react";
import { DownloadReport } from "@/components/Actions";
import { EmptyState } from "@/components/case-table/empty-state";
import { FilterForm } from "@/components/case-table/filter-form";
import {
	filterFormSchema,
	type FilterFormValues,
} from "@/components/case-table/filter-form";
import {
	FooterLoadingState,
	HeaderLoadingState,
	TableContentLoadingState,
} from "@/components/case-table/loading-states";
import WarningModal from "@/components/Modal/WarningModal";
import useSearchPayload from "@/hooks/useSearchPayload";
import { concatString } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { type GetCasesResponse } from "@/lib/types/case";
import { cn } from "@/lib/utils";
import {
	useDownloadReport,
	useGenerateReport,
	useGetCasesQuery,
	useGetCaseTypes,
} from "@/services/queries/case.query";
import { type TimeFilterPeriod } from "../cro";

import { URL } from "@/constants/URL";
import {
	getApplicantName,
	getCaseStatusVariant,
	getCaseTypeBadge,
	getResultsDisplay,
	getStatusCode,
	getStatusId,
	getStatusLabel,
	getTotalPages,
	isValidCaseData,
	isValidCaseTypesData,
} from "@/helpers/case";
import { CaseStatusBadge } from "@/ui/badge";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { Pagination } from "@/ui/pagination";
import { SearchField } from "@/ui/search-field";
import { Skeleton } from "@/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/table";
export type SortDirection = "ASC" | "DESC" | null;

const SortableTableHead: React.FC<{
	children: React.ReactNode;
	sortKey: string;
	currentSort?: string;
	onSort: (key: string) => void;
}> = ({ children, sortKey, currentSort, onSort }) => {
	const isActive = currentSort?.includes(sortKey);
	const isAsc = currentSort === `${sortKey}:ASC`;

	return (
		<TableHead
			className={cn("cursor-pointer select-none", isActive && "text-primary")}
			onClick={() => {
				onSort(sortKey);
			}}
		>
			<div className="flex items-center gap-1">
				{children}
				<ArrowUpDown
					className={cn(
						"h-4 w-4",
						isActive && (isAsc ? "rotate-0" : "rotate-180"),
					)}
				/>
			</div>
		</TableHead>
	);
};

const getDateTimeParams = (period: TimeFilterPeriod) => {
	switch (period) {
		case "DAY":
			return {
				"data_cases.created_at": [
					dayjs().subtract(1, "day").toISOString(),
					dayjs().toISOString(),
				],
			};
		case "WEEK":
			return {
				"data_cases.created_at": [
					dayjs().subtract(1, "week").toISOString(),
					dayjs().toISOString(),
				],
			};
		case "MONTH":
			return {
				"data_cases.created_at": [
					dayjs().subtract(1, "month").toISOString(),
					dayjs().toISOString(),
				],
			};
		case "YEAR":
			return {
				"data_cases.created_at": [
					dayjs().subtract(1, "year").toISOString(),
					dayjs().toISOString(),
				],
			};
		default:
			return {
				"data_cases.created_at": [
					dayjs().subtract(1, "week").toISOString(),
					dayjs().toISOString(),
				],
			};
	}
};

const CaseTable: React.FC<{
	period: TimeFilterPeriod;
	assignees?: string[];
}> = ({ period, assignees }) => {
	const navigate = useNavigate();

	const [hasLoadedDataBefore, setHasLoadedDataBefore] = React.useState(false);

	const [reportRequestedModal, setReportRequestedModal] = React.useState(false);
	const [lastValidData, setLastValidData] =
		React.useState<GetCasesResponse | null>(null);
	const [currentSort, setCurrentSort] = React.useState<string>("");
	const [currentFilterCount, setCurrentFilterCount] = React.useState(0);

	const form = useForm<FilterFormValues>({
		resolver: zodResolver(filterFormSchema),
		defaultValues: {
			caseType: [],
			status: [],
			riskMonitoring: [],
			minWorthScore: "",
			maxWorthScore: "",
		},
	});

	const { data: caseTypesResponse } = useGetCaseTypes({
		pagination: false,
	});
	const customerId: string = getItem("customerId") ?? "";

	const {
		payload,
		sortHandler,
		paginationHandler,
		searchHandler,
		filterHandler,
		dateFilterHandler,
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
				"first_name",
				"last_name",
				"applicant_id",
			]);
		},
		[searchHandler],
	);

	const currentPage = payload.page ?? 1;

	const {
		data: customerCasesData,
		isLoading: isLoadingCaseData,
		refetch: refetTableData,
	} = useGetCasesQuery({
		customerId,
		params: {
			...payload,
			filter: {
				"data_cases.assignee": assignees ?? [],
				...payload.filter,
			},
		},
	});

	useEffect(() => {
		if (isValidCaseData(customerCasesData) && customerCasesData) {
			if (!hasLoadedDataBefore) {
				setHasLoadedDataBefore(true);
			}
			setLastValidData(customerCasesData);
		}
	}, [customerCasesData, hasLoadedDataBefore]);

	useEffect(() => {
		if (period) {
			const dates: any = getDateTimeParams(period);
			dateFilterHandler(dates);
		}
	}, [period]);

	const isInitialLoading = isLoadingCaseData && !hasLoadedDataBefore;

	const hasValidData = isValidCaseData(customerCasesData);

	const handleSort = (key: string) => {
		const newDirection: SortDirection =
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

	const filterDropdownRef = React.useRef<{
		setOpen: (open: boolean) => void;
	}>(null);

	const handleFilterChange = React.useCallback(
		(values: FilterFormValues) => {
			const filters: Record<string, unknown> = {};

			if (values.caseType?.length) {
				values.caseType.forEach((typeLabel, index: number) => {
					const caseTypeRecord = caseTypesResponse?.data?.records.find(
						(record) => record.label.toLowerCase() === typeLabel.toLowerCase(),
					);
					if (caseTypeRecord?.id) {
						filters[`data_cases.case_type[${index}]`] = caseTypeRecord.id;
					}
				});
			}

			if (values.status?.length) {
				values.status.forEach((statusLabel, index) => {
					const statusCode = getStatusCode(statusLabel);
					if (statusCode) {
						const statusId = getStatusId(statusCode);
						if (statusId) {
							filters[`data_cases.status[${index}]`] = statusId;
						}
					}
				});
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
					dateFilters["data_cases.created_at[1]"] = endDate.toISOString();
				}
				setCurrentFilterCount(Object.keys(filters).length);
				filterHandler(filters, dateFilters);
			} else {
				setCurrentFilterCount(Object.keys(filters).length);
				filterHandler(filters);
			}
		},
		[filterHandler, caseTypesResponse?.data?.records, setCurrentFilterCount],
	);

	const caseTypes = React.useMemo(() => {
		if (!caseTypesResponse?.data?.records) return [];
		return caseTypesResponse.data.records.map((type) => {
			switch (type.label.toLowerCase()) {
				case "onboarding":
					return "Onboarding";
				case "risk":
					return "Risk";
				case "application edit":
				case "application_edit":
					return "Application Edit";
				default:
					return type.label;
			}
		});
	}, [caseTypesResponse]);

	const caseStatuses = React.useMemo(() => {
		const validStatuses = [
			"manually-rejected",
			"auto-rejected",
			"auto-approved",
			"manually-approved",
			"under-manual-review",
			"info-requested",
			"pending-decision",
			"submitted",
			"score-generated",
			"created",
			"archived",
			"information-updated",
			"onboarding",
			"risk-alert",
			"investigating",
			"dismissed",
			"paused",
			"escalated",
		];

		return validStatuses.map((status) => getStatusLabel(status));
	}, []);

	const { mutateAsync: generateReport, data: generateReportData } =
		useGenerateReport();
	const { mutateAsync: downloadReport, data: downloadReportData } =
		useDownloadReport();

	useEffect(() => {
		if (generateReportData) {
			setReportRequestedModal(true);
		}
	}, [generateReportData]);

	useEffect(() => {
		if (downloadReportData) {
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		}
	}, [downloadReportData]);

	const TableHeaderContent = () => {
		return (
			<TableHeader>
				<TableRow>
					<TableHead>Case #</TableHead>
					<SortableTableHead
						sortKey="data_cases.created_at"
						currentSort={currentSort}
						onSort={handleSort}
					>
						Date
					</SortableTableHead>
					<TableHead>Type</TableHead>
					<SortableTableHead
						sortKey="data_businesses.name"
						currentSort={currentSort}
						onSort={handleSort}
					>
						Business Name
					</SortableTableHead>
					<TableHead className="min-w-[120px]">Worth Score</TableHead>
					<TableHead className="min-w-[180px]">Status</TableHead>
					<SortableTableHead
						sortKey="data_applicants.first_name"
						currentSort={currentSort}
						onSort={handleSort}
					>
						Applicant
					</SortableTableHead>
					<TableHead className="min-w-[150px]">Assignee</TableHead>
					<TableHead>Actions</TableHead>
				</TableRow>
			</TableHeader>
		);
	};

	const TableBodyContent = () => {
		if (isLoadingCaseData) {
			return <TableContentLoadingState />;
		}

		if (!hasValidData) {
			return null;
		}

		return (
			<TableBody>
				{customerCasesData?.data.records.map((caseItem) => (
					<TableRow key={caseItem.id}>
						<TableCell
							className="text-blue-500 hover:underline cursor-pointer max-w-[200px] truncate"
							title={caseItem.id}
							onClick={() => {
								const redirectURL = generatePath(URL.CASE_DETAILS, {
									id: caseItem.id,
								});
								navigate(redirectURL);
							}}
						>
							{caseItem.id}
						</TableCell>
						<TableCell>
							{new Date(caseItem.created_at).toLocaleDateString()}
						</TableCell>
						<TableCell>
							{!caseTypesResponse ? (
								<Skeleton className="h-4 w-[60px]" />
							) : isValidCaseTypesData(caseTypesResponse) ? (
								<span className="flex gap-1">
									{getCaseTypeBadge(
										caseItem.case_type,
										caseTypesResponse.data.records,
									)}
								</span>
							) : (
								<span className="text-gray-500">-</span>
							)}
						</TableCell>
						<TableCell
							className="min-w-[200px] max-w-[200px] truncate"
							title={caseItem.business_name}
						>
							{caseItem.business_name}
						</TableCell>
						<TableCell>-</TableCell>
						<TableCell>
							<CaseStatusBadge
								variant={getCaseStatusVariant(
									caseItem.status_label?.toLowerCase(),
								)}
								label={getStatusLabel(caseItem.status_label)}
							/>
						</TableCell>
						<TableCell className="min-w-[150px]">
							{getApplicantName(caseItem.applicant)}
						</TableCell>
						<TableCell className="min-w-[150px]">
							<span>
								{concatString([
									String(caseItem?.assignee?.first_name ?? ""),
									String(caseItem?.assignee?.last_name ?? ""),
								])}
							</span>
						</TableCell>
						<TableCell>
							<div className="flex space-x-2">
								<EyeIcon
									className="w-5 h-5 text-blue-700 cursor-pointer"
									onClick={() => {
										const redirectURL = generatePath(URL.CASE_DETAILS, {
											id: caseItem.id,
										});
										navigate(redirectURL);
									}}
								/>
								<DownloadReport
									status={caseItem?.report_status}
									generateReport={generateReport}
									downloadReport={downloadReport}
									businessId={caseItem?.business_id}
									caseId={caseItem?.id}
									reportId={caseItem?.report_id}
								/>
							</div>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		);
	};

	const TableFooter = () => {
		if (isLoadingCaseData) {
			return <FooterLoadingState />;
		}

		return (
			<div className="flex items-center justify-between">
				<div className="text-sm text-gray-500">
					{!isLoadingCaseData && hasValidData ? (
						<>{getResultsDisplay(customerCasesData, currentPage)}</>
					) : (
						lastValidData && (
							<>{getResultsDisplay(lastValidData, currentPage)}</>
						)
					)}
				</div>
				{(hasValidData || lastValidData) && (
					<Pagination
						currentPage={currentPage}
						totalPages={getTotalPages(
							hasValidData,
							customerCasesData as GetCasesResponse | undefined,
							lastValidData,
						)}
						onPageChange={paginationHandler}
					/>
				)}
			</div>
		);
	};

	return (
		<div className="dashboard">
			<div className="p-4 space-y-4 bg-white rounded-2xl">
				{isInitialLoading ? (
					<HeaderLoadingState />
				) : (
					<div className="flex items-center justify-between">
						<div className="font-semibold leading-none tracking-tight">
							Cases
						</div>
						<div className="flex items-center justify-end gap-2">
							<FilterOptionsDropdown
								isDisabled={isLoadingCaseData}
								currentFilterCount={currentFilterCount}
								form={
									<FilterForm
										form={form}
										onFilterChange={handleFilterChange}
										caseTypes={caseTypes}
										caseStatuses={caseStatuses}
										onClose={() => {
											filterDropdownRef.current?.setOpen(false);
										}}
									/>
								}
							/>
							<SearchField
								disabled={isLoadingCaseData}
								placeholder="Search cases..."
								onSearch={searchTriggerHandler}
							/>
						</div>
					</div>
				)}

				{!hasValidData && !isLoadingCaseData ? (
					<EmptyState />
				) : (
					<>
						<Table>
							<TableHeaderContent />
							<TableBodyContent />
						</Table>

						<TableFooter />
					</>
				)}
			</div>

			{reportRequestedModal && (
				<WarningModal
					type="success"
					isOpen={reportRequestedModal}
					onClose={async () => {
						setReportRequestedModal(false);
						await refetTableData?.();
					}}
					title="360 Report Request Received"
					description="This report can take a few minutes to generate. We'll send you an email with your full 360 report when it's ready to be viewed."
					onSucess={async () => {
						setReportRequestedModal(false);
						await refetTableData?.();
					}}
					buttonText={"Close"}
					showCancel={false}
				/>
			)}
		</div>
	);
};
export default CaseTable;
