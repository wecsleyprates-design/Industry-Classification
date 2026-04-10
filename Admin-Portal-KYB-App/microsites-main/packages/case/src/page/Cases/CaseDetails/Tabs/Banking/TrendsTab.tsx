import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
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
import { useAppContextStore } from "@/store/useAppContextStore";

import { formatCurrency } from "@/helpers/formatCurrency";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface Category {
	name: string;
	amount: number;
	accountType?: "operating" | "savings";
}

export interface TrendsTabProps {
	deposits: {
		months: Record<string, Category[]>;
		accounts: string[];
	};
	spending: {
		categories: Category[];
		periodDays: number;
		accounts: string[];
	};
	caseId: string;
}

const formatYAxisValue = (value: number) => {
	if (value >= 1000) {
		return `$${value / 1000}K`;
	}
	return `$${value}`;
};

const DepositsChart: React.FC<{
	months: Record<string, Category[]>;
	accounts: string[];
}> = ({ months, accounts }) => {
	const [selectedPeriod, setSelectedPeriod] = useState<string>(
		Object.keys(months)[0],
	);
	const [selectedAccount, setSelectedAccount] =
		useState<string>("All Accounts");

	const currentData = months[selectedPeriod];

	return (
		<Card className="col-span-1">
			<CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
				<div>
					<CardTitle className="text-base font-semibold">
						Deposits
					</CardTitle>
					<p className="text-sm text-gray-500">Average ($)</p>
				</div>
				<div className="flex gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="flex items-center gap-1"
							>
								{selectedAccount}{" "}
								<ChevronDownIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[200px]">
							<DropdownMenuLabel>
								Select Accounts
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{accounts.map((account) => (
								<DropdownMenuCheckboxItem
									key={account}
									checked={selectedAccount === account}
									onCheckedChange={() => {
										setSelectedAccount(account);
									}}
								>
									{account}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="flex items-center gap-1"
							>
								{selectedPeriod}{" "}
								<ChevronDownIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[200px]">
							<DropdownMenuLabel>Select Period</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{Object.keys(months).map((period) => (
								<DropdownMenuCheckboxItem
									key={period}
									checked={selectedPeriod === period}
									onCheckedChange={() => {
										setSelectedPeriod(period);
									}}
								>
									{period}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={350}>
					<BarChart
						data={currentData}
						margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
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
							tickMargin={12}
						/>
						<YAxis
							stroke="#6B7280"
							fontSize={12}
							tickLine={false}
							axisLine={false}
							tickFormatter={formatYAxisValue}
							tickMargin={12}
						/>
						<Bar
							dataKey="amount"
							fill="#93C5FD"
							radius={[4, 4, 0, 0]}
							maxBarSize={100}
						/>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
};

const SpendingCategories: React.FC<{
	categories: Category[];
	periodDays: number;
	accounts: string[];
}> = ({ categories, periodDays, accounts }) => {
	const [selectedAccount, setSelectedAccount] =
		useState<string>("All Accounts");

	const filteredCategories = categories.reduce(
		(acc: Category[], category) => {
			if (selectedAccount === "All Accounts") {
				// Group by category name and sum amounts
				const existing = acc.find((c) => c.name === category.name);
				if (existing) {
					existing.amount += category.amount;
				} else {
					acc.push({ ...category });
				}
			} else if (
				(selectedAccount === "Operating Account" &&
					category.accountType === "operating") ||
				(selectedAccount === "Savings Account" &&
					category.accountType === "savings")
			) {
				acc.push(category);
			}
			return acc;
		},
		[],
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
				<div>
					<CardTitle className="text-base font-semibold">
						Spending by Category
					</CardTitle>
					<p className="text-sm text-gray-500">
						Top {categories.length} in last {periodDays} days
					</p>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							className="flex items-center gap-1"
						>
							{selectedAccount}{" "}
							<ChevronDownIcon className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-[200px]">
						<DropdownMenuLabel>Select Accounts</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{accounts.map((account) => (
							<DropdownMenuCheckboxItem
								key={account}
								checked={selectedAccount === account}
								onCheckedChange={() => {
									setSelectedAccount(account);
								}}
							>
								{account}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{filteredCategories.map((category, index) => (
						<div
							key={index}
							className="flex items-center justify-between py-2 border-t border-gray-100 first:border-t-0"
						>
							<span className="text-sm text-gray-600">
								{category.name}
							</span>
							<span className="font-medium">
								{formatCurrency(category.amount, {
									minimumFractionDigits: 0,
									maximumFractionDigits: 0,
								})}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const TrendsTab: React.FC<TrendsTabProps> = ({
	caseId,
	deposits,
	spending,
}) => {
	const { customerId } = useAppContextStore();
	const { caseData } = useGetCaseDetails({ caseId, customerId });

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<DepositsChart
					months={deposits.months}
					accounts={deposits.accounts}
				/>
				<SpendingCategories
					categories={spending.categories}
					periodDays={spending.periodDays}
					accounts={spending.accounts}
				/>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
