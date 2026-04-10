import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { type TFilterOption } from "@/components/Filter/types";
import useSearchPayload from "@/hooks/useSearchPayload";
import { capitalize } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useGetCasesQuery,
	useGetCaseStatuses,
	useGetCaseTypes,
} from "@/services/queries/case.query";
import { useGetUsers } from "@/services/queries/user.query";
import useGlobalStore from "@/store/useGlobalStore";
import { type IPayload, type TOption } from "@/types/common";
import CasesTable from "./CasesTable";

const AllCases = () => {
	const [customerId] = useState(getItem("customerId") ?? "");
	const [, setSearchParams] = useSearchParams();
	const { savedPayload } = useGlobalStore((store) => store);
	const [caseTypes, setCaseTypes] = useState<TOption[]>([]);
	const { data: caseStatusesResponse } = useGetCaseStatuses();

	const statusOptions = useMemo(() => {
		return caseStatusesResponse?.data.map((v: any) => {
			return {
				value: String(v?.id ?? ""),
				label: capitalize(v?.label),
			};
		});
	}, [caseStatusesResponse]);

	const [customerUsers, setCustomerUsers] = useState<TOption[]>([]);

	const [caseTypesPayload] = useState<IPayload>({
		pagination: false,
	});
	const userID: string = getItem("userId") ?? "";
	const { data: caseTypesResponse } = useGetCaseTypes(caseTypesPayload);
	// Fetch all customer users
	const { data: customerUsersDataResponse } = useGetUsers(customerId, "");

	useEffect(() => {
		if (caseTypesResponse) {
			const caseTypesData = caseTypesResponse.data.records.reduce(
				(acc: TOption[], item: { id: number; label: any }) => {
					acc.push({
						label: capitalize(item.label),
						value: item.id.toString(),
					});
					return acc;
				},
				[],
			);

			setCaseTypes(caseTypesData);
		}
		// If customer users exists then dynamically create array of customerUsers taht would later be used to fill up filter dropdown
		if (customerUsersDataResponse) {
			const customerUsersData = customerUsersDataResponse.data.records.reduce(
				(
					acc: TOption[],
					item: { id: string; first_name: string; last_name: string },
				) => {
					if (item.id !== userID) {
						acc.push({
							label: item.first_name + " " + item.last_name,
							value: item.id,
						});
					}
					return acc;
				},
				[],
			);

			setCustomerUsers(customerUsersData);
		}
	}, [caseTypesResponse, customerUsersDataResponse]);

	const FilterData: TFilterOption[] = [
		{
			title: "Case type",
			type: "checkbox",
			alias: "data_cases.case_type",
			filterOptions: caseTypes,
			configs: { cols: 1 },
		},
		{
			title: "Status type",
			type: "multi-select-dropdown",
			alias: "data_cases.status",
			filterOptions: statusOptions ?? [
				{ value: "10", label: "Pending decision" },
				{ value: "11", label: "Information requested" },
				{ value: "3", label: "Onboarding" },
				{ value: "4", label: "Under manual review" },
				{ value: "5", label: "Manually approved" },
				{ value: "6", label: "Auto approved" },
				{ value: "7", label: "Score calculated" },
				{ value: "9", label: "Archived" },
				{ value: "12", label: "Submitted" },
				{ value: "13", label: "Auto rejected" },
				{ value: "8", label: "Manually rejected" },
			],
		},
		{
			title: "Date & time",
			type: "date-range",
			alias: "data_cases.created_at",
		},
		{
			title: "Assigned to",
			type: "multi-select-dropdown",
			alias: "data_cases.assignee",
			filterOptions: [
				{ label: "Me", value: userID },
				{ label: "Unassigned", value: "unassigned" },
				...customerUsers,
			],
		},
	];

	const {
		payload,
		sortHandler,
		paginationHandler,
		itemsPerPageHandler,
		searchHandler,
		filterHandler,
		dateFilterHandler,
	} = useSearchPayload();

	useEffect(() => {
		setSearchParams((prev) => {
			return savedPayload?.all ? savedPayload?.all : prev;
		});
	}, []);

	const [tableData, setTableData] = useState({
		records: [],
		total_items: 0,
		total_pages: 1,
	});

	const {
		data: customerCasesData,
		isLoading,
		refetch: refetchCases,
	} = useGetCasesQuery({
		customerId,
		params: payload,
	});

	useEffect(() => {
		if (customerCasesData?.status === "success") {
			const response = customerCasesData?.data;
			setTableData(response);
		}
	}, [customerCasesData]);

	const searchTriggerHandler = (value: string) => {
		searchHandler(value, [
			"data_cases.id",
			"data_businesses.name",
			"first_name",
			"last_name",
			"applicant_id",
		]);
	};

	return (
		<CasesTable
			tableName="all"
			customerId={customerId}
			tableData={tableData}
			FilterData={FilterData}
			isLoading={isLoading}
			payload={payload}
			sortHandler={sortHandler}
			paginationHandler={paginationHandler}
			itemsPerPageHandler={itemsPerPageHandler}
			filterHandler={filterHandler}
			dateFilterHandler={dateFilterHandler}
			searchTriggerHandler={searchTriggerHandler}
			refetTableData={refetchCases}
		/>
	);
};

export default AllCases;
