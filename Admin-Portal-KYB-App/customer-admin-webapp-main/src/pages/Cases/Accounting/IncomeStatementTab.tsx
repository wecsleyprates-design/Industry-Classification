import { useEffect, useState } from "react";
import TableLoader from "@/components/Spinner/TableLoader";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { formatPrice } from "@/lib/helper";
import { useGetAccountingIncomeStatementUpdated } from "@/services/queries/integration.query";
import {
	checkAllRecordsNull,
	convertKeyToCamelCase,
	createEmptyYearObject,
	getRecordByKey,
} from "./helper";

export const IncomeStatementTab: React.FC<{
	businessId: string;
	caseId?: string;
}> = ({ businessId, caseId }) => {
	const [incomeTableData, setIncomeTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [cogsTableData, setCogsTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [expensesTableData, setExpensesTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [yearlyTotals, setYearlyTotals] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const { data: incomeStatementData, isLoading } =
		useGetAccountingIncomeStatementUpdated({ businessId, caseId });

	const [responseYearKeys, setResponseYearKeys] = useState<any>([]);

	useEffect(() => {
		if (!incomeStatementData) return;
		// Extract year keys dynamically from the data (including all years)
		const yearKeys = incomeStatementData.data.map((item) => item.year);
		// Map the years into the desired format
		const yearObjects = incomeStatementData.data.map((item) => {
			const { start_date: startDate, end_date: endDate, year } = item;

			return {
				title: `${startDate} - ${endDate}`,
				path: year,
				alias: year,
			};
		});

		setResponseYearKeys(yearObjects);

		// Prepare records for each category (revenue, costOfGoodsSold, expenses)
		const incomeRecords: any = [];
		const cogsRecords: any = [];
		const expensesRecords: any = [];
		const yearlyTotalsData: any = [];

		incomeStatementData.data.forEach((entry) => {
			const revenue = entry.income_statement.revenue;
			const costOfGoodsSold = entry.income_statement.cost_of_goods_sold;
			const expenses = entry.income_statement.expenses;

			const {
				total_revenue: totalRevenue,
				total_cost_of_goods_sold: totalCostOfGoodsSold,
				total_expenses: totalExpenses,
				gross_profit: grossProfit,
				net_income: netIncome,
			} = entry.income_statement;

			// Prepare yearly totals (totalRevenue, total_cost_of_goods_sold, etc.)
			const yearTotal = {
				year: entry.year,
				total_revenue: formatPrice(totalRevenue),
				total_cost_of_goods_sold: formatPrice(totalCostOfGoodsSold),
				total_expenses: formatPrice(totalExpenses),
				gross_profit: formatPrice(grossProfit),
				net_income: formatPrice(netIncome),
			};

			yearlyTotalsData.push(yearTotal);

			// Populate income records
			Object.keys(revenue).forEach((key) => {
				const existingRecord = incomeRecords.find(
					(record: any) => record.key === key,
				);
				if (existingRecord) {
					yearKeys.forEach((year: string | number) => {
						if (entry.year === year) {
							existingRecord[year] = formatPrice(revenue[key]);
						} else if (!existingRecord[year]) {
							existingRecord[year] = "$0.00";
						}
					});
				} else {
					const newRecord: Record<string, string> = { key };
					yearKeys.forEach((year: string | number) => {
						if (entry.year === year) {
							newRecord[year] = formatPrice(revenue[key]);
						} else {
							newRecord[year] = "$0.00";
						}
					});
					incomeRecords.push(newRecord);
				}
			});

			// Populate COGS records
			Object.keys(costOfGoodsSold).forEach((key) => {
				const existingRecord = cogsRecords?.find(
					(record: any) => record.key === key,
				);
				if (existingRecord) {
					yearKeys.forEach((year: string | number) => {
						if (entry.year === year) {
							existingRecord[year] = formatPrice(costOfGoodsSold[key]);
						} else if (!existingRecord[year]) {
							existingRecord[year] = "$0.00";
						}
					});
				} else {
					const newRecord: Record<string, string> = { key };
					yearKeys.forEach((year: string | number) => {
						if (entry.year === year) {
							newRecord[year] = formatPrice(costOfGoodsSold[key]);
						} else {
							newRecord[year] = "$0.00";
						}
					});
					cogsRecords.push(newRecord);
				}
			});

			// Populate expenses records
			Object.keys(expenses).forEach((key) => {
				const existingRecord = expensesRecords.find(
					(record: any) => record.key === key,
				);
				if (existingRecord) {
					yearKeys.forEach((year: string | number) => {
						if (entry.year === year) {
							existingRecord[year] = formatPrice(expenses[key]);
						} else if (!existingRecord[year]) {
							existingRecord[year] = "$0.00";
						}
					});
				} else {
					const newRecord: any = { key };
					yearKeys.forEach((year: string | number) => {
						if (entry.year === year) {
							newRecord[year] = formatPrice(expenses[key]);
						} else {
							newRecord[year] = "$0.00";
						}
					});
					expensesRecords.push(newRecord);
				}
			});
		});

		// Set the state for each table (income, COGS, and expenses)
		setIncomeTableData({
			total_items: incomeRecords.length,
			total_pages: 1,
			records: incomeRecords,
		});

		setCogsTableData({
			total_items: cogsRecords.length,
			total_pages: 1,
			records: cogsRecords,
		});

		setExpensesTableData({
			total_items: expensesRecords.length,
			total_pages: 1,
			records: expensesRecords,
		});

		// Set the yearly totals state
		setYearlyTotals(yearlyTotalsData);
	}, [incomeStatementData]);

	useEffect(() => {
		if (!incomeStatementData) return;
		// Initialize an array to hold the records for yearly totals
		const yearlyTotals: any[] = [
			{ key: "total_revenue", ...createEmptyYearObject(incomeStatementData) },
			{
				key: "total_cost_of_goods_sold",
				...createEmptyYearObject(incomeStatementData),
			},
			{ key: "total_expenses", ...createEmptyYearObject(incomeStatementData) },
			{ key: "gross_profit", ...createEmptyYearObject(incomeStatementData) },
			{ key: "net_income", ...createEmptyYearObject(incomeStatementData) },
		];

		// Iterate over the data to populate the yearly totals
		incomeStatementData.data.forEach(
			(entry: { year: any; income_statement: any }) => {
				const { year, income_statement: incomeStatement } = entry;
				const {
					total_revenue: totalRevenue,
					total_cost_of_goods_sold: totalCostOfGoodsSold,
					total_expenses: totalExpenses,
					gross_profit: grossProfit,
					net_income: netIncome,
				} = incomeStatement;

				// Update the totals in the yearlyTotals array
				yearlyTotals.forEach((record) => {
					if (record.key === "total_revenue") {
						record[year] = formatPrice(totalRevenue); // Format total revenue
					} else if (record.key === "total_cost_of_goods_sold") {
						record[year] = formatPrice(totalCostOfGoodsSold); // Format COGS
					} else if (record.key === "total_expenses") {
						record[year] = formatPrice(totalExpenses); // Format total expenses
					} else if (record.key === "gross_profit") {
						record[year] = formatPrice(grossProfit); // Format gross profit
					} else if (record.key === "net_income") {
						record[year] = formatPrice(netIncome); // Format net income
					}
				});
			},
		);

		// Set the yearly totals state with the populated records
		setYearlyTotals({
			total_items: yearlyTotals.length,
			total_pages: 1,
			records: yearlyTotals,
		});
	}, [incomeStatementData]);

	const columns: column[] = [
		{
			title: "",
			path: "",
			alias: "",
			content: (item) => (
				<span className="truncate">{convertKeyToCamelCase(item.key)}</span>
			),
		},
		...responseYearKeys,
	];

	return (
		<>
			{isLoading ? (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 text-base font-normal tracking-tight text-center text-gray-500 "
				>
					<TableLoader />
				</div>
			) : (
				<div className="max-w-full overflow-x-auto">
					{incomeTableData?.records?.length ||
					cogsTableData?.records.length ||
					expensesTableData?.records?.length ? (
						<table className="w-full min-w-full text-left">
							<TableHeader
								columns={columns}
								tableHeaderClassname="bg-gray-200"
							/>
							{/* Ordinary Income/Expense Section */}
							{incomeTableData?.records?.length &&
							!checkAllRecordsNull(yearlyTotals, "total_revenue") ? (
								<>
									<tbody>
										<tr>
											<td
												className="content-center py-2.5 pl-3 text-sm font-semibold underline"
												colSpan={2}
											>
												Income
											</td>
										</tr>
									</tbody>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={incomeTableData}
									/>
									<tr>
										<td className="w-full h-0 bg-gray-300" colSpan={4}></td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey("total_revenue", yearlyTotals?.records),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
								</>
							) : null}
							{/* Ordinary Income/Expense (Continued) */}
							{cogsTableData?.records?.length &&
							!checkAllRecordsNull(yearlyTotals, "total_cost_of_goods_sold") &&
							!checkAllRecordsNull(yearlyTotals, "gross_profit") ? (
								<>
									<tr>
										<td
											className="content-center py-2.5 pl-3 text-sm font-semibold bg-gray-100"
											colSpan={4}
										>
											Cost of goods sold
										</td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={cogsTableData}
										seprator={false}
										rowClassName="py-2.5 text-gray-800"
									/>
									<tr>
										<td
											className="w-full h-0 border-t border-t-gray-300"
											colSpan={4}
										></td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey(
													"total_cost_of_goods_sold",
													yearlyTotals?.records,
												),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold py-2.5 text-gray-800"
									/>
									<tr>
										<td className="w-full h-0 bg-gray-300" colSpan={4}></td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey("gross_profit", yearlyTotals?.records),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold py-2.5 text-gray-800"
									/>
								</>
							) : null}
							{/* Expense Section */}
							{expensesTableData?.records?.length &&
							!checkAllRecordsNull(yearlyTotals, "total_expense") &&
							!checkAllRecordsNull(yearlyTotals, "net_income") ? (
								<>
									<tr>
										<td
											className="content-center py-2.5 pl-3 text-sm font-semibold bg-gray-100"
											colSpan={4}
										>
											Expense
										</td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={expensesTableData}
										seprator={false}
										rowClassName="text-gray-800 py-2.5"
									/>
									<tr>
										<td
											className="w-full h-0 border-t border-t-gray-300"
											colSpan={4}
										></td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey("total_expenses", yearlyTotals?.records),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold py-2.5 text-gray-800"
									/>
									<tr>
										<td className="w-full h-0 bg-gray-300" colSpan={4}></td>
									</tr>
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey("net_income", yearlyTotals?.records),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold py-2.5 text-gray-800"
									/>
								</>
							) : null}
						</table>
					) : (
						<table className="flex justify-center text-center">
							<td colSpan={columns.length} className="text-center">
								<h6 className="my-2 text-base font-medium text-center text-red-500">
									No records found!
								</h6>
							</td>
						</table>
					)}
				</div>
			)}
		</>
	);
};
