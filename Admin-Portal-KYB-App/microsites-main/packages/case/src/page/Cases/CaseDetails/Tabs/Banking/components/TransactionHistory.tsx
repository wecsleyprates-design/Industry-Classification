import { useState } from "react";
import {
	ArrowDownTrayIcon,
	ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { usePermission } from "@/hooks/usePermission";
import { cn, formatSourceDate } from "@/lib/utils";
import { exportTransactionsAsCSV } from "@/services/api/integration.service";
import { type TransactionRecord } from "@/types/transactions";
import { type AccountTransaction, type TimePeriod } from "../types";

import { formatCurrency } from "@/helpers";
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
import { Pagination } from "@/ui/pagination";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";

export const TransactionHistorySkeleton: React.FC = () => {
	return (
		<Card className="col-span-1">
			<CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
				<CardTitle className="text-base font-semibold">
					Transaction History
				</CardTitle>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-[150px]" />
					<Skeleton className="h-9 w-[150px]" />
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-1">
					<div className="grid grid-cols-12 gap-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
						<div className="col-span-2">Date</div>
						<div className="col-span-7">Description</div>
						<div className="col-span-3 text-right">Amount</div>
					</div>
					{[...Array(5)].map((_, index) => (
						<div
							key={index}
							className="grid grid-cols-12 gap-4 py-4 text-sm border-b border-gray-100 last:border-b-0"
						>
							<div className="col-span-2">
								<Skeleton className="w-20 h-5" />
							</div>
							<div className="col-span-7">
								<Skeleton className="w-full h-5" />
							</div>
							<div className="flex justify-end col-span-3">
								<Skeleton className="w-24 h-5" />
							</div>
						</div>
					))}
				</div>
				<div className="flex items-center justify-between mt-4">
					<Skeleton className="h-5 w-36" />
					<Skeleton className="w-48 h-8" />
				</div>
			</CardContent>
		</Card>
	);
};

export const TransactionHistory: React.FC<{
	transactions: AccountTransaction[];
	transactionRecords?: TransactionRecord[];
	caseId: string;
	businessId: string;
	accounts: string[];
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onPeriodChange: (period: TimePeriod) => void;
	selectedPeriod: TimePeriod;
}> = ({
	transactions,
	transactionRecords: _transactionRecords = [],
	caseId,
	businessId,
	accounts,
	currentPage,
	totalPages,
	onPageChange,
	onPeriodChange,
	selectedPeriod,
}) => {
	const [selectedAccount, setSelectedAccount] =
		useState<string>("All Accounts");
	const hasExportPermission = usePermission("case:export");

	const filteredTransactions = transactions.filter(
		(transaction) =>
			selectedAccount === "All Accounts" ||
			transaction.accountType === selectedAccount,
	);

	const exportToCSV = async () => {
		try {
			const filePath = await exportTransactionsAsCSV(businessId, caseId, {
				period: selectedPeriod,
				accountName: selectedAccount,
			});

			// Open the signed URL in a new window to trigger download
			window.open(filePath, "_blank");
		} catch (error) {
			console.error("Failed to export transactions:", error);
		}
	};

	return (
		<Card className="col-span-1">
			<CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
				<CardTitle className="text-base font-semibold">
					Transaction History
				</CardTitle>
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
								Select Account
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
								{selectedPeriod === "All Time"
									? "All Time"
									: `Last ${selectedPeriod}`}{" "}
								<ChevronDownIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[200px]">
							<DropdownMenuLabel>
								Select Time Period
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{[
								"All Time",
								"7 Days",
								"1 Month",
								"3 Months",
								"1 Year",
							].map((period) => (
								<DropdownMenuCheckboxItem
									key={period}
									checked={selectedPeriod === period}
									onCheckedChange={() => {
										onPeriodChange(period as TimePeriod);
									}}
								>
									{period === "All Time"
										? period
										: `Last ${period}`}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{hasExportPermission && (
						<Tooltip
							trigger={
								<Button
									variant="outline"
									className="flex items-center gap-1"
									onClick={exportToCSV}
									disabled={filteredTransactions.length === 0}
								>
									<ArrowDownTrayIcon className="w-4 h-4" />
								</Button>
							}
							content="Export CSV"
							side="bottom"
						/>
					)}
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-1">
					<div className="grid grid-cols-12 gap-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
						<div className="col-span-2">Date</div>
						<div className="col-span-7">Description</div>
						<div className="col-span-3 text-right">Amount</div>
					</div>
					{filteredTransactions.map((transaction, index) => {
						// transaction.amount is returned as positive for withdrawals and negative for deposits
						// we need to format them to show negative for withdrawals and positive for deposits
						const displayAmount = formatCurrency(
							transaction.amount * -1,
							{
								currency: transaction.currency,
							},
						);

						const amountClass =
							transaction.amount > 0
								? "text-red-600"
								: "text-green-600";
						return (
							<div
								key={index}
								className="grid grid-cols-12 gap-4 py-4 text-sm border-b border-gray-100 last:border-b-0"
							>
								<div className="col-span-2 text-gray-600">
									{formatSourceDate(transaction.date)}
								</div>
								<div className="col-span-7">
									{transaction.description}
								</div>
								<div
									className={cn(
										"col-span-3 text-right",
										amountClass,
									)}
								>
									{displayAmount}
								</div>
							</div>
						);
					})}
				</div>
				<div className="flex items-center justify-between mt-4">
					<div className="text-sm text-gray-600">
						Showing {transactions.length} results
					</div>
					<Pagination
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={onPageChange}
					/>
				</div>
			</CardContent>
		</Card>
	);
};
