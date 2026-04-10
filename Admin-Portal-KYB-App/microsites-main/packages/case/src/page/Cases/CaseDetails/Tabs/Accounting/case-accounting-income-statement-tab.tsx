import { useParams } from "react-router-dom";
import { BanknotesIcon } from "@heroicons/react/24/outline";
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
import { useGetAccountingIncomeStatementUpdated } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type IncomeStatementByDate } from "@/types/integrations";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export interface IncomeStatementPeriod {
	startDate: string;
	endDate: string;
	income: {
		constructionIncome: number;
		totalIncome: number;
	};
	costOfGoodsSold: {
		materialsCosts: number;
		otherConstructionCosts: number;
		subcontractorsExpense: number;
		totalCOGS: number;
	};
	expenses: {
		[key: string]: number;
		totalExpense: number;
	};
	otherIncome: {
		[key: string]: number;
		totalOtherIncome: number;
	};
	grossProfit: number;
	netOrdinaryIncome: number;
	netOtherIncome: number;
	netIncome: number;
}

export interface IncomeStatementData {
	periods: IncomeStatementPeriod[];
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

const SkeletonIncomeStatementCard: React.FC = () => (
	<Card>
		<CardHeader>
			<CardTitle className="text-lg font-medium tracking-wide">
				Income Statement/P&L
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
							{/* Income Section */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="w-20 h-5" />
								</td>
							</tr>
							{[...Array(2)].map((_, index) => (
								<tr key={`income-${index}`}>
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

							{/* COGS Section */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="h-5 w-36" />
								</td>
							</tr>
							{[...Array(4)].map((_, index) => (
								<tr key={`cogs-${index}`}>
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

							{/* Expenses Section */}
							<tr>
								<td
									colSpan={4}
									className="px-4 py-3 bg-gray-100 rounded-md"
								>
									<Skeleton className="w-24 h-5" />
								</td>
							</tr>
							{[...Array(6)].map((_, index) => (
								<tr key={`expense-${index}`}>
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

							{/* Net Income */}
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
						</tbody>
					</table>
				</div>
			</div>
		</CardContent>
	</Card>
);

const EmptyState: React.FC = () => {
	return (
		<Card>
			<CardContent>
				<section className="flex flex-col items-center justify-center py-12 text-center">
					<div className="h-[72px] w-[72px] flex items-center justify-center border-[#E5E7EB] border rounded-xl">
						<BanknotesIcon className="text-[#2563EB] h-10 w-9" />
					</div>
					<h2 className="mt-4 mb-1 text-lg font-medium text-gray-800">
						No Income Statements to Display
					</h2>
					<p className="max-w-sm text-sm text-gray-500">
						Income statements display here as they are added by{" "}
						<br /> the applicant, yourself, or someone from your
						team.
					</p>
				</section>
			</CardContent>
		</Card>
	);
};

const IncomeStatementCard: React.FC<{
	data: IncomeStatementData;
	isLoading: boolean;
}> = ({ data, isLoading }) => {
	if (isLoading) return <SkeletonIncomeStatementCard />;
	if (!data.periods.length) return <EmptyState />;

	// Transform data for the bar chart
	const chartData = data.periods.map((period) => ({
		name: period.startDate,
		amount: period.grossProfit,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg font-medium tracking-wide">
					Income Statement/P&L
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
									dataKey="amount"
									fill="#93C5FD"
									radius={[4, 4, 0, 0]}
									maxBarSize={120}
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
											{period.startDate} -{" "}
											{period.endDate}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								{/* Income Section */}
								<tr>
									<td
										colSpan={data.periods.length + 1}
										className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 border-t border-gray-100 rounded-md"
									>
										Income
									</td>
								</tr>
								<tr>
									<td className="px-4 py-2 text-sm text-gray-600">
										Construction Income
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.income
													.constructionIncome,
											)}
										</td>
									))}
								</tr>
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm font-medium text-gray-700">
										Total Income
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm font-medium text-gray-700"
										>
											{formatCurrency(
												period.income.totalIncome,
											)}
										</td>
									))}
								</tr>

								{/* Cost of Goods Sold Section */}
								<tr>
									<td
										colSpan={data.periods.length + 1}
										className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 border-t border-gray-100 rounded-md"
									>
										Cost of Goods Sold
									</td>
								</tr>
								<tr>
									<td className="px-4 py-2 text-sm text-gray-600">
										Materials Costs
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.costOfGoodsSold
													.materialsCosts,
											)}
										</td>
									))}
								</tr>
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm text-gray-700">
										Other Construction Costs
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.costOfGoodsSold
													.otherConstructionCosts,
											)}
										</td>
									))}
								</tr>
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm text-gray-700">
										Subcontractors Expense
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.costOfGoodsSold
													.subcontractorsExpense,
											)}
										</td>
									))}
								</tr>
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm text-gray-700">
										Total COGS
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm text-gray-700"
										>
											{formatCurrency(
												period.costOfGoodsSold
													.totalCOGS,
											)}
										</td>
									))}
								</tr>

								{/* Gross Profit Section */}
								<tr>
									<td className="px-4 py-2 text-sm font-medium text-gray-700">
										Gross Profit
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm font-medium text-gray-700"
										>
											{formatCurrency(period.grossProfit)}
										</td>
									))}
								</tr>

								{/* Expenses Section */}
								{renderExpensesSection(data)}

								{/* Other Income/Expense Section */}
								{renderOtherIncomeSection(data)}

								{/* Net Income (final row) */}
								<tr className="border-t border-gray-100">
									<td className="px-4 py-2 text-sm font-medium text-gray-700">
										Net Income
									</td>
									{data.periods.map((period, index) => (
										<td
											key={index}
											className="px-4 py-2 text-sm font-medium text-gray-700"
										>
											{formatCurrency(period.netIncome)}
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

const renderExpensesSection = (data: IncomeStatementData) => {
	// Get all unique expense keys across all periods, excluding totalExpense
	const expenseKeys = Array.from(
		new Set(
			data.periods.flatMap((period) =>
				Object.keys(period.expenses).filter(
					(key) => key !== "totalExpense",
				),
			),
		),
	).sort();

	return (
		<>
			<tr>
				<td
					colSpan={data.periods.length + 1}
					className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 border-t border-gray-100 rounded-md"
				>
					Expenses
				</td>
			</tr>
			{expenseKeys.map((key) => (
				<tr key={key} className="border-t border-gray-100">
					<td className="px-4 py-2 text-sm text-gray-700">
						{key.split(/(?=[A-Z])/).join(" ")}{" "}
						{/* Convert camelCase to spaces */}
					</td>
					{data.periods.map((period, index) => (
						<td
							key={index}
							className="px-4 py-2 text-sm text-gray-700"
						>
							{formatCurrency(period.expenses[key] || 0)}
						</td>
					))}
				</tr>
			))}
			<tr className="border-t border-gray-100">
				<td className="px-4 py-2 text-sm font-medium text-gray-700">
					Total Expense
				</td>
				{data.periods.map((period, index) => (
					<td
						key={index}
						className="px-4 py-2 text-sm font-medium text-gray-700"
					>
						{formatCurrency(period.expenses.totalExpense)}
					</td>
				))}
			</tr>
		</>
	);
};

const renderOtherIncomeSection = (data: IncomeStatementData) => {
	// Get all unique other income keys across all periods, excluding totalOtherIncome
	const otherIncomeKeys = Array.from(
		new Set(
			data.periods.flatMap((period) =>
				Object.keys(period.otherIncome).filter(
					(key) => key !== "totalOtherIncome",
				),
			),
		),
	).sort();

	return (
		<>
			<tr>
				<td
					colSpan={data.periods.length + 1}
					className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 border-t border-gray-100 rounded-md"
				>
					Other Income/Expense
				</td>
			</tr>
			{otherIncomeKeys.map((key) => (
				<tr key={key} className="border-t border-gray-100">
					<td className="px-4 py-2 text-sm text-gray-700">
						{key.split(/(?=[A-Z])/).join(" ")}{" "}
						{/* Convert camelCase to spaces */}
					</td>
					{data.periods.map((period, index) => (
						<td
							key={index}
							className="px-4 py-2 text-sm text-gray-700"
						>
							{formatCurrency(period.otherIncome[key] || 0)}
						</td>
					))}
				</tr>
			))}
			<tr className="border-t border-gray-100">
				<td className="px-4 py-2 text-sm font-medium text-gray-700">
					Total Other Income
				</td>
				{data.periods.map((period, index) => (
					<td
						key={index}
						className="px-4 py-2 text-sm font-medium text-gray-700"
					>
						{formatCurrency(period.otherIncome.totalOtherIncome)}
					</td>
				))}
			</tr>
		</>
	);
};

const sumHierarchicalCategories = (
	categories: Record<string, number>,
	prefix: string,
): number => {
	return Object.entries(categories)
		.filter(([key]) => key.startsWith(prefix))
		.reduce((sum, [_, value]) => sum + value, 0);
};

const transformIncomeStatementData = (
	data: IncomeStatementByDate[],
): IncomeStatementData => {
	return {
		periods: data.map((period) => {
			const jobMaterialsTotal = sumHierarchicalCategories(
				period.income_statement.expenses,
				"Job Expenses > Job Materials",
			);

			return {
				startDate: period.start_date,
				endDate: period.end_date,
				income: {
					constructionIncome:
						period.income_statement.total_revenue ?? 0,
					totalIncome: period.income_statement.total_revenue ?? 0,
				},
				costOfGoodsSold: {
					materialsCosts: jobMaterialsTotal,
					otherConstructionCosts:
						period.income_statement.cost_of_goods_sold[
							"Cost of Goods Sold"
						] ?? 0,
					subcontractorsExpense: 0, // Not present in original data
					totalCOGS:
						period.income_statement.total_cost_of_goods_sold ?? 0,
				},
				expenses: {
					// Filter out nested categories and only keep top-level ones
					...Object.entries(period.income_statement.expenses)
						.filter(([key]) => !key.includes(">"))
						.reduce(
							(acc, [key, value]) => ({ ...acc, [key]: value }),
							{},
						),
					totalExpense: period.income_statement.total_expenses ?? 0,
				},
				otherIncome: {
					totalOtherIncome: 0,
				},
				grossProfit: period.income_statement.gross_profit ?? 0,
				netOrdinaryIncome: period.income_statement.net_income ?? 0,
				netOtherIncome: 0,
				netIncome: period.income_statement.net_income ?? 0,
			};
		}),
	};
};

export const CaseAccountingIncomeStatementTab: React.FC = () => {
	const { id: caseId = "" } = useParams();
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	const { data: incomeStatementData, isLoading } =
		useGetAccountingIncomeStatementUpdated(businessId);

	const transformedData = incomeStatementData?.data
		? transformIncomeStatementData(incomeStatementData.data)
		: { periods: [] };

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<div className="lg:col-span-8">
				<IncomeStatementCard
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
