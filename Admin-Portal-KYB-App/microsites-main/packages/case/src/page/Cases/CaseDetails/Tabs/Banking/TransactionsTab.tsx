import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import { useSearchPayload } from "@/hooks";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import {
	useGetTransactions,
	useGetTransactionsAccounts,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type TransactionRecord } from "@/types/transactions";
import {
	TransactionHistory,
	TransactionHistorySkeleton,
} from "./components/TransactionHistory";
import { type AccountTransaction, type TimePeriod } from "./types";

const getDateRangeFromPeriod = (
	period: TimePeriod,
): { start: string; end: string } | null => {
	if (period === "All Time") {
		return null;
	}

	const now = dayjs();

	switch (period) {
		case "7 Days":
			return {
				start: now.subtract(7, "day").format("YYYY-MM-DD"),
				end: now.format("YYYY-MM-DD"),
			};
		case "1 Month":
			return {
				start: now.subtract(1, "month").format("YYYY-MM-DD"),
				end: now.format("YYYY-MM-DD"),
			};
		case "3 Months":
			return {
				start: now.subtract(3, "month").format("YYYY-MM-DD"),
				end: now.format("YYYY-MM-DD"),
			};
		case "1 Year":
			return {
				start: now.subtract(1, "year").format("YYYY-MM-DD"),
				end: now.format("YYYY-MM-DD"),
			};
	}
};

export const TransactionsTab: React.FC<{ caseId: string }> = ({ caseId }) => {
	const { customerId } = useAppContextStore();
	const [selectedPeriod, setSelectedPeriod] =
		useState<TimePeriod>("All Time");

	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? "";

	const { payload, paginationHandler, filterHandler } = useSearchPayload({
		pagination: true,
		defaultSort: "bank_account_transactions.date",
	});

	// Update payload when period changes
	const handlePeriodChange = (period: TimePeriod) => {
		setSelectedPeriod(period);
		const dateRange = getDateRangeFromPeriod(period);

		if (dateRange === null) {
			filterHandler({}, {}); // Clear the date filter
		} else {
			filterHandler(
				{},
				{
					"bank_account_transactions.date": `${dateRange.start},${dateRange.end}`,
				},
			);
		}
	};

	const {
		data: transactionsData,
		isLoading: isLoadingTransactions,
		error: transactionsError,
	} = useGetTransactions({
		businessId,
		params: payload,
	});

	const {
		data: transactionsAccountData,
		isLoading: isLoadingAccounts,
		error: transactionsAccountError,
	} = useGetTransactionsAccounts(businessId, caseId);

	const accountMap = useMemo(() => {
		const map = new Map<string, string>();
		const accountResponseData = transactionsAccountData?.data;
		const accountDetails = accountResponseData ?? [];
		accountDetails.forEach((acc) => {
			map.set(
				acc.bank_account,
				acc.account_name || acc.official_name || "Unnamed Account",
			);
		});
		return map;
	}, [transactionsAccountData?.data]);

	const accountNames = useMemo(() => {
		const accountMapValues = accountMap.values();
		const uniqueNames = [...new Set(accountMapValues)];
		return ["All Accounts", ...uniqueNames];
	}, [accountMap]);

	const mappedTransactions = useMemo(() => {
		const transactionRecords = transactionsData?.data?.records ?? [];
		return transactionRecords.map(
			(record: TransactionRecord): AccountTransaction => ({
				date: record.date,
				description: record.description,
				amount: record.transaction,
				accountType:
					accountMap.get(record.account) ??
					record.bank_name ??
					"Unknown Account",
				currency: record.currency ?? "USD",
			}),
		);
	}, [transactionsData?.data, accountMap]);

	const isLoadingTransactionsAndAccounts =
		isLoadingTransactions || isLoadingAccounts;

	if (transactionsError || transactionsAccountError) {
		toast.error("Error fetching transaction data.");
	}

	const currentPage = payload.page ?? 1;
	const totalPages = transactionsData?.data?.total_pages ?? 0;

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				{isLoadingTransactionsAndAccounts ? (
					<TransactionHistorySkeleton />
				) : (
					<TransactionHistory
						transactions={mappedTransactions}
						transactionRecords={
							transactionsData?.data?.records ?? []
						}
						caseId={caseId}
						businessId={businessId}
						accounts={accountNames}
						currentPage={currentPage}
						totalPages={totalPages}
						onPageChange={(page) => {
							paginationHandler(page);
						}}
						onPeriodChange={handlePeriodChange}
						selectedPeriod={selectedPeriod}
					/>
				)}
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
