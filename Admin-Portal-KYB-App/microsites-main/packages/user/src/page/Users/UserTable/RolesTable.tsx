import React, { useCallback, useState } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { PencilSquareIcon, UsersIcon } from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import { twMerge } from "tailwind-merge";
import { useSearchPayload } from "@/hooks";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { getItem } from "@/lib/localStorage";
import {
	useAllSubrolePermissions,
	useGetCustomerRoles,
} from "@/services/queries/roles.query";
import { type PaginatedApiRequest } from "@/types/PaginatedAPIRequest";
import { EmptyState } from "./EmptyState";
import RolePermissionsTable from "./RolePermissionsTable";
import RolesTableSkeleton from "./RolesTableSkeleton";

import { LOCALSTORAGE } from "@/constants";
import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { URL } from "@/constants/URL";
import { Badge } from "@/ui/badge";
import { Pagination } from "@/ui/Pagination";
import { PaginationDescription } from "@/ui/PaginationDescription";
import { SearchField } from "@/ui/search-field";
import { Skeleton } from "@/ui/skeleton";

const RoleTable = () => {
	const customerId = getItem<string>(LOCALSTORAGE.customerId) ?? "";
	const [openRole, setOpenRole] = useState<string | null>(null);
	const navigate = useNavigate();
	const flags = useFlags();
	const { payload, paginationHandler, searchHandler } =
		useSearchPayload<PaginatedApiRequest>({
			defaultSort: "data_subroles.created_at",
			defaultSortDirection: "ASC",
		});

	const currentPage = payload.page ?? 1;

	const { data: rolesData, isLoading } = useGetCustomerRoles(
		customerId,
		payload,
	);

	const { data, mutateAsync: fetchPermissions } = useAllSubrolePermissions();

	const searchTriggerHandler = useCallback(
		(value: string) => {
			if (!value.trim()) {
				searchHandler("", []);
				return;
			}
			searchHandler(value, ["data_subroles.code", "data_subroles.label"]);
		},
		[searchHandler],
	);

	const roleNameMap: Record<string, string> = {
		CRO: "Admin",
	};

	const roleDescriptionMap: Record<string, string> = {
		cro: "Administers workspace settings and user access",
		risk_analyst: "Performs application reviews and risk assessments",
	};

	const hasRoleCreateAccess = useFeatureAccess("roles:create");
	const hasRoleWriteAccess = useFeatureAccess("roles:write");

	return (
		<div className="bg-white border rounded-lg shadow">
			<div className="m-4 rounded-lg">
				{/* Roles Table Header */}
				<div className="px-2 py-4 border-b sm:px-4">
					<div className="flex flex-col justify-between sm:flex-auto sm:items-center sm:flex-row">
						<div className="mb-4 sm:mb-0">
							<h2 className="text-base font-semibold leading-6 text-slate-800">
								Roles
							</h2>
							<p className="mt-1 text-sm text-gray-500">
								Roles are shared permission sets that can be assigned
								individually.
							</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:gap-2 lg:gap-4">
							<div className="relative w-full sm:w-[283px]">
								<SearchField
									className="default"
									placeholder="Search"
									onSearch={searchTriggerHandler}
								/>
							</div>

							{flags[FEATURE_FLAGS.PAT_779_CREATE_AND_UPDATE_CUSTOM_SUBROLES] &&
								hasRoleCreateAccess && (
									<button
										onClick={() => {
											navigate(URL.ROLES_CREATE);
										}}
										className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700"
									>
										Create Role
									</button>
								)}
						</div>
					</div>
				</div>

				{isLoading ? (
					<RolesTableSkeleton />
				) : (
					<div className="flex flex-col gap-4 p-2 sm:p-4">
						{rolesData?.data?.records.length === 0 ? (
							<EmptyState type="role" />
						) : (
							rolesData?.data?.records.map((role) => (
								<div
									key={role.subrole.id}
									className="flex flex-col p-3 border border-gray-200 sm:p-4 rounded-xl"
								>
									{/* Row */}
									<div className="flex gap-3 font-semibold sm:flex-row sm:items-center sm:justify-between">
										{/* Left side */}
										<div
											className="flex items-center flex-1 min-w-0 gap-2 cursor-pointer"
											onClick={async () => {
												if (!openRole) {
													await fetchPermissions({
														customerId,
														subroleId: role.subrole.id,
													});
												}
												setOpenRole(
													openRole === role.subrole.id ? null : role.subrole.id,
												);
											}}
										>
											{openRole === role.subrole.id ? (
												<div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-[#F3F4F6]">
													<ChevronUpIcon className="w-5 h-5 text-gray-500" />
												</div>
											) : (
												<div className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-[#F3F4F6]">
													<ChevronDownIcon className="w-5 h-5 text-gray-500" />
												</div>
											)}

											<span className="text-sm leading-6 tracking-normal truncate sm:text-base font-inter text-slate-600">
												{roleNameMap[role.subrole.label] ?? role.subrole.label}
											</span>

											<Badge variant={role.is_custom ? "info" : "secondary"}>
												{role.is_custom ? "Custom" : "Default"}
											</Badge>
										</div>
										{/* Right side */}
										<div className="flex items-center gap-2 ml-10 text-sm text-gray-600 sm:gap-4 sm:ml-0">
											<button
												disabled
												className="w-auto h-[30px] rounded-md px-2 sm:px-2.5 py-1.5 text-gray-500 font-normal text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 cursor-not-allowed"
											>
												<UsersIcon className="bg-white size-3 sm:size-4" />
												<span className="hidden sm:inline">
													{role.users_count} Users
												</span>
												<span className="sm:hidden">{role.users_count}</span>
											</button>

											{flags[
												FEATURE_FLAGS.PAT_779_CREATE_AND_UPDATE_CUSTOM_SUBROLES
											] &&
												hasRoleWriteAccess && (
													<button
														onClick={() => {
															if (role.is_custom)
																navigate(
																	generatePath(URL.ROLES_EDIT, {
																		id: role.subrole.id,
																	}),
																);
														}}
														className={twMerge(
															"w-auto rounded-md px-2 sm:px-2.5 py-1.5 text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 border border-gray-300",
															role.is_custom
																? "bg-white text-gray-800 hover:bg-gray-100"
																: "bg-white text-gray-500 cursor-not-allowed",
														)}
													>
														<PencilSquareIcon
															className={twMerge(
																"w-3 h-3 sm:w-4 sm:h-4 text-gray-800",
																!role.is_custom && "text-gray-500",
															)}
														/>
														<span className="hidden sm:inline">Edit</span>
													</button>
												)}
										</div>
									</div>

									{/* Description */}
									<p className="pb-2 mt-3 ml-0 text-sm text-gray-500 border-gray-200 sm:ml-10">
										{roleDescriptionMap[role.subrole.code] ??
											role.subrole.description}
										{role.subrole.description.length > 0 && "."}
									</p>

									{/* Expanded Permissions */}
									<div
										className={twMerge(
											"transition-all duration-200 ease-out",
											openRole === role.subrole.id
												? "max-h-none opacity-100"
												: "max-h-0 opacity-0 overflow-hidden",
										)}
									>
										{openRole === role.subrole.id && (
											<div className="pt-4 transition-transform duration-150 ease-out transform">
												<RolePermissionsTable
													id={role.subrole.id}
													permissions={data?.data.permissions ?? []}
												/>
											</div>
										)}
									</div>
								</div>
							))
						)}
					</div>
				)}

				<div className="flex items-center justify-between px-6 pb-6">
					{!isLoading ? (
						<PaginationDescription
							totalItems={rolesData?.data.total_items}
							currentPage={currentPage}
							itemsPerPage={payload.items_per_page ?? 10}
						/>
					) : (
						<Skeleton className="h-6 w-[200px]" />
					)}
					{rolesData?.data ? (
						<Pagination
							currentPage={currentPage}
							totalPages={rolesData?.data?.total_pages ?? 1}
							onPageChange={paginationHandler}
						/>
					) : (
						<Skeleton className="h-8 w-[300px]" />
					)}
				</div>
			</div>
		</div>
	);
};

export default RoleTable;
