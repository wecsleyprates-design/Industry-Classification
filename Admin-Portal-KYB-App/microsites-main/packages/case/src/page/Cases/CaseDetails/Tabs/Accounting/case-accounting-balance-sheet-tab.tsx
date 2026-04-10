import { useParams } from "react-router-dom";
import { TableCellsIcon } from "@heroicons/react/24/outline";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { formatSourceDate } from "@/lib/utils";
import { useGetAccountingBalanceSheetUpdated } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type BalanceSheetUpdatedResponseData } from "@/types/integrations";

import { DATE_FORMATS, VALUE_NOT_AVAILABLE } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export interface BalanceSheetPeriod {
	date: string;
	assets: {
		currentAssets: {
			checkingAccounts: Record<string, number>;
			totalCheckingSavings: number;
			totalCurrentAssets: number;
		};
		fixedAssets: {
			furnitureAndEquipment: number;
			accumulatedDepreciation: number;
			totalFixedAssets: number;
		};
		totalAssets: number;
	};
	liabilities: {
		currentLiabilities: {
			[key: string]: number;
			totalCurrentLiabilities: number;
		};
		longTermLiabilities: {
			[key: string]: number;
			totalLongTermLiabilities: number;
		};
		totalLiabilities: number;
	};
	equity: {
		[key: string]: number;
		totalEquity: number;
	};
}

export interface BalanceSheetData {
	periods: BalanceSheetPeriod[];
}

const formatCurrency = (value: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
};

const formatYAxisValue = (value: number) => {
	if (value >= 1000) {
		return `$${value / 1000}K`;
	}
	return `$${value}`;
};

const EmptyState: React.FC = () => {
	return (
		<Card>
			<CardContent>
				<section className="flex flex-col items-center justify-center py-12 text-center">
					<div className="h-[72px] w-[72px] flex items-center justify-center border-[#E5E7EB] border rounded-xl">
						<TableCellsIcon className="text-[#2563EB] h-10 w-9" />
					</div>
					<h2 className="mt-4 mb-1 text-lg font-medium text-gray-800">
						No Balance Sheets to Display
					</h2>
					<p className="max-w-sm text-sm text-gray-500">
						Balance sheets display here as they are added by <br />{" "}
						the applicant, yourself, or someone from your team.
					</p>
				</section>
			</CardContent>
		</Card>
	);
};

