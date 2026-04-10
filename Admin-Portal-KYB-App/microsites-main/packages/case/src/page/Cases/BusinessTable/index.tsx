import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { FormProvider, useForm } from "react-hook-form";
import { generatePath, Link, useParams } from "react-router-dom";
import {
	ArrowDownTrayIcon,
	EyeIcon,
	QueueListIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { type QueryObserverResult } from "@tanstack/react-query";
import BusinessRiskToggleCell from "@/components/business-table/BusinessRiskToggleCell";
import { EmptyState } from "@/components/business-table/empty-state";
import { HeaderLoadingState } from "@/components/case-table/loading-states";
import { useCustomToast, useSearchPayload } from "@/hooks";
import CaseWrapper from "@/layouts/CaseWrapper";
import { useGetCustomersBusinessData } from "@/services/queries/customer.query";
import { type Business, type GetBusinessesResponse } from "@/types/business";

import { URL } from "@/constants";
import { ToastProvider } from "@/providers/ToastProvider";
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

const createBusinessTableColumns = (
	getBusinessRedirectURL: (id: string) => string,
	customerRiskMonitoringEnabled: boolean,
): Array<DataTableColumn<Business>> => [
	{
		label: "Name",
		accessor: "name",
		sortKey: "data_businesses.name",
		render: (name, business) => (
			<Link
				to={getBusinessRedirectURL(business.id)}
				className="text-blue-500 hover:underline max-w-[200px] truncate block cursor-pointer"
				title={name}
			>
				{name}
			</Link>
		),
	},
	{
		label: "Onboarding Date",
		accessor: "created_at",
		sortable: true,
		sortKey: "data_businesses.created_at",
		render: (date) => new Date(date).toLocaleDateString(),
	},
	{
		label: "Risk Monitoring",
		accessor: "is_monitoring_enabled",
		render: (value, business) => (
			<div className="flex justify-center">
				<BusinessRiskToggleCell
					business={business}
					customerRiskMonitoringEnabled={
						customerRiskMonitoringEnabled
					}
				/>
			</div>
		),
	},
	{
		label: "Actions",
		accessor: "id",
		render: (id, business) => (
			<div className="flex space-x-2">
				<Tooltip
					trigger={
						<Link to={getBusinessRedirectURL(id)}>
							<EyeIcon className="w-5 h-5 text-blue-700 cursor-pointer" />
						</Link>
					}
					content="View Business"
				/>
				<Tooltip
					trigger={
						<Link
							to={`${getBusinessRedirectURL(
								business.id,
							)}/audit-trail`}
						>
							<QueueListIcon className="w-5 h-5 text-blue-700 cursor-pointer" />
						</Link>
					}
					content="View Audit Trail"
				/>
			</div>
		),
	},
];

const BusinessTable: FC<{
	title?: string;
	isLoadingBusinessData: boolean;
	businessData?: GetBusinessesResponse;
	updatePayload: (newPayload: any) => void;
	refetchTableData?: () => Promise<QueryObserverResult<any, unknown>>;
	customerRiskMonitoringEnabled: boolean;
}> = ({
	title = "Businesses",
	isLoadingBusinessData,
	businessData,
	updatePayload,
	refetchTableData,
	customerRiskMonitoringEnabled,
}) => {
	const [hasLoadedDataBefore, setHasLoadedDataBefore] = useState(false);
	const [currentSort, setCurrentSort] = useState<string>("");
	const { slug: customerId } = useParams();

	const {
		payload,
		sortHandler,
		paginationHandler,
		searchHandler,
		filterHandler,
	} = useSearchPayload();

	const searchTriggerHandler = useCallback(
		(value: string) => {
			searchHandler(value, ["data_businesses.name"]);
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
		if (newDirection) {
			sortHandler(newDirection, key);
		} else {
			sortHandler(null, null);
		}
	};

	const {
		mutateAsync: getCustomerBusinessData,
		isPending: customerBusinessDataLoading,
	} = useGetCustomersBusinessData();

	const { errorToast } = useCustomToast();

	const downloadCSV = (csvData: string) => {
		try {
			const blob = new Blob([csvData], { type: "text/csv" });
			const link = document.createElement("a");
			link.href = window.URL.createObjectURL(blob);
			link.download = "businesses.csv";
			link.click();
		} catch {
			console.error("Failed to download CSV");
		}
	};

	const currentPage = payload.page ?? 1;
	const prevPayloadRef = useRef<any | undefined>(undefined);

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
		if (businessData?.data?.records?.length && !hasLoadedDataBefore) {
			setHasLoadedDataBefore(true);
		}
	}, [businessData, hasLoadedDataBefore]);

	const getBusinessRedirectURL = useCallback(
		(id: string) => generatePath(URL.BUSINESS_DETAILS, { id }),
		[],
	);

	const filterDropdownRef = useRef<{ setOpen: (open: boolean) => void }>(
		null,
	);

	const filterConfig: FilterConfigItem[] = [
		{
			type: "checkbox-group",
			name: "business_type",
			label: "Business type",
			options: [
				{ label: "Customer invited", value: "customer_invited" },
				{ label: "Standalone", value: "standalone" },
			],
		},
		{
			type: "checkbox-group",
			name: "data_subscriptions.status",
			label: "Subscription status",
			options: [
				{ label: "Not subscribed", value: "NOT_SUBSCRIBED" },
				{ label: "Subscribed", value: "SUBSCRIBED" },
				{ label: "Unsubscribed", value: "UNSUBSCRIBED" },
				{ label: "Payment failed", value: "PAYMENT_FAILED" },
				{ label: "Payment declined", value: "PAYMENT_DECLINED" },
			],
		},
		{
			type: "date-range",
			name: "created_at",
			label: "Onboarding Date",
		},
	];

	const filterSchema = createFilterSchema(filterConfig);
	const form = useForm<FilterFormValues>({
		resolver: zodResolver(filterSchema),
		defaultValues: {
			created_at: { from: undefined, to: undefined },
		},
	});

	const filteredColumns = useMemo(
		() =>
			createBusinessTableColumns(
				getBusinessRedirectURL,
				customerRiskMonitoringEnabled,
			),
		[getBusinessRedirectURL, customerRiskMonitoringEnabled],
	);

	const isInitialLoading = isLoadingBusinessData && !hasLoadedDataBefore;
	const hasValidData = !!businessData?.data?.records?.length;

	return (
		<CaseWrapper>
			<ToastProvider />
			<div className="p-8 business ">
				<Card className="p-6 space-y-4 ">
					{isInitialLoading ? (
						<HeaderLoadingState />
					) : (
						<div className="flex items-center justify-between">
							<h1 className="text-lg font-semibold">{title}</h1>
							<div className="flex items-center gap-2">
								<SearchField
									placeholder="Search"
									className="rounded-lg drop-shadow-none h-11"
									onSearch={searchTriggerHandler}
								/>
								<FormProvider {...form}>
									<FilterOptionsDropdown
										dropdownRef={filterDropdownRef}
										filterConfig={filterConfig}
										onFilterChange={filterHandler}
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
								</FormProvider>

								<Tooltip
									trigger={
										<button
											className="flex items-center justify-center w-11 h-11 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition"
											disabled={
												customerBusinessDataLoading
											}
											onClick={() => {
												void getCustomerBusinessData(
													customerId ?? "",
												)
													.then((e) => {
														if (e && !e.message) {
															downloadCSV(e);
														}
													})
													.catch((error) => {
														console.error(
															"Failed to download CSV:",
															error,
														);
														errorToast(
															"Failed to download CSV. Please try again.",
														);
													});
											}}
										>
											<ArrowDownTrayIcon className="w-5 h-5 text-gray-800" />
										</button>
									}
									content="Download CSV"
									side="top"
									align="center"
								/>
							</div>
						</div>
					)}

					{(() => {
						if (!hasLoadedDataBefore && !hasValidData) {
							return (
								<Table>
									<TableBody>
										<EmptyState />
									</TableBody>
								</Table>
							);
						}

						if (!hasValidData) {
							return (
								<Table>
									<TableBody>
										<EmptyState showNoResultsMessage />
									</TableBody>
								</Table>
							);
						}

						return (
							<>
								<DataTable<Business>
									columns={filteredColumns}
									data={businessData}
									isLoading={isLoadingBusinessData}
									currentPage={currentPage}
									onPageChange={paginationHandler}
									currentSort={currentSort}
									onSort={handleSort}
								/>
								{hasValidData && (
									<div className="border-t border-gray-200  pt-2 px-2 pb-6 flex items-center justify-between">
										{!isLoadingBusinessData ? (
											<PaginationDescription
												totalItems={
													businessData?.data
														?.total_items ?? 0
												}
												currentPage={currentPage}
												itemsPerPage={
													businessData?.data
														?.items_per_page ?? 10
												}
											/>
										) : (
											<Skeleton className="h-5 w-[200px]" />
										)}

										{businessData?.data ? (
											<Pagination
												currentPage={currentPage}
												totalPages={
													businessData?.data
														?.total_pages ?? 1
												}
												onPageChange={paginationHandler}
											/>
										) : (
											<Skeleton className="h-9 w-[120px]" />
										)}
									</div>
								)}
							</>
						);
					})()}
				</Card>
			</div>
		</CaseWrapper>
	);
};

export default BusinessTable;
