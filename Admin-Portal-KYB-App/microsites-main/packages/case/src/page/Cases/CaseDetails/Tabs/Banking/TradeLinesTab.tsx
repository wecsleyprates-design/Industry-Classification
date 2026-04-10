import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetBusinessTradeLines } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export interface TradeLineDetail {
	label: string;
	value: string | number;
}

export interface TradeLinesTabProps {
	tradeLineStats: {
		nonFinancialAccounts: TradeLineDetail[];
		balances: TradeLineDetail[];
		creditLimits: TradeLineDetail[];
		satisfactoryAccounts: TradeLineDetail[];
	};
	caseId: string;
}

const TradeLineSection: React.FC<{
	title: string;
	details: TradeLineDetail[];
	isLoading?: boolean;
}> = ({ title, details, isLoading }) => {
	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base font-semibold">
						{title}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{[1, 2, 3].map((index) => (
							<div
								key={index}
								className="grid grid-cols-12 gap-8 py-2 border-b border-gray-100 last:border-0"
							>
								<Skeleton className="h-5 col-span-9" />
								<Skeleton className="h-5 col-span-3" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!details || details.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base font-semibold">
						{title}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="py-8 text-sm text-center text-gray-500">
						No {title.toLowerCase()} data available
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-semibold">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{details.map((detail, index) => (
						<div
							key={index}
							className="grid grid-cols-1 gap-2 py-2 border-b border-gray-100 md:grid-cols-12 md:gap-8 last:border-0"
						>
							<span className="col-span-1 text-sm text-gray-600 break-words md:col-span-9">
								{detail.label}
							</span>
							<span className="col-span-1 text-sm font-medium md:col-span-3 md:text-right">
								{detail.value}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const TradeLinesTab: React.FC<TradeLinesTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();

	const { caseData } = useGetCaseDetails({ caseId, customerId });
	const businessId = caseData?.data?.business.id ?? "";

	const { data: tradeLineData, isLoading: tradeLineLoading } =
		useGetBusinessTradeLines({
			businessId,
			caseId,
		});

	const tradeLines = tradeLineData?.data?.trade_lines;

	const tradeLineStats = {
		nonFinancialAccounts: [
			{
				label: "Number of Non-Financial Accounts Reported in the Last 24 Months",
				value:
					tradeLines?.non_financial_acc_reported_24_months_count ??
					"N/A",
			},
			{
				label: "Highest Non-Financial Balance in Last 24 Months",
				value: tradeLines?.max_non_financial_balance_24_months ?? "N/A",
			},
			{
				label: "Number of New Non-Financial Account Opened in the Last 3 Months",
				value:
					tradeLines?.new_non_financial_acc_opened_3_months ?? "N/A",
			},
		],
		balances: [
			{
				label: "Total Non-Financial Charge-Off Amount in Last 24 Months",
				value:
					tradeLines?.total_non_financial_charge_off_amount_24_monts ??
					"N/A",
			},
			{
				label: "Maximum Non-Financial Balance in Last 24 Months",
				value: tradeLines?.max_non_financial_balance_24_months ?? "N/A",
			},
		],
		creditLimits: [
			{
				label: "Original Credit Limit on Non-Financial Accounts Reported in Last 24 Months",
				value:
					tradeLines?.og_credit_limit_non_financial_acc_reported_24_months ??
					"N/A",
			},
			{
				label: "Maximum Account Limit on Non-Financial Accounts Reported in Last 24 Months",
				value:
					tradeLines?.max_acc_limit_non_financial_acc_reported_24_months ??
					"N/A",
			},
		],
		satisfactoryAccounts: [
			{
				label: "Total Number of Non-Financial Accounts 4+ Cycles Past Due or Charge-Off In Last 24 Months",
				value:
					tradeLines?.non_financial_acc_cycles_due_or_charge_off_24_months_count ??
					"N/A",
			},
			{
				label: "Percentage of Satisfactory Non-Financial Accounts in the Last 24 Months",
				value:
					tradeLines?.satisfactory_non_financial_acc_percentage_24_months ??
					"N/A",
			},
			{
				label: "Worst Non-Financial Payment Status in the Last 24 Months",
				value:
					tradeLines?.worst_non_financial_payment_status_24_months ??
					"N/A",
			},
		],
	};

	const hasAnyData = !!tradeLines;

	if (!hasAnyData && !tradeLineLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="col-span-1 lg:col-span-7">
					<Card>
						<CardContent>
							<div className="py-12 text-center text-gray-500">
								<p className="text-sm">
									No trade lines data available
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
				<div className="col-span-1 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="col-span-1 space-y-4 lg:col-span-7">
				<TradeLineSection
					title="Non-Financial Accounts"
					details={tradeLineStats.nonFinancialAccounts}
					isLoading={tradeLineLoading}
				/>
				<TradeLineSection
					title="Balances"
					details={tradeLineStats.balances}
					isLoading={tradeLineLoading}
				/>
				<TradeLineSection
					title="Credit Limits"
					details={tradeLineStats.creditLimits}
					isLoading={tradeLineLoading}
				/>
				<TradeLineSection
					title="Satisfactory Accounts"
					details={tradeLineStats.satisfactoryAccounts}
					isLoading={tradeLineLoading}
				/>
			</div>
			<div className="col-span-1 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