const SkeletonBalanceSheetCard: React.FC = () => (
	<Card>
		<CardHeader>
			<CardTitle className="text-lg font-medium tracking-wide">
				Balance Sheet
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div className="space-y-8">
				{/* Bar Chart Skeleton */}
				<div className="h-[300px] w-full">
					<Skeleton className="w-full h-full" />
				</div>

				{/* Table Skeleton */}
				<div className="overflow-x-auto">
					<table className="w-full border-separate border-spacing-0">
						<thead>
							<tr>
								<th className="sr-only">Period</th>
								{[...Array(3)].map((_, index) => (
									<th key={index} className="px-4 py-2">
										<Skeleton className="w-24 h-6" />
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{/* Assets Section */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="w-20 h-5" />
								</td>
							</tr>
							{/* Current Assets */}
							{[...Array(3)].map((_, index) => (
								<tr key={`current-assets-${index}`}>
									<td className="px-4 py-2">
										<Skeleton className="w-32 h-5" />
									</td>
									{[...Array(3)].map((_, colIndex) => (
										<td
											key={colIndex}
											className="px-4 py-2"
										>
											<Skeleton className="w-24 h-5" />
										</td>
									))}
								</tr>
							))}

							{/* Fixed Assets */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="h-5 w-28" />
								</td>
							</tr>
							{[...Array(3)].map((_, index) => (
								<tr key={`fixed-assets-${index}`}>
									<td className="px-4 py-2">
										<Skeleton className="h-5 w-36" />
									</td>
									{[...Array(3)].map((_, colIndex) => (
										<td
											key={colIndex}
											className="px-4 py-2"
										>
											<Skeleton className="w-24 h-5" />
										</td>
									))}
								</tr>
							))}

							{/* Total Assets */}
							<tr>
								<td className="px-4 py-2">
									<Skeleton className="w-24 h-5" />
								</td>
								{[...Array(3)].map((_, index) => (
									<td key={index} className="px-4 py-2">
										<Skeleton className="w-24 h-5 bg-primary/20" />
									</td>
								))}
							</tr>

							{/* Liabilities Section */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="w-24 h-5" />
								</td>
							</tr>
							{[...Array(4)].map((_, index) => (
								<tr key={`liabilities-${index}`}>
									<td className="px-4 py-2">
										<Skeleton className="w-40 h-5" />
									</td>
									{[...Array(3)].map((_, colIndex) => (
										<td
											key={colIndex}
											className="px-4 py-2"
										>
											<Skeleton className="w-24 h-5" />
										</td>
									))}
								</tr>
							))}

							{/* Equity Section */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="w-20 h-5" />
								</td>
							</tr>
							{[...Array(3)].map((_, index) => (
								<tr key={`equity-${index}`}>
									<td className="px-4 py-2">
										<Skeleton className="h-5 w-36" />
									</td>
									{[...Array(3)].map((_, colIndex) => (
										<td
											key={colIndex}
											className="px-4 py-2"
										>
											<Skeleton className="w-24 h-5" />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</CardContent>
	</Card>
);

// todo: use end_date

const BalanceSheetCard: React.FC<{
	data: BalanceSheetData;
	isLoading?: boolean;
}> = ({ data, isLoading }) => {
	if (isLoading) return <SkeletonBalanceSheetCard />;
	if (!data.periods.length) return <EmptyState />;

	// Transform data for the bar chart - showing assets, liabilities, and equity
	const chartData = data.periods.map((period) => ({
		name: period.date,
		Assets: period.assets.totalAssets,
		Liabilities: period.liabilities.totalLiabilities,
		Equity: period.equity.totalEquity,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg font-medium tracking-wide">
					Balance Sheet
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-8">
					{/* Bar Chart Section */}
					<div className="h-[300px] w-full">
						<ResponsiveContainer width="100%" height={300}>
							<BarChart
								data={chartData}
								margin={{
									top: 20,
									right: 40,
									bottom: 20,
									left: 10,
								}}
							>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="#E5E7EB"
								/>
								<XAxis
									dataKey="name"
									stroke="#6B7280"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickMargin={8}
								/>
								<YAxis
									stroke="#6B7280"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={formatYAxisValue}
									tickMargin={8}
								/>
								<Bar
									dataKey="Assets"
									fill="#93C5FD"
									radius={[4, 4, 0, 0]}
									maxBarSize={40}
								/>
								<Bar
									dataKey="Liabilities"
									fill="#60A5FA"
									radius={[4, 4, 0, 0]}
									maxBarSize={40}
								/>
								<Bar
									dataKey="Equity"
									fill="#3B82F6"
									radius={[4, 4, 0, 0]}
									maxBarSize={40}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>

					{/* Table section */}
					<div className="overflow-x-auto">
						<table className="w-full border-separate border-spacing-0">
							<thead>
								<tr>
									<th className="px-4 py-2 font-semibold text-left text-gray-700 rounded-l sr-only text-md">
										Period
									</th>
									{data.periods.map((period, index) => (
										<th
											key={index}
											className={`px-4 py-2 text-left text-sm font-semibold tracking-wide text-gray-700 ${
												index ===
												data.periods.length - 1
													? "rounded-r"
													: ""
											}`}
										>
											{period.date}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{/* Assets Section */}
								<tr>
									<td
										colSpan={data.periods.length + 1}
										className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 border-t border-gray-100 rounded-md"
									>
										Assets
									</td>
								</tr>
								{/* Current Assets */}
								{Object.keys(
									data.periods[0].assets.currentAssets
										.checkingAccounts,
								).map((accountKey) => (
									<tr
										key={accountKey}
										className="border-t border-gray-100"
									>
										<td className="px-4 py-2 text-sm text-gray-600">
											{accountKey
												.split(/(?=[A-Z])/)
												.join(" ")}
										</td>
										{data.periods.map((period, index) => (
											<td
												key={index}
												className="px-4 py-2 text-sm text-gray-700"
											>
												{formatCurrency(
													period.assets.currentAssets
														.checkingAccounts[
														accountKey
													],
												)}
											</td>
										))}
									</tr>
								))}
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm font-medium text-gray-700">
										Total Current Assets
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm font-medium text-gray-700"
										>
											{formatCurrency(
												period.assets.currentAssets
													.totalCurrentAssets,
											)}
										</td>
									))}
								</tr>

								{/* Fixed Assets */}
								<tr>
									<td
										colSpan={data.periods.length + 1}
										className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 border-t border-gray-100 rounded-md"
									>
										Fixed Assets
									</td>
								</tr>
								<tr>
									<td className="px-4 py-2 text-sm text-gray-600">
										Furniture and Equipment
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.assets.fixedAssets
													.furnitureAndEquipment,
											)}
										</td>
									))}
								</tr>
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm text-gray-600">
										Accumulated Depreciation
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.assets.fixedAssets
													.accumulatedDepreciation,
											)}
										</td>
									))}
								</tr>
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm font-medium text-gray-700">
										Total Fixed Assets
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm font-medium text-gray-700"
										>
											{formatCurrency(
												period.assets.fixedAssets
													.totalFixedAssets,
											)}
										</td>
									))}
								</tr>

								{/* Total Assets */}
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm font-medium text-gray-700">
										Total Assets
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm font-medium text-gray-700"
										>
											{formatCurrency(
												period.assets.totalAssets,
											)}
										</td>
									))}
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

const transformBalanceSheetData = (
	data: Record<string, BalanceSheetUpdatedResponseData>,
): BalanceSheetData => {
	return {
		periods: Object.entries(data)
			.sort(([yearA], [yearB]) => Number(yearA) - Number(yearB))
			.map(([_, periodData]) => ({
				date: formatSourceDate(periodData.end_date, DATE_FORMATS.MONTH),
				assets: {
					currentAssets: {
						checkingAccounts:
							periodData.assets.checking_savings.reduce(
								(
									acc: Record<string, number>,
									curr: { name: string; value: number },
								) => ({
									...acc,
									[curr.name]: curr.value,
								}),
								{},
							),
						totalCheckingSavings:
							periodData.assets.total_checking_savings,
						totalCurrentAssets:
							periodData.assets.total_other_current_assets,
					},
					fixedAssets: {
						furnitureAndEquipment:
							periodData.assets.fixed_assets.find(
								(item: { name: string; value: number }) =>
									item.name === "Original Cost",
							)?.value ?? 0,
						accumulatedDepreciation: 0, // Not present in the API data
						totalFixedAssets: periodData.assets.total_fixed_assets,
					},
					totalAssets: periodData.assets.total_assets,
				},
				liabilities: {
					currentLiabilities: {
						...periodData.liabilities_and_equity.liabilities.current_liabilities.reduce(
							(
								acc: Record<string, number>,
								curr: { name: string; value: number },
							) => ({
								...acc,
								[curr.name]: curr.value,
							}),
							{},
						),
						totalCurrentLiabilities:
							periodData.liabilities_and_equity
								.total_current_liabilities,
					},
					longTermLiabilities: {
						...periodData.liabilities_and_equity.liabilities.long_term_liabilities.reduce(
							(
								acc: Record<string, number>,
								curr: { name: string; value: number },
							) => ({
								...acc,
								[curr.name]: curr.value,
							}),
							{},
						),
						totalLongTermLiabilities:
							periodData.liabilities_and_equity
								.total_long_term_liabilities,
					},
					totalLiabilities:
						periodData.liabilities_and_equity.total_liabilities,
				},
				equity: {
					...periodData.liabilities_and_equity.equity.reduce(
						(
							acc: Record<string, number>,
							curr: { name: string; value: number },
						) => ({
							...acc,
							[curr.name || "Retained Earnings"]: curr.value,
						}),
						{},
					),
					totalEquity: periodData.liabilities_and_equity.total_equity,
				},
			})),
	};
};

export const CaseAccountingBalanceSheetTab: React.FC = () => {
	const { id: caseId = "" } = useParams();
	const { customerId } = useAppContextStore();

	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	const { data: balanceSheetData, isLoading } =
		useGetAccountingBalanceSheetUpdated(businessId);

	const transformedData = balanceSheetData?.data
		? transformBalanceSheetData(balanceSheetData.data)
		: { periods: [] };

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<div className="lg:col-span-8">
				<BalanceSheetCard
					data={transformedData}
					isLoading={isLoading}
				/>
			</div>
			<div className="lg:col-span-4">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
