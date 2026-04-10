import React, { type FC } from "react";
import { TitleLeftDivider } from "@/components/Dividers";
import TableLoader from "@/components/Spinner/TableLoader";
import { formatPrice } from "@/lib/helper";
import { type GetBusinessTradeLinesResponse } from "@/types/businessEntityVerification";

interface Props {
	tradeLinesData?: GetBusinessTradeLinesResponse;
	tradeLinesLoading: boolean;
}

const TradeLines: FC<Props> = ({ tradeLinesData, tradeLinesLoading }) => {
	return (
		<>
			{tradeLinesLoading ? (
				<>
					<div className="">
						<TitleLeftDivider text={"Trade Lines"} />
					</div>
					<div className="flex justify-center py-2 tracking-tight">
						<TableLoader />
					</div>
				</>
			) : Object.keys(tradeLinesData?.data?.trade_lines ?? {}).length > 0 ? (
				<>
					<div className="">
						<TitleLeftDivider text={"Trade Lines"} />
					</div>
					<div className="p-4">
						<div className="flex flex-col tracking-tight gap-y-4">
							<div>
								<p className="text-xs font-normal text-gray-500">
									Number of Non-Financial Accounts Reported in the Last 24
									Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{tradeLinesData?.data?.trade_lines
										?.non_financial_acc_reported_24_months_count ?? "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Highest Non-Financial Balance in Last 24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{typeof tradeLinesData?.data?.trade_lines
										?.max_non_financial_balance_24_months === "number"
										? formatPrice(
												tradeLinesData?.data?.trade_lines
													?.max_non_financial_balance_24_months ?? 0,
											)
										: "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Original Credit Limit on Non-Financial Accounts Reported in
									Last 24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{typeof tradeLinesData?.data?.trade_lines
										?.og_credit_limit_non_financial_acc_reported_24_months ===
									"number"
										? formatPrice(
												tradeLinesData?.data?.trade_lines
													?.og_credit_limit_non_financial_acc_reported_24_months ??
													0,
											)
										: "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Highest Non-Financial Account Limit Reported in Last 24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{typeof tradeLinesData?.data?.trade_lines
										?.max_acc_limit_non_financial_acc_reported_24_months ===
									"number"
										? formatPrice(
												tradeLinesData?.data?.trade_lines
													?.max_acc_limit_non_financial_acc_reported_24_months ??
													0,
											)
										: "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Total Number of Non-Financial Accounts 4+ Cycles Past Due or
									Charge-Off In Last 24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{tradeLinesData?.data?.trade_lines
										?.non_financial_acc_cycles_due_or_charge_off_24_months_count ??
										"N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Number of New Non-Financial Account Opened in the Last 3
									Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{tradeLinesData?.data?.trade_lines
										?.new_non_financial_acc_opened_3_months ?? "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Total Non-Financial Charge-Off Amount in Last 24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{typeof tradeLinesData?.data?.trade_lines
										?.total_non_financial_charge_off_amount_24_monts ===
									"number"
										? formatPrice(
												tradeLinesData?.data?.trade_lines
													?.total_non_financial_charge_off_amount_24_monts ?? 0,
											)
										: "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Percentage of Satisfactory Non-Financial Accounts in the Last
									24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{tradeLinesData?.data?.trade_lines
										?.satisfactory_non_financial_acc_percentage_24_months
										? `${tradeLinesData?.data?.trade_lines?.satisfactory_non_financial_acc_percentage_24_months}%`
										: "N/A"}
								</p>
							</div>
							<div>
								<p className="text-xs font-normal text-gray-500">
									Worst Non-Financial Payment Status in the Last 24 Months
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-800">
									{tradeLinesData?.data?.trade_lines
										?.worst_non_financial_payment_status_24_months ?? "N/A"}
								</p>
							</div>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="">
						<TitleLeftDivider text={"Trade Lines"} />
					</div>
					<div className="p-4 text-sm font-medium">
						{tradeLinesData?.message ?? "No data available at the moment."}
					</div>
				</>
			)}
		</>
	);
};

export default TradeLines;
