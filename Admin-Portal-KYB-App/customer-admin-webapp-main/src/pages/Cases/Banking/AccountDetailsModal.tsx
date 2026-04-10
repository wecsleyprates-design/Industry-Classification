import React, { useEffect, useState } from "react";
import {
	ClipboardIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import StatusBadge from "@/components/Badge/StatusBadge";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { formatPrice } from "@/lib/helper";
import { type GetBankingIntegrationResponseData } from "@/types/banking";
import AccountAuthStatusTooltip from "./AccountAuthStatusTooltip";
import AccountVerificationStatusTooltip from "./AccountVerificationStatusTooltip";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
interface BankInfo extends GetBankingIntegrationResponseData {
	account_number?: string | null;
	routing?: string | null;
	wire_routing?: string | null;
}
interface AccountDetailsModalProps {
	account: BankInfo | null;
	onClose: () => void;
}

const AccountDetailsModal: React.FC<AccountDetailsModalProps> = ({
	account,
	onClose,
}) => {
	const [data, setData] = useState<BankInfo>();
	const [viewNumers, setViewNumbers] = useState<boolean[] | null>(null);
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async (text: string) => {
		await navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => {
				setCopied(false);
			}, 2000); // Reset after 2 seconds
		});
	};
	const toggleNumberVisibility = (number: number) => {
		if (!viewNumers) return;
		// Create a copy of the existing array to avoid mutating state directly
		const updatedNumbers = [...viewNumers];
		// Toggle the value at the specific index
		updatedNumbers[number] = !updatedNumbers[number];
		// Update the state
		setViewNumbers(updatedNumbers);
	};
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
		if (!account) return;
		setData(account);
		setViewNumbers(new Array(3).fill(false));
	}, [account]);
	if (!data) return null;
	return (
		<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
			<div className="w-full max-w-xl bg-white rounded-lg shadow-lg pb-4 relative">
				{/* Close Button */}
				<button
					className="absolute top-1 right-4 text-gray-600 hover:text-gray-900 text-4xl p-2"
					onClick={onClose}
				>
					&times;
				</button>

				{/* Header */}
				<div className="flex items-start p-4 border-b mb-4 gap-4 flex-col">
					<h2 className="text-lg font-semibold text-gray-900">
						Account Details
					</h2>
					<div className="flex items-center gap-2">
						<>
							{data?.verification_result?.account_verification_response
								?.name ? (
								<AccountVerificationStatusTooltip
									response={
										data?.verification_result?.account_verification_response
									}
								/>
							) : (
								<>
									<ReactCustomTooltip
										id={"match_nomatch_tooltip"}
										tooltip={
											<>
												{data?.match
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
											text={data?.match ? "Match" : "No Match"}
											type={data?.match ? "green_tick" : "red_cross"}
										/>
									</ReactCustomTooltip>
								</>
							)}
							<AccountAuthStatusTooltip
								response={
									data?.verification_result?.account_authentication_response
								}
								featureFlagEnabled={
									flags[FEATURE_FLAGES.DOS_558_HANDLE_GIACT_CA30_TOOLTIP]
								}
							/>
							{data?.is_selected ? (
								<>
									<StatusBadge text={"Deposit Account"} type={"blue_info"} />
								</>
							) : null}
						</>
					</div>
				</div>

				{/* Content Grid */}
				<div className="grid grid-cols-1 mr-6 ml-6 gap-y-4">
					{/* Bank Name */}
					{data.bank_name && (
						<div className="flex justify-between items-center border-b border-gray-300 pb-4">
							<p className="text-sm text-gray-500">Bank Name</p>
							<p className="font-medium text-gray-800">{data.bank_name}</p>
						</div>
					)}

					{/* Institution Name */}
					{data.institution_name && (
						<div className="flex justify-between items-center border-b border-gray-300 pb-4">
							<p className="text-sm text-gray-500">Institution Name</p>
							<p className="font-medium text-gray-800">
								{data.institution_name}
							</p>
						</div>
					)}

					{/* Account Name */}
					{data.official_name && (
						<div className="flex justify-between items-center border-b border-gray-300 pb-4">
							<p className="text-sm text-gray-500">Account Name</p>
							<p className="font-medium text-gray-800">
								{data.official_name ?? "-"}
							</p>
						</div>
					)}

					{/* Account Type */}
					<div className="flex justify-between items-center border-b border-gray-300 pb-4">
						<p className="text-sm text-gray-500">Account Type</p>
						<p className="font-medium text-gray-800">{data.type ?? "-"}</p>
					</div>

					{/* Account Number */}
					<div className="flex justify-between items-center border-b border-gray-300 pb-4">
						<p className="text-sm text-gray-500 whitespace-nowrap">
							Account Number
						</p>
						<p className="font-medium flex justify-between items-center text-gray-800">
							{data?.bank_account ? (
								<>
									<span className="break-all ml-4">
										{formatNumber(
											String(data?.bank_account),
											viewNumers?.[0] ?? false,
										)}
									</span>
									<span className="mx-1"></span>
									<div
										onClick={() => {
											toggleNumberVisibility(0);
										}}
										className="pr-2 "
									>
										{viewNumers?.[0] ? (
											<EyeIcon
												className="w-5 h-5 text-blue-600"
												aria-hidden="true"
											/>
										) : (
											<EyeSlashIcon
												className="w-5 h-5 text-blue-600"
												aria-hidden="true"
											/>
										)}
									</div>
									<ClipboardIcon
										className="h-6 w-6 text-blue-600 cursor-pointer"
										onClick={async () => {
											await copyToClipboard(String(data?.bank_account));
										}}
									/>
								</>
							) : (
								"-"
							)}
						</p>
					</div>

					{/* Routing Number */}
					{data.type !== "credit" && (
						<>
							<div className="flex justify-between items-center border-b border-gray-300 pb-4">
								<p className="text-sm text-gray-500">Routing Number</p>
								<p className="font-medium flex justify-between items-center text-gray-800">
									{data?.routing ? (
										<>
											{formatNumber(
												String(data?.routing),
												viewNumers?.[1] ?? false,
											)}
											<span className="mx-1"></span>
											<div
												onClick={() => {
													toggleNumberVisibility(1);
												}}
												className="pr-2 "
											>
												{viewNumers?.[1] ? (
													<EyeIcon
														className="w-5 h-5 text-blue-600"
														aria-hidden="true"
													/>
												) : (
													<EyeSlashIcon
														className="w-5 h-5 text-blue-600"
														aria-hidden="true"
													/>
												)}
											</div>
											<ClipboardIcon
												className="h-6 w-6 text-blue-600 cursor-pointer"
												onClick={async () => {
													await copyToClipboard(String(data?.routing));
												}}
											/>
										</>
									) : (
										"-"
									)}
								</p>
							</div>

							{/* Wire Routing Number */}
							<div className="flex justify-between items-center border-b border-gray-300 pb-4">
								<p className="text-sm text-gray-500">Wire Routing Number</p>
								<p className="font-medium flex justify-between items-center text-gray-800">
									{data?.wire_routing ? (
										<>
											{formatNumber(
												String(data?.wire_routing),
												viewNumers?.[2] ?? false,
											)}
											<span className="mx-1"></span>
											<div
												onClick={() => {
													toggleNumberVisibility(2);
												}}
												className="pr-2 "
											>
												{viewNumers?.[2] ? (
													<EyeIcon
														className="w-5 h-5 text-blue-600"
														aria-hidden="true"
													/>
												) : (
													<EyeSlashIcon
														className="w-5 h-5 text-blue-600"
														aria-hidden="true"
													/>
												)}
											</div>
											<ClipboardIcon
												className="h-6 w-6 text-blue-600 cursor-pointer"
												onClick={async () => {
													await copyToClipboard(String(data?.wire_routing));
												}}
											/>
										</>
									) : (
										"-"
									)}
								</p>
							</div>
						</>
					)}
					{/* Current Balance */}
					<div className="flex justify-between items-center border-b border-gray-300 pb-4">
						<p className="text-sm text-gray-500">Current Balance</p>
						<p className="font-medium text-gray-800">
							{data.balance_current
								? formatPrice(Number(data.balance_current))
								: "-"}
						</p>
					</div>

					{/* Average Balance */}
					<div
						className={`flex justify-between items-center pb-4 ${
							data.type !== "credit"
								? "border-none"
								: "border-b border-gray-300"
						}`}
					>
						<p className="text-sm text-gray-500">
							Average Balance (Past 3 Months)
						</p>
						<p className="font-medium text-gray-800">
							{data.average_balance
								? formatPrice(Number(data.average_balance))
								: "-"}
						</p>
					</div>
					{/* Limit */}
					{data.type === "credit" && (
						<div className="flex justify-between items-center border-gray-300 pb-4">
							<p className="text-sm text-gray-500">Limit</p>
							<p className="font-medium text-gray-800">
								{data.balance_limit
									? formatPrice(Number(data.balance_limit))
									: "-"}
							</p>
						</div>
					)}
				</div>
				{copied && (
					<p className="absolute bottom-14 left-1/2 transform -translate-x-1/2 bg-white text-black text-sm px-4 py-2 rounded-md shadow-lg">
						Copied to clipboard!
					</p>
				)}
			</div>
		</div>
	);
};

export default AccountDetailsModal;
