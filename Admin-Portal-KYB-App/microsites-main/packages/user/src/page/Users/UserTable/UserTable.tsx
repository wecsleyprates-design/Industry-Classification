import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { EyeIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { UserStatusBadge } from "@/components/UserStatusBadge";
import { usePrevious, useSearchPayload } from "@/hooks";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { UserWrapper } from "@/layouts/UserWrapper";
import { type PaginatedApiRequest } from "@/types/PaginatedAPIRequest";
import { type PaginatedAPIResponse } from "@/types/PaginatedAPIResponse";
import { type User } from "@/types/User";
import { TableContentLoadingState } from "./TableContentLoadingState";

import { URL } from "@/constants";
import { EmptyState } from "@/page/Users/UserTable/EmptyState";
import { ToastProvider } from "@/providers/ToastProvider";
import { Button } from "@/ui/button";
import { Card, CardTitle } from "@/ui/card";
import {
	type FilterConfigItem,
	FilterForm,
	type FilterFormValues,
} from "@/ui/filter-form";
import { createFilterSchema } from "@/ui/filter-form-schema";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { Pagination } from "@/ui/Pagination";
import { PaginationDescription } from "@/ui/PaginationDescription";
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

type UserTableProps<
	P extends PaginatedApiRequest,
	R extends PaginatedAPIResponse<User>,
> = {
	data: R | undefined;
	isLoading: boolean;
	isInitialLoading?: boolean;
	getDetailURL: (id: string) => string;
	onCreateClick?: () => void;
	onUpdateParams: (newPayload: P) => void;
};

export function UserTable<
	P extends PaginatedApiRequest,
	R extends PaginatedAPIResponse<User>,
>({
	data,
	isLoading,
	isInitialLoading = false,
	getDetailURL,
	onCreateClick,
	onUpdateParams,
}: UserTableProps<P, R>): ReactNode {
	const navigate = useNavigate();
	const {
		query,
		payload,
		paginationHandler,
		searchHandler,
		sortHandler,
		filterHandler,
	} = useSearchPayload<P>();

	const searchTriggerHandler = useCallback(
		(value: string) => {
			if (!value.trim()) {
				searchHandler("", []);
				return;
			}
			searchHandler(value, ["first_name", "last_name", "email", "mobile"]);
		},
		[searchHandler],
	);
	const currentPage = payload.page ?? 1;

	const getSortableColumn = (sortKey: string) => {
		const sortOrder = (payload.sort as Record<string, string> | undefined)?.[
			sortKey
		] as "asc" | "desc" | undefined;

		const handleSort = () => {
			let newOrder: "asc" | "desc" | null;
			if (sortOrder === undefined) {
				newOrder = "asc";
			} else if (sortOrder === "asc") {
				newOrder = "desc";
			} else {
				newOrder = null;
			}
			sortHandler(newOrder, sortKey);
		};

		return { sortOrder, handleSort };
	};

	const { sortOrder: emailSortOrder, handleSort: handleEmailSort } =
		getSortableColumn("email");
	const { sortOrder: usernameSortOrder, handleSort: handleUsernameSort } =
		getSortableColumn("first_name");

	// Prevent infinite render loop: only propagate payload when its deep value changes
	const prevPayload = usePrevious(payload);
	const onUpdateParamsRef = useRef(onUpdateParams);

	// Keep ref updated with latest function
	useEffect(() => {
		onUpdateParamsRef.current = onUpdateParams;
	}, [onUpdateParams]);

	useEffect(() => {
		if (!payload) return;
		const hasChanged = JSON.stringify(payload) !== JSON.stringify(prevPayload);
		if (hasChanged) {
			onUpdateParamsRef.current(payload);
		}
	}, [payload, prevPayload]);

	const filterDropdownRef = useRef<{
		setOpen: (open: boolean) => void;
	} | null>(null);

	const filterConfig: FilterConfigItem[] = [
		{
			type: "checkbox-group",
			name: "statusType",
			label: "Status Type",
			options: [
				{ label: "Active", value: "ACTIVE" },
				{ label: "Invited", value: "INVITED" },
				{ label: "Inactive", value: "INACTIVE" },
				{ label: "Invite expired", value: "INVITE_EXPIRED" },
			],
		},
	];

	const handleFilterChange = useCallback(
		(values: FilterFormValues) => {
			const filters: Record<string, unknown> = {};
			if (values.statusType?.length) {
				filters.status = values.statusType;
			}
			filterHandler(filters);
		},
		[filterHandler],
	);
	const filterSchema = createFilterSchema(filterConfig);

	const form = useForm<FilterFormValues>({
		resolver: zodResolver(filterSchema),
		defaultValues: {
			statusType: [],
		},
	});

	const hasUserReadAccess = useFeatureAccess("customer_user:read");
	const hasUserCreateAccess = useFeatureAccess("customer_user:create");

	// ---------------- RENDER ----------------
	return hasUserReadAccess ? (
		<UserWrapper>
			<ToastProvider />
			{/* 🔹 USERS TAB */}
			<div className="user">
				<Card className="space-y-4">
					<div className="flex items-center justify-between px-6 pt-6">
						<CardTitle>Users</CardTitle>
						<div className="flex items-center gap-2">
							<SearchField
								placeholder="Search"
								defaultValue={query ?? ""}
								onSearch={searchTriggerHandler}
								className="h-11"
							/>

							<FormProvider {...form}>
								<FilterOptionsDropdown
									dropdownRef={filterDropdownRef}
									filterConfig={filterConfig}
									onFilterChange={handleFilterChange}
									onClose={() => filterDropdownRef.current?.setOpen(false)}
									form={<FilterForm form={form} filterConfig={filterConfig} />}
								/>
							</FormProvider>

							{hasUserCreateAccess && (
								<Button
									onClick={() => {
										if (onCreateClick) {
											onCreateClick();
										} else {
											navigate(URL.CREATE_USER);
										}
									}}
									className="w-11 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center p-0 shadow-sm"
								>
									<PlusIcon className="w-5 h-5" />
								</Button>
							)}
						</div>
					</div>

					{isLoading ? (
						<TableContentLoadingState />
					) : data?.data?.records?.length ? (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-40">User ID</TableHead>
										<TableHead>
											<div
												className="flex items-center gap-1 cursor-pointer select-none"
												onClick={handleUsernameSort}
											>
												<span>User Name</span>
												<ChevronDownIcon
													className={`w-5 h-5 transition-transform bg-gray-100 rounded ${
														usernameSortOrder === "desc" ? "rotate-180" : ""
													}`}
													style={{
														width: 20,
														height: 20,
														color: "#1F2937",
														opacity: 1,
													}}
												/>
											</div>
										</TableHead>
										<TableHead>
											<div
												className="flex items-center gap-1 cursor-pointer select-none"
												onClick={handleEmailSort}
											>
												<span>Email Address</span>
												<ChevronDownIcon
													className={`w-5 h-5 transition-transform bg-gray-100 rounded ${
														emailSortOrder === "desc" ? "rotate-180" : ""
													}`}
													style={{
														width: 20,
														height: 20,
														color: "#1F2937",
														opacity: 1,
													}}
												/>
											</div>
										</TableHead>

										<TableHead>User Role</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Actions</TableHead>
									</TableRow>
								</TableHeader>

								<TableBody>
									{data.data.records.map((user) => (
										<TableRow key={user.id}>
											<TableCell className="max-w-[200px] truncate">
												<Link
													to={getDetailURL(user.id)}
													className="text-blue-500 cursor-pointer hover:underline"
												>
													#{user.id.slice(0, 8).toUpperCase()}...
												</Link>
											</TableCell>

											<TableCell>
												{user.first_name} {user.last_name}
											</TableCell>
											<TableCell>{user.email}</TableCell>
											<TableCell>{user.subrole?.label}</TableCell>
											<TableCell>
												<UserStatusBadge user={user} />
											</TableCell>
											<TableCell>
												<Link to={getDetailURL(user.id)}>
													<EyeIcon className="w-5 h-5 text-blue-700 cursor-pointer ml-3 " />
												</Link>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</>
					) : (
						<EmptyState type="user" />
					)}

					<div className="flex items-center justify-between px-6 pb-6">
						{!isLoading ? (
							<PaginationDescription
								totalItems={data?.data?.total_items ?? 0}
								currentPage={currentPage}
								itemsPerPage={payload.items_per_page ?? 10}
							/>
						) : (
							<Skeleton className="h-6 w-[200px]" />
						)}
						{data?.data ? (
							<Pagination
								currentPage={currentPage}
								totalPages={data?.data?.total_pages ?? 1}
								onPageChange={paginationHandler}
							/>
						) : (
							<Skeleton className="h-8 w-[300px]" />
						)}
					</div>
				</Card>
			</div>
		</UserWrapper>
	) : null;
}
