import React, { type FC, useEffect, useState } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import StatusBadge from "@/components/Badge/StatusBadge";
import TableLoader from "@/components/Spinner/TableLoader";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { formatPrice } from "@/lib/helper";
import { type GetBankingIntegrationResponseData } from "@/types/banking";
import AccountAuthStatusTooltip from "./AccountAuthStatusTooltip";
import AccountDetailsModal from "./AccountDetailsModal";
import AccountVerificationStatusTooltip from "./AccountVerificationStatusTooltip";

import FEATURE_FLAGES from "@/constants/FeatureFlags";

interface Props {
	bankData?: GetBankingIntegrationResponseData[] | null;
	loading: boolean;
}

interface BankInfo extends GetBankingIntegrationResponseData {
	account_number?: string | null;
	routing?: string | null;
	wire_routing?: string | null;
	is_additional_account?: boolean;
}

const BankDetails: FC<Props> = ({ bankData, loading }) => {
	const [data, setData] = useState<BankInfo[]>([]);

	const formatNumber = (number: string | null, visible: boolean): string => {
		if (!number) {
			return "-";
		}
		const lastFourDigits: string = number.slice(-4);
		if (visible) {
			return number;
		}
		return `•••${lastFourDigits}`;
	};

	const flags = useFlags();

	useEffect(() => {
		if (!bankData) return;

		const bankAccountData: BankInfo[] = Object.values(bankData).map(
			(item: any) => {
				if (item?.deposit_account && item?.depositAccountInfo) {
					const { numbers } = item.depositAccountInfo;
					const matchingNumber = numbers?.ach.find(
						(number: any) =>
							number?.account_id === item?.id ||
							number?.account_id === item?.ach_account_id,
					);

					if (matchingNumber) {
						item = {
							...item,
							routing: matchingNumber.routing,
							wire_routing: matchingNumber.wire_routing,
						};
					} else if (!item?.routing) {
						item = {
							...item,
							routing: item?.routing_number,
							wire_routing: item?.wire_routing_number,
						};
					}
				}
				return item;
			},
		);
		setData(bankAccountData);
	}, [bankData]);

	const [selectedAccount, setSelectedAccount] = useState<BankInfo | null>(null);

	return (
		<div className="w-full p-6 pt-2 mt-8 mb-8 bg-white border rounded-lg shadow">
			<h2 className="mb-4 text-lg font-semibold text-gray-900">
				Bank Accounts
			</h2>
			{!!data?.filter((item) => {
				return !item.is_additional_account;
			}).length && (
				<div className="flex justify-between py-4 border-b border-gray-200">
					<h3 className="text-sm text-gray-800">Open Accounts</h3>
					<h3 className="text-sm text-gray-800">Balance</h3>
				</div>
			)}
			{data?.length ? (
				data
					?.filter((item) => {
						return !item.is_additional_account;
					})
					.map((item: BankInfo, index) => {
						return (
							<>
								<div
									key={index}
									className={`flex justify-between border-b border-gray-200 py-4 cursor-pointer
								${index === data.length - 1 ? "border-none" : ""}`}
									onClick={() => {
										setSelectedAccount(item);
									}}
								>
									<div>
										<p className="font-medium text-blue-600">
											{item?.official_name ?? item?.subtype ?? "-"}
											<span className="mx-1"></span>(
											{formatNumber(String(item?.bank_account), false)})
										</p>
										<p className="text-sm text-blue-600">{item?.bank_name}</p>

										<div className="flex items-center gap-2 mt-2">
											<>
												{item?.verification_result
													?.account_verification_response?.name ? (
													<AccountVerificationStatusTooltip
														response={
															item?.verification_result
																?.account_verification_response
														}
													/>
												) : (
													<>
														<ReactCustomTooltip
															id={"match_nomatch" + index.toString()}
															tooltip={
																<>
																	{item?.match
																		? "The business or individual name(s) on this account match one or more of the names provided on the application."
																		: "The business or individual name(s) on this account do not directly match the names provided on the application."}
																</>
															}
															place="right"
															tooltipStyle={{
																maxWidth: "400px",
																zIndex: 1000,
																fontSize: "12px",
															}}
														>
															<StatusBadge
																text={item?.match ? "Match" : "No Match"}
																type={item?.match ? "green_tick" : "red_cross"}
															/>
														</ReactCustomTooltip>
													</>
												)}
												<AccountAuthStatusTooltip
													response={
														item?.verification_result
															?.account_authentication_response
													}
													featureFlagEnabled={
														flags[
															FEATURE_FLAGES.DOS_558_HANDLE_GIACT_CA30_TOOLTIP
														]
													}
												/>
												{item?.is_selected ? (
													<>
														<StatusBadge
															text={"Deposit Account"}
															type={"blue_info"}
														/>
													</>
												) : null}
											</>
										</div>
									</div>
									<div>
										<p className="text-sm text-gray-800">
											{item?.balance_available
												? formatPrice(Number(item?.balance_available ?? 0))
												: "-"}
										</p>
									</div>
								</div>
							</>
						);
					})
			) : (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 mt-5 text-base font-normal tracking-tight text-center text-gray-500"
				>
					{loading ? <TableLoader /> : "Data not found"}
				</div>
			)}

			{!!data?.filter((item) => {
				return item.is_additional_account;
			}).length && (
				<>
					<div className="flex justify-between py-4 border-b border-gray-200">
						<h3 className="text-sm text-gray-800">Additional Accounts</h3>
					</div>
					{data
						?.filter((item) => {
							return item.is_additional_account;
						})
						.map((item: BankInfo, index) => {
							return (
								<>
									<div
										key={index}
										className={`flex justify-between border-b border-gray-200 py-4 cursor-pointer
								${index === data.length - 1 ? "border-none" : ""}`}
										onClick={() => {
											setSelectedAccount(item);
										}}
									>
										<div>
											<p className="font-medium text-blue-600">
												{item?.official_name ?? item?.subtype ?? "-"}
												<span className="mx-1"></span>(
												{formatNumber(String(item?.mask), false)})
											</p>
											<p className="text-sm text-blue-600">{item?.bank_name}</p>

											<div className="flex items-center gap-2 mt-2">
												<>
													{item?.verification_result
														?.account_verification_response?.name ? (
														<AccountVerificationStatusTooltip
															response={
																item?.verification_result
																	?.account_verification_response
															}
														/>
													) : (
														<>
															<ReactCustomTooltip
																id={"match_nomatch" + index.toString()}
																tooltip={
																	<>
																		{item?.match
																			? "The business or individual name(s) on this account match one or more of the names provided on the application."
																			: "The business or individual name(s) on this account do not directly match the names provided on the application."}
																	</>
																}
																place="right"
																tooltipStyle={{
																	maxWidth: "400px",
																	zIndex: 1000,
																	fontSize: "12px",
																}}
															>
																<StatusBadge
																	text={item?.match ? "Match" : "No Match"}
																	type={
																		item?.match ? "green_tick" : "red_cross"
																	}
																/>
															</ReactCustomTooltip>
														</>
													)}
													<AccountAuthStatusTooltip
														response={
															item?.verification_result
																?.account_authentication_response
														}
														featureFlagEnabled={
															flags[
																FEATURE_FLAGES.DOS_558_HANDLE_GIACT_CA30_TOOLTIP
															]
														}
													/>
												</>
											</div>
										</div>
										<div>
											<p className="text-sm text-gray-800">
												{item?.balance_available
													? formatPrice(Number(item?.balance_available ?? 0))
													: "-"}
											</p>
										</div>
									</div>
								</>
							);
						})}
				</>
			)}

			{selectedAccount && (
				<AccountDetailsModal
					account={selectedAccount}
					onClose={() => {
						setSelectedAccount(null);
					}}
				/>
			)}
		</div>
	);
};

export default BankDetails;
