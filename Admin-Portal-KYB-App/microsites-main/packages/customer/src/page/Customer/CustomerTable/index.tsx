import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useForm } from "react-hook-form";
import { generatePath, Link } from "react-router-dom";
import { EyeIcon, PlusIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { type QueryObserverResult } from "@tanstack/react-query";
import { type CustomerRowData } from "@/components/Table/types";
import { useSearchPayload } from "@/hooks/useSearchPayload";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import { getCustomerStatusLabel } from "@/lib/helper";
import { setItem } from "@/lib/localStorage";

import { URL } from "@/constants";
import { ToastProvider } from "@/providers/ToastProvider";
import { CaseStatusBadge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { DataTable, type DataTableColumn } from "@/ui/DataTable/DataTable";
import { EmptyState } from "@/ui/empty-state";
import {
	type FilterConfigItem,
	FilterForm,
	type FilterFormValues,
} from "@/ui/filter-form";
import { createFilterSchema } from "@/ui/filter-form-schema";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { HeaderLoadingState } from "@/ui/loading-states";
import { Pagination } from "@/ui/Pagination";
import { PaginationDescription } from "@/ui/PaginationDescription";
import { SearchField } from "@/ui/search-field";
import { Skeleton } from "@/ui/skeleton";
import { Table, TableBody } from "@/ui/table";

const TypeBadge = ({ label }: { label: "Production" | "Sandbox" }) => {
	const styles =
		label === "Production"
			? "bg-green-100 text-green-700"
			: "bg-blue-100 text-blue-700";
	return (
		<span
			className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${styles}`}
		>
			{label}
		</span>
	);
};

const setCustomerIdToLocalStorage = (id: string) => {
	setItem("customerId", id);
};

const createCustomerTableColumns = (
	getCustomerRedirectURL: (id: string) => string,
): Array<DataTableColumn<CustomerRowData>> => [
	{
		label: "Customer ID",
		accessor: "customerId",
		render: (id: string) => {
			const displayId = id.length > 9 ? `${id.slice(0, 8)}...` : id;

			return (
				<Link
					to={getCustomerRedirectURL(id)}
					onClick={() => {
						setCustomerIdToLocalStorage(id);
					}}
					className="text-blue-500 hover:underline cursor-pointer"
				>
					{displayId}
				</Link>
			);
		},
	},
	{
		label: "Business Name",
		accessor: "businessName",
		sortable: true,
		sortKey: "data_customers.name",
	},
	{
		label: "Account Type",
		accessor: "type",
		render: (type) => <TypeBadge label={type.label} />,
	},
	{
		label: "Onboarding Date",
		accessor: "onboardingDate",
		sortable: true,
		sortKey: "data_customers.created_at",
		render: (date) => new Date(date).toLocaleDateString(),
	},
	{
		label: "Customer Owner",
		accessor: "owner",
		sortable: true,
		sortKey: "first_name",
	},
	{
		label: "Status",
		accessor: "status",
		render: (status) => {
			// status.variant is already a CustomerStatusVariant from Customer.tsx mapping
			// status.label contains the raw API status for display
			const label = getCustomerStatusLabel(status.label);
			return <CaseStatusBadge variant={status.variant} label={label} />;
		},
	},
	{
		label: "Actions",
		accessor: "customerId",
		render: (id) => (
			<Link
				to={getCustomerRedirectURL(id)}
				onClick={() => {
					setCustomerIdToLocalStorage(id);
				}}
			>
				<EyeIcon className="h-5 w-5 cursor-pointer text-blue-700 mr-3" />
			</Link>
		),
	},
];

const CustomerTable: FC<{
	title?: string;
	isLoadingCustomerData: boolean;
	customerData?: any;
	updatePayload: (newPayload: any) => void;
	refetchTableData?: () => Promise<QueryObserverResult<any, unknown>>;
}> = ({
	title = "Customers",
	isLoadingCustomerData,
	customerData,
	updatePayload,
	refetchTableData,
}) => {
	const [hasLoadedDataBefore, setHasLoadedDataBefore] = useState(false);
	const [currentSort, setCurrentSort] = useState<string>("");

	const {
		payload,
		searchHandler,
		filterHandler,
		sortHandler,
		paginationHandler,
	} = useSearchPayload({
		pagination: true,
		defaultSort: "data_customers.created_at",
	});
	const prevPayloadRef = useRef<any | undefined>(undefined);

	const getCustomerRedirectURL = useCallback(
		(id: string) => generatePath("/customers/:id", { id }),
		[],
	);

	const filterDropdownRef = useRef<{ setOpen: (open: boolean) => void }>(null);

	const filterConfig: FilterConfigItem[] = [
		{
			type: "checkbox-group",
			name: "statusType",
			label: "Status Type",
			options: [
				{ label: "Active", value: "ACTIVE" },
				{ label: "Invited", value: "INVITED" },
				{ label: "Invite expired", value: "INVITE_EXPIRED" },
				{ label: "Inactive", value: "INACTIVE" },
			],
		},
		{ type: "date-range", name: "created_at", label: "Onboarding Date" },
	];

	const filterSchema = createFilterSchema(filterConfig);

	const form = useForm<FilterFormValues>({
		resolver: zodResolver(filterSchema),
		defaultValues: {
			created_at: { from: undefined, to: undefined },
			statusType: [],
		},
	});

	const handleFilterChange = useCallback(
		(values: FilterFormValues) => {
			const filters: Record<string, unknown> = {};
			if (values.statusType?.length) {
				filters.status = values.statusType;
			}
			const dateFilters: Record<string, string> = {};
			if (values.created_at?.from)
				dateFilters["data_customers.created_at[0]"] =
					values.created_at.from.toISOString();
			if (values.created_at?.to) {
				const endDate = new Date(values.created_at.to);
				endDate.setHours(23, 59, 59, 999);
				dateFilters["data_customers.created_at[1]"] = endDate.toISOString();
			}
			filterHandler(filters, dateFilters);
		},
		[filterHandler],
	);

	const searchTriggerHandler = (value: string) => {
		searchHandler(value, ["first_name", "last_name", "data_customers.name"]);
	};

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

	const currentPage = payload.page ?? 1;

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
		if (customerData?.data?.records?.length && !hasLoadedDataBefore)
			setHasLoadedDataBefore(true);
	}, [customerData, hasLoadedDataBefore]);

	const filteredColumns = useMemo(
		() => createCustomerTableColumns(getCustomerRedirectURL),
		[getCustomerRedirectURL],
	);

	const isInitialLoading = isLoadingCustomerData && !hasLoadedDataBefore;
	const hasValidData = !!customerData?.data?.records?.length;

	return (
		<CustomerWrapper>
			<ToastProvider />
			<div className="customer bg-gray-100">
				<Card className="p-3 space-y-4">
					{isInitialLoading ? (
						<HeaderLoadingState />
					) : (
						<div className="flex items-center justify-between">
							<h1 className="text-lg font-semibold ml-5">{title}</h1>
							<div className="flex items-center gap-2">
								<SearchField
									placeholder="Search"
									className="rounded-lg drop-shadow-none h-11"
									onSearch={searchTriggerHandler}
								/>
								<FilterOptionsDropdown
									dropdownRef={filterDropdownRef}
									form={
										<FilterForm
											form={form}
											onFilterChange={handleFilterChange}
											filterConfig={filterConfig}
											onClose={() => filterDropdownRef.current?.setOpen(false)}
										/>
									}
								/>
								<Link
									to={URL.CREATE_CUSTOMER}
									className="flex items-center justify-center w-11 h-11 rounded-full bg-blue-600 text-white hover:bg-blue-700"
								>
									<PlusIcon className="w-5 h-5" />
								</Link>
							</div>
						</div>
					)}
					{!hasLoadedDataBefore && !hasValidData ? (
						<DataTable<CustomerRowData>
							columns={filteredColumns}
							data={{ data: [], status: "success", message: "" }}
							currentPage={currentPage}
							onPageChange={paginationHandler}
							currentSort={currentSort}
							onSort={handleSort}
							isLoading={isInitialLoading}
						/>
					) : !hasValidData && !isLoadingCustomerData ? (
						<Table>
							<TableBody>
								<EmptyState showNoResultsMessage />
							</TableBody>
						</Table>
					) : (
						<>
							<DataTable<CustomerRowData>
								columns={filteredColumns}
								data={customerData}
								currentPage={currentPage}
								onPageChange={paginationHandler}
								currentSort={currentSort}
								onSort={handleSort}
								isLoading={isLoadingCustomerData}
							/>
							{hasValidData && (
								<div className=" border-gray-200 pt-2 px-6 pb-6 flex items-center justify-between">
									{!isLoadingCustomerData ? (
										<PaginationDescription
											data={customerData}
											currentPage={currentPage}
											itemsPerPage={payload.items_per_page ?? 10}
										/>
									) : (
										<Skeleton className="h-5 w-[200px]" />
									)}
									{customerData?.data ? (
										<Pagination
											currentPage={currentPage}
											totalPages={customerData?.data?.total_pages ?? 1}
											onPageChange={paginationHandler}
										/>
									) : (
										<Skeleton className="h-9 w-[120px]" />
									)}
								</div>
							)}
						</>
					)}
				</Card>
			</div>
		</CustomerWrapper>
	);
};

export default CustomerTable;
