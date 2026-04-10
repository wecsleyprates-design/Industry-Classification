import React, { memo, useEffect, useState } from "react";
import { type DateType } from "react-tailwindcss-datepicker";
import dayjs from "dayjs";
import { ReactSelect } from "@/components/Dropdown/SelectComponent";
import Filter from "@/components/Filter/Filter";
import {
	type TFilterOption,
	type TSelectedValueType,
} from "@/components/Filter/types";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import Table from "@/components/Table";
import { type column } from "@/components/Table/types";
import useCustomToast from "@/hooks/useCustomToast";
import useSearchPayload from "@/hooks/useSearchPayload";
import {
	convertToLocalDate,
	convertToStartEndDate,
	formatPrice,
} from "@/lib/helper";
import {
	useGetTransactions,
	useGetTransactionsAccounts,
} from "@/services/queries/integration.query";
import { type TransactionResponseData } from "@/types/integrations";

type TransactionProps = {
	businessId: string;
	caseId?: string;
};
const TransactionHistory: React.FC<TransactionProps> = ({
	businessId,
	caseId,
}) => {
	const { errorHandler } = useCustomToast();
	const { payload, sortHandler, paginationHandler, itemsPerPageHandler } =
		useSearchPayload({
			pagination: true,
			defaultSort: "bank_account_transactions.date",
		});
	const { filterHandler, dateFilterHandler } = useSearchPayload();
	const [tableData, setTableData] = useState<TransactionResponseData>({
		records: [],
		total_items: 0,
		total_pages: 1,
	});
	const [dateType, setDateType] = useState<string>("All Time");

	const {
		data: transactionsData,
		isLoading,
		error: transactionsError,
	} = useGetTransactions({
		businessId,
		params: payload,
		caseId,
	});

	const {
		data: transactionsAccountData,
		isLoading: isLoadingAccount,
		error: transactionsAccountError,
	} = useGetTransactionsAccounts({ businessId, caseId });

	useEffect(() => {
		if (transactionsAccountError) {
			errorHandler(transactionsAccountError);
		}
	}, [transactionsAccountError]);

	useEffect(() => {
		if (transactionsError) {
			errorHandler(transactionsError);
		}
	}, [transactionsError]);

	useEffect(() => {
		if (transactionsData?.status === "success") {
			const response = transactionsData?.data;
			setTableData(response);
		} else if (
			transactionsData?.status === "error" ||
			transactionsData?.status === "fail"
		) {
			errorHandler({
				message: transactionsData?.message,
			});
		}
	}, [transactionsData]);

	const columns: column[] = [
		{
			title: "Date",
			path: "date",
			sort: true,
			alias: "bank_account_transactions.date",
			content: (item) => (
				<span className="text-sm font-normal text-gray-800 truncate">
					{convertToLocalDate(item.date, "MM/DD/YYYY")}
				</span>
			),
		},
		{
			title: "Transaction",
			path: "transaction",
			content: (item) => (
				<div className="flex flex-col text-sm">
					<span className="text-gray-800">{item?.description}</span>
					<span className="text-gray-500">{item?.official_name}</span>
					<span className="text-gray-500">{item?.institution_name}</span>
				</div>
			),
		},
		{
			title: "Amount",
			path: "amount",
			sort: true,
			alias: "bank_account_transactions.amount",
			content: (item) => (
				<span
					className={`text-sm ${
						item.transaction > 0 ? "text-red-600" : "text-gray-800"
					}`}
				>
					{item.transaction > 0
						? `-${formatPrice(item.transaction)}`
						: formatPrice(item.transaction).slice(1)}
				</span>
			),
		},
	];

	const option = [
		{
			label: "This Week",
			value: "This Week",
		},
		{
			label: "This Month",
			value: "This Month",
		},

		{
			label: "Last 6 Months",
			value: "Last 6 Months",
		},
		{
			label: "Last 12 Months",
			value: "Last 12 Months",
		},
		{
			label: "All Time",
			value: "All Time",
		},
	];

	const FilterDataAccounts: TFilterOption[] = [
		{
			title: "Account type",
			type: "checkbox",
			alias: "filter_account",
			filterOptions: transactionsAccountData?.data.map(
				(val: Record<string, any>) => {
					return {
						label: val.official_name,
						subLabel: val.institution_name,
						value: val.bank_account,
					};
				},
			),
		},
	];

	useEffect(() => {
		let pm, pd;
		let py = String(dayjs().year());
		let newprevdate;
		switch (dateType) {
			case "This Week":
				pm = String(dayjs().startOf("week").month() + 1);
				pd = String(dayjs().startOf("week").date());
				break;
			case "This Month":
				pm = String(dayjs().month() + 1);
				pd = "01";
				break;
			case "Last 6 Months":
				newprevdate = dayjs().subtract(6, "months");
				pm = String(newprevdate.month() + 1);
				pd = "01";
				py = String(newprevdate.year());
				break;
			case "Last 12 Months":
				newprevdate = dayjs().subtract(12, "months");
				pm = String(newprevdate.month() + 1);
				pd = "01";
				py = String(newprevdate.year());
				break;
			default:
				pm = undefined;
				pd = undefined;
		}

		if (pm && pd) {
			dateFilterHandler({
				"bank_account_transactions.date": [
					`${py}-${pm.padStart(2, "0")}-${pd.padStart(2, "0")}T00:00:00.000Z`,
					dayjs(new Date()).toISOString(),
				],
			});
		} else {
			dateFilterHandler({
				"bank_account_transactions.date": [],
			});
		}
	}, [dateType]);

	return (
		<>
			{isLoadingAccount ? (
				<FullPageLoader />
			) : (
				<div className="p-2 border rounded-2xl">
					<div className="flex flex-col items-center justify-end w-full gap-2 mt-3 mb-3 sm:flex-row">
						<div className="w-full pl-4 text-base font-semibold">
							Transactions History
						</div>
						<div className="flex items-end justify-end w-full space-y-2 sm:space-y-0 gap-x-3">
							<Filter
								filterHandler={filterHandler}
								title={"All Accounts"}
								type="large"
								initialValues={
									payload.filter
										? (payload.filter as Record<string, TSelectedValueType[]>)
										: {}
								}
								dateFilterPayload={
									payload?.filter_date
										? convertToStartEndDate(
												payload?.filter_date as Record<string, DateType[]>,
											)
										: {}
								}
								dateFilterHandler={dateFilterHandler}
								data={FilterDataAccounts}
								popOverType="accounts"
								className="text-sm font-medium text-gray-800 w-[132px] ring-0  border rounded-lg"
							/>
							<ReactSelect
								lists={option}
								defaultValue={{
									value: dateType,
									label: dateType,
								}}
								value={{
									value: dateType,
									label: dateType,
								}}
								onChange={(val: Record<string, any>) => {
									setDateType(val.label);
								}}
							/>
						</div>
					</div>

					<Table
						payload={payload}
						columns={columns}
						tableData={tableData}
						isLoading={isLoading}
						page={payload?.page ?? 1}
						itemsPerPage={payload?.items_per_page ?? 10}
						sortHandler={sortHandler}
						paginationHandler={paginationHandler}
						itemsPerPageHandler={itemsPerPageHandler}
						showPageSizes={false}
						seprator={true}
					/>
				</div>
			)}
		</>
	);
};

export default memo(TransactionHistory);
