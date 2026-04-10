import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Link, useSearchParams } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/20/solid";
import * as qs from "qs";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import Filter from "@/components/Filter/Filter";
import {
	type TFilterOption,
	type TSelectedValueType,
} from "@/components/Filter/types";
import LongTextWrapper from "@/components/LongTextWrapper";
import SearchBox from "@/components/SearchBox";
import Table from "@/components/Table";
import { type column } from "@/components/Table/types";
import useSearchPayload from "@/hooks/useSearchPayload";
import {
	capitalize,
	getSearchPayload,
	getSlugReplacedURL,
	getStatusType,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetUsers } from "@/services/queries/user.query";
import useAuthStore from "@/store/useAuthStore";
import { type GetCustomerUserData } from "@/types/users";
import { URL } from "../../constants/URL";

import { MODULES } from "@/constants/Modules";

const Users = () => {
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);
	const [customerId] = useState(getItem("customerId"));
	const [searchParams] = useSearchParams();
	const [page, setPage] = useState<number>(
		parseInt(searchParams.get("page") ?? "1"),
	);
	const [filterPayload, setFilterPayload] = useState({});
	const [searchPayload, setSearchPayload] = useState("");
	const [itemsPerPage, setItemsPerPage] = useState<number>(
		parseInt(searchParams.get("itemsPerPage") ?? "10"),
	);

	const {
		payload,
		searchHandler,
		filterHandler,
		sortHandler,
		paginationHandler,
		itemsPerPageHandler,
	} = useSearchPayload({ pagination: false });

	useEffect(() => {
		const val = getSearchPayload(searchParams);
		setPage(val.page ?? 1);
		setItemsPerPage(val.items_per_page ?? 10);
		if (val.search) {
			const searchVal = Object.values(val.search);
			setSearchPayload(searchVal[0] as string);
		}
		if (val.filter)
			setFilterPayload(val.filter as Record<string, TSelectedValueType[]>);
		else setFilterPayload({});
	}, [searchParams]);

	const [tableData, setTableData] = useState<GetCustomerUserData>({
		records: [],
		total_pages: 1,
		total_items: 0,
	});

	const { data: usersData, isLoading } = useGetUsers(
		customerId ?? "",
		qs.stringify({
			...payload,
			owner_required: true,
		}),
	);

	useEffect(() => {
		if (usersData?.status === "success") {
			const response = usersData?.data;
			setTableData(response);
		}
	}, [usersData]);

	const columns: column[] = [
		{
			title: "User id",
			path: "user_id",
			content: (item) => (
				<Link
					className="text-blue-600"
					to={getSlugReplacedURL(URL.USER_DETAILS, item?.id)}
				>
					<LongTextWrapper text={item?.id} />
				</Link>
			),
		},
		{
			title: "User name",
			path: "username",
			sort: true,
			alias: "first_name",
			content: (item) => {
				return (
					<span className="truncate">
						{(item?.first_name as string) + " " + (item?.last_name as string)}
					</span>
				);
			},
		},
		{ title: "Email id", path: "email" },
		{
			title: "Role",
			path: "role",
			content: (item) => {
				return (
					<span className="truncate">
						{item?.subrole?.display_name || (item?.subrole?.label as string)}
					</span>
				);
			},
		},
		{
			title: "Status",
			path: "status",
			content: (item) => {
				return (
					<StatusBadge
						className="truncate"
						type={getStatusType(item?.status)}
						text={capitalize(item?.status)?.replace(/_/g, " ")}
					/>
				);
			},
		},
		{
			title: "Action",
			path: "",
			content: (item) => (
				<Link
					className="text-blue-600 truncate"
					to={getSlugReplacedURL(URL.USER_DETAILS, item?.id)}
				>
					View details
				</Link>
			),
		},
	];

	const FilterData: TFilterOption[] = [
		{
			title: "Status type",
			type: "checkbox",
			alias: "status",
			filterOptions: [
				{ label: "Active", value: "ACTIVE" },
				{ label: "Inactive", value: "INACTIVE" },
				{ label: "Invited", value: "INVITED" },
				{ label: "Invite Expired", value: "INVITE_EXPIRED" },
			],
		},
	];

	const searchTriggerHandler = (value: string) => {
		searchHandler(value, [
			"data_customers.name",
			"first_name",
			"last_name",
			"email",
		]);
	};

	return (
		<>
			<div className="bg-white border rounded-lg shadow">
				<div className="py-3.5 max-w-7xl px-4 sm:px-2 lg:px-4 border-b w-full min-w-full">
					<div className="flex flex-col justify-between sm:flex-auto sm:items-center sm:flex-row">
						<h1 className="text-base font-semibold leading-6 text-slate-800">
							Users
						</h1>
						<div className="flex flex-col justify-end w-full gap-2 sm:flex-row lg:gap-4">
							<Filter
								filterHandler={filterHandler}
								title={"Filter"}
								initialValues={filterPayload}
								data={FilterData}
								type="small"
							/>
							<SearchBox
								placeholder="Search by user, email"
								value={searchPayload}
								onChange={searchTriggerHandler}
							/>
							{permissions[MODULES.CUSTOMER_USER]?.create && (
								<div className="">
									<Button
										onClick={() => {
											navigate(URL.CREATE_USER);
										}}
										type="button"
										icon={
											<PlusIcon
												className="-ml-0.5 h-5 sm:w-5 "
												aria-hidden="true"
											/>
										}
										className="inline-flex h-8 w-full items-center gap-x-1.5 rounded-md bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
									>
										Add new user
									</Button>
								</div>
							)}
						</div>
					</div>
				</div>
				<Table
					columns={columns}
					tableData={tableData}
					isLoading={isLoading}
					page={page}
					itemsPerPage={itemsPerPage}
					sortHandler={sortHandler}
					paginationHandler={paginationHandler}
					itemsPerPageHandler={itemsPerPageHandler}
				/>
			</div>
		</>
	);
};

export default Users;
