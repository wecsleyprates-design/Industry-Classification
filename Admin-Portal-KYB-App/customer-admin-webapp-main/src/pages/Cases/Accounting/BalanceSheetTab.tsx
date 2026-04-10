import { useEffect, useState } from "react";
import TableLoader from "@/components/Spinner/TableLoader";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { convertToLocalDate, formatPrice } from "@/lib/helper";
import { useGetAccountingBalanceSheetUpdated } from "@/services/queries/integration.query";
import {
	checkAllRecordsNull,
	convertKeyToCamelCase,
	getRecordByKey,
} from "./helper";

export const BalanceSheetTab: React.FC<{
	businessId: string;
	caseId?: string;
}> = ({ businessId, caseId }) => {
	const [currentAssetsTableData, setCurrentAssetsTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [otherCurrentAssetsTableData, setOtherCurrentAssetsTableData] =
		useState<{
			total_items: number;
			total_pages: number;
			records: any[];
		}>({
			total_items: 10,
			total_pages: 1,
			records: [],
		});

	const [depositAssetsTableData, setDepositAssetsTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [fixedAssetsTableData, setFixedAssetsTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [longrTermLiabTableData, setLongrTermLiabTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [currentLiabTableData, setCurrentLiabTableData] = useState<{
		total_items: number;
		total_pages: number;
		records: any[];
	}>({
		total_items: 10,
		total_pages: 1,
		records: [],
	});

	const [equityTableData, setEquityTableData] = useState<{
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

	const [responseYearKeys, setResponseYearKeys] = useState<any>([]);

	const { data: balanceSheetData, isLoading } =
		useGetAccountingBalanceSheetUpdated({ businessId, caseId });

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

	useEffect(() => {
		if (!balanceSheetData?.data) return;

		// Extract year keys dynamically from the data (including all years)
		const yearKeys = Object.keys(balanceSheetData.data);

		// Map the years into the desired format using end_date for each year
		const yearObjects = yearKeys?.map((year: any) => {
			const { end_date: endDate } = balanceSheetData.data[year];

			return {
				title: `${convertToLocalDate(endDate, "MM/DD/YY")}`, // Set title as start_date - end_date
				path: year,
				alias: year,
			};
		});

		setResponseYearKeys(yearObjects);

		// Prepare records for each table: assets, liabilities, and equity
		const currentAssetsRecords: any = [];
		const otherCurrentAssetsRecord: any = [];
		const depositAssetsRecord: any = [];
		const fixedAssetsRecords: any = [];
		const longTermLiabilitiesRecords: any = [];
		const currentLiabilitiesRecords: any = [];
		const equityRecords: any = [];

		yearKeys.forEach((year) => {
			const { assets, liabilities_and_equity: liabilitiesAndEquity } =
				balanceSheetData.data[year];

			// Populate current assets records (only checking_savings)
			if (assets.checking_savings) {
				assets.checking_savings.forEach((item: any) => {
					let existingRecord = currentAssetsRecords.find(
						(record: any) => record.key === `${item.name}`,
					);
					if (!existingRecord) {
						existingRecord = { key: item.name };
						currentAssetsRecords.push(existingRecord);
					}
					// Add value for the current year
					existingRecord[year] = item.value ? formatPrice(item.value) : "$0.00";
				});
			}

			// Populate pther assets records
			if (assets.other_current_assets) {
				assets.other_current_assets.forEach((item: any) => {
					let existingRecord = otherCurrentAssetsRecord.find(
						(record: any) => record.key === `${item.name}`,
					);
					if (!existingRecord) {
						existingRecord = { key: item.name };
						otherCurrentAssetsRecord.push(existingRecord);
					}
					// Add value for the current year
					existingRecord[year] = item.value ? formatPrice(item.value) : "$0.00";
				});
			}

			// Populate deposit assets records
			if (assets.deposit_assets) {
				assets.deposit_assets.forEach((item: any) => {
					let existingRecord = depositAssetsRecord.find(
						(record: any) => record.key === `${item.name}`,
					);
					if (!existingRecord) {
						existingRecord = { key: item.name };
						depositAssetsRecord.push(existingRecord);
					}
					// Add value for the current year
					existingRecord[year] = item.value ? formatPrice(item.value) : "$0.00";
				});
			}

			// Populate fixed assets records
			if (assets.fixed_assets) {
				assets.fixed_assets.forEach((item: any) => {
					let existingRecord = fixedAssetsRecords.find(
						(record: any) => record.key === `${item.name}`,
					);
					if (!existingRecord) {
						existingRecord = { key: item.name };
						fixedAssetsRecords.push(existingRecord);
					}
					// Add value for the current year
					existingRecord[year] = item.value ? formatPrice(item.value) : "$0.00";
				});
			}

			// Populate liabilities records (only long-term liabilities)
			if (liabilitiesAndEquity.liabilities.long_term_liabilities) {
				liabilitiesAndEquity.liabilities.long_term_liabilities.forEach(
					(item: any) => {
						let existingRecord = longTermLiabilitiesRecords.find(
							(record: any) => record.key === `${item.name}`,
						);
						if (!existingRecord) {
							existingRecord = { key: item.name };
							longTermLiabilitiesRecords.push(existingRecord);
						}
						// Add value for the current year
						existingRecord[year] = item.value
							? formatPrice(item.value)
							: "$0.00";
					},
				);
			}

			// Populate liabilities records (only current liabilities)
			if (liabilitiesAndEquity.liabilities.current_liabilities) {
				liabilitiesAndEquity.liabilities.current_liabilities?.forEach(
					(item: any) => {
						let existingRecord = currentLiabilitiesRecords.find(
							(record: any) => record.key === `${item.name}`,
						);
						if (!existingRecord) {
							existingRecord = { key: item.name };
							currentLiabilitiesRecords.push(existingRecord);
						}
						// Add value for the current year
						existingRecord[year] = item.value
							? formatPrice(item.value)
							: "$0.00";
					},
				);
			}
			currentLiabilitiesRecords?.forEach((record: any) => {
				yearKeys?.forEach((year) => {
					if (!record[year]) {
						record[year] = "$0.00";
					}
				});
			});

			// Populate equity records
			liabilitiesAndEquity.equity.forEach((item: any) => {
				let existingRecord: any = equityRecords?.find(
					(record: any) => record.key === `${item.name}`,
				);
				if (!existingRecord) {
					existingRecord = { key: item.name };
					equityRecords.push(existingRecord);
				}
				// Add value for the current year
				existingRecord[year] = item.value ? formatPrice(item.value) : "$0.00";
			});
		});

		// Ensure every year is covered for every record, adding $0.00 where missing
		const allYears = Object.keys(balanceSheetData.data); // List of all years
		const allRecords: any = [
			{ records: currentAssetsRecords },
			{ records: otherCurrentAssetsRecord },
			{ records: fixedAssetsRecords },
			{ records: depositAssetsRecord },
			{ records: longTermLiabilitiesRecords },
			{ record: currentLiabilitiesRecords },
			{ records: equityRecords },
		];

		allRecords?.forEach(({ records }: any) => {
			records?.forEach((record: any) => {
				allYears?.forEach((year) => {
					if (!record[year]) {
						record[year] = "$0.00";
					}
				});
			});
		});

		// Set the final state for each table
		setCurrentAssetsTableData({
			total_items: currentAssetsRecords.length,
			total_pages: 1,
			records: currentAssetsRecords,
		});

		setOtherCurrentAssetsTableData({
			total_items: otherCurrentAssetsRecord.length,
			total_pages: 1,
			records: otherCurrentAssetsRecord,
		});

		setDepositAssetsTableData({
			total_items: depositAssetsRecord.length,
			total_pages: 1,
			records: depositAssetsRecord,
		});

		setFixedAssetsTableData({
			total_items: fixedAssetsRecords.length,
			total_pages: 1,
			records: fixedAssetsRecords,
		});

		setLongrTermLiabTableData({
			total_items: longTermLiabilitiesRecords.length,
			total_pages: 1,
			records: longTermLiabilitiesRecords,
		});

		setCurrentLiabTableData({
			total_items: currentLiabilitiesRecords.length,
			total_pages: 1,
			records: currentLiabilitiesRecords,
		});

		setEquityTableData({
			total_items: equityRecords.length,
			total_pages: 1,
			records: equityRecords,
		});
	}, [balanceSheetData]);

	useEffect(() => {
		if (!balanceSheetData?.data) return;

		// Extract year keys dynamically from the data
		const yearKeys = Object.keys(balanceSheetData.data);

		// Initialize the yearlyTotals object for each key
		const yearlyTotals: any = {
			total_assets: { key: "total_assets" },
			total_checking_savings: { key: "total_checking_savings" },
			total_other_current_assets: { key: "total_other_current_assets" },
			total_current_assets: { key: "total_current_assets" },
			total_fixed_assets: { key: "total_fixed_assets" },
			total_deposit_assets: { key: "total_deposit_assets" },
			total_current_liabilities: { key: "total_current_liabilities" },
			total_long_term_liabilities: { key: "total_long_term_liabilities" },
			total_liabilities: { key: "total_liabilities" },
			total_equity: { key: "total_equity" },
			total_liabilities_and_equity: { key: "total_liabilities_and_equity" },
		};

		// Process each year
		yearKeys?.forEach((year) => {
			const { assets, liabilities_and_equity: liabilitiesAndEquity } =
				balanceSheetData.data[year] ?? {}; // Safe access for year data

			// For Assets
			yearlyTotals.total_assets[year] = assets?.total_assets
				? formatPrice(assets.total_assets)
				: "$0.00";
			yearlyTotals.total_checking_savings[year] = assets?.total_checking_savings
				? formatPrice(assets.total_checking_savings)
				: "$0.00";
			yearlyTotals.total_other_current_assets[year] =
				assets?.total_other_current_assets
					? formatPrice(assets.total_other_current_assets)
					: "$0.00";
			yearlyTotals.total_current_assets[year] =
				assets?.total_other_current_assets || assets?.total_checking_savings
					? formatPrice(
							Number(assets.total_other_current_assets ?? 0) +
								Number(assets.total_checking_savings ?? 0),
						)
					: "$0.00";
			yearlyTotals.total_fixed_assets[year] = assets?.total_fixed_assets
				? formatPrice(assets.total_fixed_assets)
				: "$0.00";
			yearlyTotals.total_deposit_assets[year] = assets?.total_deposit_assets
				? formatPrice(assets.total_deposit_assets)
				: "$0.00";

			// For Liabilities and Equity (liabilitiesAndEquity safely accessed)
			yearlyTotals.total_current_liabilities[year] =
				liabilitiesAndEquity?.total_current_liabilities
					? formatPrice(liabilitiesAndEquity.total_current_liabilities)
					: "$0.00";
			yearlyTotals.total_long_term_liabilities[year] =
				liabilitiesAndEquity?.total_long_term_liabilities
					? formatPrice(liabilitiesAndEquity.total_long_term_liabilities)
					: "$0.00";
			yearlyTotals.total_liabilities[year] =
				liabilitiesAndEquity?.total_liabilities
					? formatPrice(liabilitiesAndEquity.total_liabilities)
					: "$0.00";
			yearlyTotals.total_equity[year] = liabilitiesAndEquity?.total_equity
				? formatPrice(liabilitiesAndEquity.total_equity)
				: "$0.00";
			yearlyTotals.total_liabilities_and_equity[year] =
				liabilitiesAndEquity?.total_liabilities_and_equity
					? formatPrice(liabilitiesAndEquity.total_liabilities_and_equity)
					: "$0.00";
		});

		// Format the yearlyTotals data into an array
		const formattedYearlyTotals = Object.values(yearlyTotals);

		// Update the state with the new data
		setYearlyTotals({
			total_items: formattedYearlyTotals.length,
			total_pages: 1,
			records: formattedYearlyTotals,
		});
	}, [balanceSheetData]);

	return (
		<>
			{isLoading ? (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 text-base font-normal tracking-tight text-center text-gray-500"
				>
					<TableLoader />
				</div>
			) : (
				<>
					{Object.keys(balanceSheetData?.data as any).length &&
					!checkAllRecordsNull(yearlyTotals, "total_assets") &&
					!checkAllRecordsNull(yearlyTotals, "total_liabilities_and_equity") ? (
						<table aria-colcount={4} className="w-full min-w-full text-left">
							<TableHeader
								columns={columns}
								tableHeaderClassname="bg-gray-200"
							/>
							<td
								className="content-center py-2.5 pl-3 text-sm font-semibold bg-gray-100"
								colSpan={4}
							>
								Assets
							</td>
							<tr />
							{!checkAllRecordsNull(yearlyTotals, "total_current_assets") ? (
								<>
									{!checkAllRecordsNull(
										yearlyTotals,
										"total_checking_savings",
									) && currentAssetsTableData.records.length ? (
										<>
											<td
												className="content-center py-2.5 pl-3 text-sm font-semibold underline"
												colSpan={4}
											>
												Current Assets
											</td>
											<tr />
											<td
												className="content-center py-2.5 pl-3 text-sm font-normal"
												colSpan={4}
											>
												Checking/Savings
											</td>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={currentAssetsTableData}
												seprator={false}
												rowClassName="text-gray-800 py-2.5"
											/>
											<td
												colSpan={4}
												className="w-full h-0 border-t border-t-gray-300"
											/>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={{
													total_items: 1,
													total_pages: 1,
													records: [
														getRecordByKey(
															"total_checking_savings",
															yearlyTotals?.records,
														),
													],
												}}
												seprator={false}
												rowClassName="text-sm font-semibold text-gray-800 py-2.5"
											/>
										</>
									) : null}
									{!checkAllRecordsNull(
										yearlyTotals,
										"total_other_current_assets",
									) && otherCurrentAssetsTableData.records.length ? (
										<>
											<td
												className="content-center py-2.5 pl-3 text-sm font-normal"
												colSpan={4}
											>
												Other current assets
											</td>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={otherCurrentAssetsTableData}
												seprator={false}
												rowClassName="text-gray-800 py-2.5"
											/>
											<td
												colSpan={4}
												className="w-full h-0 border-t border-t-gray-300"
											/>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={{
													total_items: 1,
													total_pages: 1,
													records: [
														getRecordByKey(
															"total_other_current_assets",
															yearlyTotals?.records,
														),
													],
												}}
												seprator={false}
												rowClassName="text-sm font-semibold text-gray-800 py-2.5"
											/>
										</>
									) : null}
									<td
										colSpan={4}
										className="w-full h-0 border-t border-t-gray-300"
									/>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey(
													"total_current_assets",
													yearlyTotals?.records,
												),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
								</>
							) : null}

							{!checkAllRecordsNull(yearlyTotals, "total_deposit_assets") &&
							depositAssetsTableData?.records?.length ? (
								<>
									<td
										className="content-center py-2.5 pl-3 text-sm font-semibold underline"
										colSpan={2}
									>
										Fixed Assets
									</td>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={depositAssetsTableData}
										seprator={false}
										rowClassName="py-2.5 text-gray-800"
									/>
									<td
										colSpan={4}
										className="w-full h-0 border-t border-t-gray-300"
									/>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey(
													"total_deposit_assets",
													yearlyTotals?.records,
												),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
								</>
							) : null}

							{!checkAllRecordsNull(yearlyTotals, "total_fixed_assets") ? (
								<>
									<td
										className="content-center py-2.5 pl-3 text-sm font-semibold underline"
										colSpan={2}
									>
										Fixed Assets
									</td>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={fixedAssetsTableData}
										seprator={false}
										rowClassName="py-2.5 text-gray-800"
									/>
									<td
										colSpan={4}
										className="w-full h-0 border-t border-t-gray-300"
									/>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey(
													"total_fixed_assets",
													yearlyTotals?.records,
												),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
								</>
							) : null}
							{!checkAllRecordsNull(yearlyTotals, "total_assets") ? (
								<>
									<td colSpan={4} className="w-full h-0 bg-gray-300" />
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey("total_assets", yearlyTotals?.records),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
								</>
							) : null}
							{/* seprate section **/}
							{!checkAllRecordsNull(
								yearlyTotals,
								"total_liabilities_and_equity",
							) ? (
								<>
									<td
										className="content-center py-2.5 pl-3 text-sm font-semibold bg-gray-100"
										colSpan={4}
									>
										Liabilities & Equity
									</td>
									<tr />
									<td
										className="content-center py-2.5 pl-3 text-sm font-semibold underline"
										colSpan={2}
									>
										Liabilities
									</td>
									<tr />
									{!checkAllRecordsNull(
										yearlyTotals,
										"total_long_term_liabilities",
									) && longrTermLiabTableData.records.length ? (
										<>
											<td
												className="content-center py-2.5 pl-3 text-sm font-normal"
												colSpan={4}
											>
												Long Term Liabilities
											</td>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={longrTermLiabTableData}
												seprator={false}
												rowClassName="text-gray-800 py-2.5"
											/>
											<td
												colSpan={4}
												className="w-full h-0 border-t border-t-gray-300"
											/>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={{
													total_items: 1,
													total_pages: 1,
													records: [
														getRecordByKey(
															"total_long_term_liabilities",
															yearlyTotals?.records,
														),
													],
												}}
												seprator={false}
												rowClassName="text-sm font-semibold text-gray-800 py-2.5"
											/>
										</>
									) : null}
									{!checkAllRecordsNull(
										yearlyTotals,
										"total_current_liabilities",
									) && currentLiabTableData.records.length ? (
										<>
											<td
												className="content-center py-2.5 pl-3 text-sm font-normal"
												colSpan={4}
											>
												Current Liabilities
											</td>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={currentLiabTableData}
												seprator={false}
												rowClassName="text-gray-800 py-2.5"
											/>
											<td
												colSpan={4}
												className="w-full h-0 border-t border-t-gray-300"
											/>
											<tr />
											<TableBody
												isLoading={isLoading}
												columns={columns}
												tableData={{
													total_items: 1,
													total_pages: 1,
													records: [
														getRecordByKey(
															"total_current_liabilities",
															yearlyTotals?.records,
														),
													],
												}}
												seprator={false}
												rowClassName="text-sm font-semibold text-gray-800 py-2.5"
											/>
										</>
									) : null}
									<td
										colSpan={4}
										className="w-full h-0 border-t border-t-gray-300"
									/>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey(
													"total_liabilities",
													yearlyTotals?.records,
												),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
									<td
										className="content-center py-2.5 pl-3 text-sm font-semibold underline"
										colSpan={2}
									>
										Equity
									</td>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={equityTableData}
										seprator={false}
										rowClassName="py-2.5 text-gray-800"
									/>
									<td
										colSpan={4}
										className="w-full h-0 border-t border-t-gray-300"
									/>
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey("total_equity", yearlyTotals?.records),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
									/>
									<td colSpan={4} className="w-full h-0 bg-gray-300" />
									<tr />
									<TableBody
										isLoading={isLoading}
										columns={columns}
										tableData={{
											total_items: 1,
											total_pages: 1,
											records: [
												getRecordByKey(
													"total_liabilities_and_equity",
													yearlyTotals?.records,
												),
											],
										}}
										seprator={false}
										rowClassName="text-sm font-semibold text-gray-800 py-2.5"
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
				</>
			)}
		</>
	);
};
