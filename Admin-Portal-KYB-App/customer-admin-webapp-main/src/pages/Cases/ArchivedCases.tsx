import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import qs from "qs";
import { type TFilterOption } from "@/components/Filter/types";
import useSearchPayload from "@/hooks/useSearchPayload";
import { capitalize } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useGetCasesQuery,
	useGetCaseTypes,
} from "@/services/queries/case.query";
import { useGetUsers } from "@/services/queries/user.query";
import useGlobalStore from "@/store/useGlobalStore";
import { type IPayload, type TOption } from "@/types/common";
import CasesTable from "./CasesTable";

const ArchivedCases = () => {
	const [, setSearchParams] = useSearchParams();
	const [customerId] = useState(getItem("customerId") ?? "");
	const savedPayload = useGlobalStore((store) => store.savedPayload);
	const [caseTypes, setCaseTypes] = useState<TOption[]>([]);

	const {
		payload,
		sortHandler,
		paginationHandler,
		itemsPerPageHandler,
		searchHandler,
		filterHandler,
		dateFilterHandler,
	} = useSearchPayload();

	const [tableData, setTableData] = useState({
		records: [],
		total_items: 0,
		total_pages: 1,
	});
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
			type: "checkbox",
			alias: "data_cases.status",
			filterOptions: [{ label: "Archived", value: "9", disabled: true }],
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

	useEffect(() => {
		setSearchParams(
			(prev) => {
				if (savedPayload?.archived) return savedPayload?.archived;
				prev.set("page", "1");
				prev.set("itemsPerPage", "10");
				prev.delete("filter_date");
				prev.delete("search");
				prev.set(
					"filter",
					qs.stringify({
						"data_cases.status": ["9"],
					}),
				);
				return prev;
			},
			{ replace: true },
		);
	}, []);

	const {
		data: archivedCasesData,
		isLoading,
		refetch: refetchCases,
	} = useGetCasesQuery({
		customerId,
		params: payload,
	});

	useEffect(() => {
		if (archivedCasesData?.status === "success") {
			const response = archivedCasesData?.data;
			setTableData(response);
		}
	}, [archivedCasesData]);

	const searchTriggerHandler = (value: string) => {
		searchHandler(value, [
			"data_cases.id",
			"data_businesses.name",
			"first_name",
			"last_name",
			"applicant_id",
		]);
	};

	// TODO: pass initialFilterValues to handle the filter as applied when not needed
	return (
		<div>
			<CasesTable
				tableName="archived"
				customerId={customerId}
				tableData={tableData}
				FilterData={FilterData}
				isLoading={isLoading}
				payload={payload}
				sortHandler={sortHandler}
				paginationHandler={paginationHandler}
				itemsPerPageHandler={itemsPerPageHandler}
				dateFilterHandler={dateFilterHandler}
				filterHandler={(selectedValues) => {
					const values = selectedValues;
					values["data_cases.status"] = ["9"];
					filterHandler(values);
				}}
				searchTriggerHandler={searchTriggerHandler}
				configs={{ cols: 2 }}
				refetTableData={refetchCases}
			/>
		</div>
	);
};

export default ArchivedCases;
