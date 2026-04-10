import React, { type FC, useEffect, useState } from "react";
import StatusBadge from "@/components/Badge/StatusBadge";
import TableLoader from "@/components/Spinner/TableLoader";
import { capitalize, formatPrice } from "@/lib/helper";
import { type GetBankingIntegrationResponseData } from "@/types/banking";
import AccountDetailsModal from "./AccountDetailsModal";

interface Props {
	bankData?: GetBankingIntegrationResponseData[] | null;
	loading: boolean;
}

interface BankInfo extends GetBankingIntegrationResponseData {
	account_number?: string | null;
	routing?: string | null;
	wire_routing?: string | null;
}

const CreditDetails: FC<Props> = ({ bankData, loading }) => {
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

	useEffect(() => {
		if (!bankData) return;

		const combined = bankData.reduce<BankInfo[]>((accumulator, account) => {
			if (account?.deposit_account && account?.depositAccountInfo) {
				const { accounts, numbers } = account.depositAccountInfo;

				accounts?.forEach((acc) => {
					const matchingNumber = numbers?.ach.find(
						(number) => number?.account_id === acc?.account_id,
					);

					const accountInfo: any = {
						...account,
						...acc,
						account_number: matchingNumber ? matchingNumber?.account : null,
						routing: matchingNumber ? matchingNumber?.routing : null,
						wire_routing: matchingNumber ? matchingNumber?.wire_routing : null,
					};

					if (account?.id === acc?.account_id) {
						accumulator.push(accountInfo);
					}
				});
			} else {
				accumulator.push(account);
			}

			return accumulator;
		}, []);

		setData(combined);
	}, [bankData]);
	const [selectedAccount, setSelectedAccount] = useState<BankInfo | null>(null);
	return (
		<div className="w-full p-6 pt-2 mt-8 mb-8 bg-white border rounded-lg shadow">
			<h2 className="text-lg font-semibold text-gray-900 mb-4">Credit Cards</h2>
			<div className="flex justify-between border-b border-gray-200 py-4">
				<h3 className="text-sm text-gray-800 font-inter">Credit Cart</h3>
				<div className="flex justify-between gap-10">
					<h3 className="text-sm text-gray-800">Balance</h3>
					<h3 className="text-sm text-gray-800">Limit</h3>
				</div>
			</div>
			{data?.length ? (
				data?.map((item: BankInfo, index) => {
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
									<p className="text-blue-600 font-medium">{item?.bank_name}</p>
									<p className="text-sm text-blue-600">
										{item?.official_name ?? "-"}
										<span className="mx-1"></span>(
										{formatNumber(String(item?.bank_account), false)})
									</p>

									<div className="mt-2 flex items-center gap-2">
										<>
											{item?.deposit_account ? (
												<>
													<StatusBadge
														text={capitalize(item?.verification_status ?? "")}
														type={
															item?.verification_status === "VERIFIED"
																? "green_tick"
																: "red_cross"
														}
													/>
													<StatusBadge
														text={"Deposit Account"}
														type={"blue_info"}
													/>
												</>
											) : (
												<StatusBadge
													text={item?.match ? "Match" : "No Match"}
													type={item?.match ? "green_tick" : "red_cross"}
												/>
											)}
										</>
									</div>
								</div>
								<div className="flex justify-between gap-10">
									<div>
										<p className="text-sm text-gray-800">
											{item?.balance_available
												? formatPrice(Number(item?.balance_available ?? 0))
												: "-"}
										</p>
									</div>
									<div>
										<p className="text-sm text-gray-800">
											{item?.balance_limit
												? formatPrice(Number(item?.balance_limit))
												: "-"}
										</p>
									</div>
								</div>
							</div>
						</>
					);
				})
			) : (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 text-base font-normal mt-5 tracking-tight text-center text-gray-500"
				>
					{loading ? <TableLoader /> : "Data not found"}
				</div>
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

export default CreditDetails;
