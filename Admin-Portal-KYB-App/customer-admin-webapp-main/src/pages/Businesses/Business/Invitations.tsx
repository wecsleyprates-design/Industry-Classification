import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as qs from "qs";
import queryString from "query-string";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import Filter from "@/components/Filter/Filter";
import {
	type TFilterOption,
	type TSelectedValueType,
} from "@/components/Filter/types";
import LongTextWrapper from "@/components/LongTextWrapper";
import Table from "@/components/Table";
import { type column } from "@/components/Table/types";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import {
	capitalize,
	convertToLocalDate,
	getSlugReplacedURL,
	getStatusType,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetBusinessInvites } from "@/services/queries/businesses.query";
import useGlobalStore from "@/store/useGlobalStore";
import { URL } from "../../../constants/URL";

interface InvitationProps {
	businessId: string;
	name: string;
}

const Invitations: React.FC<InvitationProps> = ({ businessId, name }) => {
	const navigate = useNavigate();
	const [customerId] = useState(getItem("customerId"));
	const { savedNormalPayload, setSavedNormalPayload } = useGlobalStore(
		(store) => store,
	);
	const [page, setPage] = useState<number>(
		(savedNormalPayload?.businesses?.page as number) ?? 1,
	);
	const [itemsPerPage, setItemsPerPage] = useState<number>(
		(savedNormalPayload?.businessesInvites?.items_per_page as number) ?? 10,
	);
	const [payload, setPayload] = useState<Record<string, unknown>>(
		savedNormalPayload?.businessesInvites ?? {
			pagination: true,
			page,
			items_per_page: itemsPerPage,
			sort: { created_at: "DESC" },
		},
	);

	const { checkAccess } = useFeatureAccess();

	// useEffect(() => {
	// 	const val = getSearchPayload(searchParams);
	// 	setPage(val.page ?? 1);
	// 	setItemsPerPage(val.items_per_page ?? 10);
	// 	if (val.search) {
	// 		const searchVal = Object.values(val.search);
	// 		setSearchPayload(searchVal[0] as string);
	// 	}
	// 	if (val.filter)
	// 		setFilterPayload(val.filter as Record<string, TSelectedValueType[]>);
	// 	else setFilterPayload({});
	// }, [searchParams]);

	const [tableData, setTableData] = useState({
		records: [],
		total_pages: 1,
		total_items: 0,
	});

	const { data: inviteData, isLoading } = useGetBusinessInvites(
		customerId ?? "",
		businessId ?? "",
		qs.stringify(payload),
	);

	useEffect(() => {
		if (inviteData?.status === "success") {
			const response = inviteData?.data;
			setTableData(response);
		}
	}, [inviteData]);

	const columns: column[] = [
		{
			title: "Id",
			path: "id",
			content: (item) => {
				const hasInvitePermission = checkAccess("businesses:create:invite");
				return hasInvitePermission ? (
					<a
						className="text-blue-600 truncate cursor-pointer"
						onClick={() => {
							setSavedNormalPayload({
								module: "businessesInvites",
								values: payload,
							});
							navigate(
								getSlugReplacedURL(
									URL.BUSINESS_INVITEE_DETAILS,
									[businessId, item?.id],
									[":slug", ":inviteeId"],
								),
							);
						}}
					>
						<LongTextWrapper text={item?.id} />
					</a>
				) : (
					<span className="text-gray-500 truncate cursor-not-allowed">
						<LongTextWrapper text={item?.id} />
					</span>
				);
			},
		},
		{
			title: "Invitation date",
			path: "created_at",
			alias: "created_at",
			sort: true,
			content: (item) => {
				return (
					<span>
						{convertToLocalDate(item?.created_at, "MM-DD-YYYY - h:mmA")}
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
			title: "Invited by",
			path: "created_by",
			content: (item) => (
				<div>
					<LongTextWrapper
						text={
							(item?.invited?.first_name as string) +
							" " +
							(item?.invited?.last_name as string)
						}
					/>
				</div>
			),
		},
		{
			title: "Action",
			path: "",
			content: (item) => {
				const hasInvitePermission = checkAccess("businesses:create:invite");
				return hasInvitePermission ? (
					<a
						className="text-blue-600 truncate cursor-pointer"
						onClick={() => {
							setSavedNormalPayload({
								module: "businessesInvites",
								values: payload,
							});
							navigate(
								getSlugReplacedURL(
									URL.BUSINESS_INVITEE_DETAILS,
									[businessId, item?.id],
									[":slug", ":inviteeId"],
								),
							);
						}}
					>
						View Details
					</a>
				) : (
					<span className="text-gray-500 truncate cursor-not-allowed">
						View Details
					</span>
				);
			},
		},
	];

	const FilterData: TFilterOption[] = [
		{
			title: "Status type",
			type: "checkbox",
			alias: "status",
			filterOptions: [
				{ label: "Accepted", value: "ACCEPTED" },
				{ label: "Completed", value: "COMPLETED" },
				{ label: "Invited", value: "INVITED" },
				{ label: "Expired", value: "EXPIRED" },
				{ label: "Rejected", value: "REJECTED" },
			],
		},
	];

	const filterHandler = (
		selectedValues: Record<string, TSelectedValueType[]>,
	) => {
		if (Object.keys(selectedValues).length > 0) {
			setPayload((val) => {
				return {
					...val,
					filter: {
						...selectedValues,
					},
				};
			});
		} else {
			setPayload((val) => {
				return {
					...val,
					page: 1,
					filter: undefined,
				};
			});
		}
		setPage(1);
	};

	const sortHandler = (order: string, alias: string) => {
		setPayload((val) => {
			return {
				...val,
				sort: {
					[alias]: order,
				},
			};
		});
	};

	const paginationHandler = (pageVal: number) => {
		setPayload((val) => {
			return {
				...val,
				page: pageVal,
			};
		});
		setPage(pageVal);
	};

	const itemsPerPageHandler = (itemsPerPageVal: number) => {
		setPayload((val) => {
			return {
				...val,
				page: 1,
				items_per_page: itemsPerPageVal,
			};
		});
		setPage(1);
		setItemsPerPage(itemsPerPageVal);
	};

	return (
		<>
			<div className="mt-3 bg-white border rounded-lg shadow">
				<div className="py-3.5 max-w-7xl px-4 sm:px-2 lg:px-4 border-b w-full min-w-full">
					<div className="flex flex-col justify-between sm:flex-auto sm:items-center sm:flex-row">
						<h1 className="text-base font-semibold leading-6 text-slate-800">
							Invitations
						</h1>
						<div className="flex flex-col justify-end w-full gap-2 sm:flex-row lg:gap-4">
							<Filter
								filterHandler={filterHandler}
								title={"Filter"}
								initialValues={
									payload.filter
										? (payload.filter as Record<string, TSelectedValueType[]>)
										: {}
								}
								data={FilterData}
								type="small"
							/>
							{/* <SearchBox
								placeholder="Search"
								value={
									payload.search
										? (Object.values(payload.search)[0] as string)
										: ""
								}
								onChange={searchTriggerHandler}
							/> */}
							{checkAccess("businesses:create:invite") && (
								<Button
									className="py-1.5 rounded-md"
									color="dark"
									onClick={() => {
										const labelOptioin = {
											business_id: businessId,
											businessName: name,
											check_invites: true,
										};
										const navigateURL = `${
											URL.SEND_INVITATION
										}?${queryString.stringify(labelOptioin)}`;
										navigate(navigateURL);
									}}
								>
									Send Invitation
								</Button>
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
					payload={payload}
				/>
			</div>
		</>
	);
};

export default Invitations;
