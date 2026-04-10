import { type Dispatch, type FC, type SetStateAction, useState } from "react";
import { useParams } from "react-router-dom";
import { BanknotesIcon, EyeIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import StripeIcon from "@/assets/svg/StripeIcon";
import { useCustomToast } from "@/hooks";
import CaseWrapper from "@/layouts/CaseWrapper";
import { formatSourceDate } from "@/lib/utils";
import {
	useGetMerchantProfiles,
	useGetPaymentProcessorDetails,
	useOnboardPaymentProcessorAccounts,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import {
	type MerchantAccountTableFormat,
	type MerchantProfileResponse,
	WorthPreProcessorStatus,
	WorthProcessorStatus,
} from "@/types/integrations";
import { ManageMerchantProfileModal } from "../../../components/Modal/MerchantAccountTabModal";

import { DATE_FORMATS } from "@/constants";
import { Button } from "@/ui/button";
import { Card, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

type MerchantAccountRowData = MerchantAccountTableFormat[];

const stripeProcessorId: number = 41;

/**
 * Status display styles - maps processor_status from API to UI styling
 */
const STATUS_STYLES: Record<
	WorthProcessorStatus | WorthPreProcessorStatus,
	{ text: string; bg: string; label: string }
> = {
	[WorthProcessorStatus.UNKNOWN]: {
		label: "Unknown",
		text: "text-gray-700",
		bg: "bg-gray-100",
	},
	[WorthProcessorStatus.ACTIVE]: {
		label: "Active",
		text: "text-green-700",
		bg: "bg-green-100",
	},
	[WorthProcessorStatus.PENDING]: {
		label: "Pending Verification",
		text: "text-blue-700",
		bg: "bg-blue-100",
	},
	[WorthProcessorStatus.RESTRICTED]: {
		label: "Restricted",
		text: "text-yellow-700",
		bg: "bg-yellow-100",
	},
	[WorthProcessorStatus.INFO_REQUIRED]: {
		label: "Info Required",
		text: "text-blue-700",
		bg: "bg-blue-100",
	},
	[WorthProcessorStatus.REJECTED]: {
		label: "Rejected",
		text: "text-red-700",
		bg: "bg-red-100",
	},
	[WorthPreProcessorStatus.NOT_SUBMITTED]: {
		label: "Not Submitted",
		text: "text-gray-700",
		bg: "bg-gray-100",
	},
};

const mapMerchantAccounts = (
	data: MerchantProfileResponse | undefined,
): MerchantAccountRowData => {
	if (!data?.data) return [];

	const item = data?.data?.accounts?.[0];
	if (!item) return [];

	return [
		{
			processorId: stripeProcessorId,
			status: item.status ?? 0,
			profileId: item.processor_account_id ?? "-",
			createdAt: data.data.created_at ?? "",
			updatedAt: data.data.updated_at ?? "",
			processorStatus:
				item.processor_status ?? WorthPreProcessorStatus.NOT_SUBMITTED,
		},
	];
};

const EmptyState: FC<{
	setOpen: Dispatch<SetStateAction<boolean | number>>;
}> = ({ setOpen }) => {
	return (
		<Card>
			<div>
				<MerchantCardHeader setOpen={setOpen} />
				<div className="border w-full">
					<div className="overflow-x-auto">
						<table className="w-full border-separate border-spacing-0">
							<thead className="px-4 py-3 bg-gray-100 rounded-md">
								{[
									"Processor",
									"Status",
									"Account ID",
									"Created",
									"Last Updated",
									"Actions",
								].map((i, index) => (
									<th
										key={index}
										className="font-medium text-left px-4 py-2 text-sm text-[#6A7282]"
									>
										<div className="ml-2">{i}</div>
									</th>
								))}
							</thead>
						</table>
					</div>
				</div>
				<section className="flex flex-col items-center justify-center py-12 text-center">
					<div className="h-20 w-20 min-w-20 flex items-center justify-center border-[#E5E7EB] border rounded-xl">
						<BanknotesIcon className="text-[#2563EB] h-10 w-10" />
					</div>
					<h2 className="mt-4 mb-1 text-lg font-semibold text-gray-800">
						No Merchant Accounts to Display
					</h2>
					<p className="max-w-sm text-sm text-gray-500">
						Merchant accounts display here as they are added by
						<br /> yourself, or someone from your team.
					</p>
				</section>
			</div>
		</Card>
	);
};

const SkeletonMerchantProfileTable: FC<{
	setOpen: Dispatch<SetStateAction<boolean | number>>;
}> = ({ setOpen }) => (
	<Card>
		<MerchantCardHeader setOpen={setOpen} />
		<div>
			<div className="space-y-8">
				<div className="overflow-x-auto">
					<table className="w-full border-separate border-spacing-0">
						<thead className="bg-gray-100">
							<tr>
								{[...Array(6)].map((_, index) => (
									<th key={index} className="px-4 py-2">
										<Skeleton className="w-24 h-6 ml-2" />
									</th>
								))}
							</tr>
						</thead>

						<tbody className="divide-y divide-gray-100">
							{[...Array(6)].map((rowIndex) => (
								<tr key={rowIndex}>
									{[...Array(6)].map((_, colIndex) => (
										<td
											key={colIndex}
											className="px-4 py-2"
										>
											<Skeleton className="w-24 h-5 ml-2" />
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</Card>
);

const CreateMerchantButton: FC<{
	setOpen: Dispatch<SetStateAction<boolean | number>>;
}> = ({ setOpen }) => {
	return (
		<button
			type="button"
			className="h-11 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition px-3"
			onClick={() => {
				setOpen(true);
			}}
			aria-label="Create Merchant Profile"
		>
			Create Merchant Profile
		</button>
	);
};

const MerchantCardHeader: FC<{
	setOpen: Dispatch<SetStateAction<boolean | number>>;
	onOnboard?: (paymentProcessorId: string) => Promise<void>;
	onboardDisabled?: boolean;
}> = ({ setOpen, onOnboard, onboardDisabled }) => {
	const { slug: businessId } = useParams();
	const { customerId } = useAppContextStore();
	const [apiLoading, setApiLoading] = useState(false);
	const { data: merchantAccountData } = useGetMerchantProfiles({
		businessId,
		customerId,
	});

	const { data: paymentProcessorData, isLoading: paymentProcessorLoading } =
		useGetPaymentProcessorDetails(customerId);

	const paymentProcessorId =
		paymentProcessorData?.data.find((e) => {
			return (
				e.platform_id === stripeProcessorId &&
				Object.keys(e.metadata).length
			);
		})?.metadata.metadata["worth:processorId"] ?? "";

	const isButtonDisabled: boolean =
		!!onboardDisabled ||
		!!merchantAccountData?.data?.accounts?.length ||
		paymentProcessorLoading ||
		!paymentProcessorId ||
		apiLoading;

	return (
		<CardHeader>
			<CardTitle className="flex justify-between items-center">
				<div>
					<div className="text-lg font-medium">Merchant Profiles</div>
					<div className="text-sm text-[#6A7282] font-normal">
						Manage merchant processor accounts for this business.
					</div>
				</div>

				<div className="flex gap-3  flex-col sm:flex-row">
					<Button
						type="button"
						className={twMerge(
							"h-11 rounded-lg text-sm font-medium px-3 transition shadow-none",
							isButtonDisabled
								? "bg-gray-100 text-gray-400 border-gray-200 border cursor-not-allowed"
								: "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50",
						)}
						disabled={isButtonDisabled}
						onClick={async () => {
							setApiLoading(true);
							await onOnboard?.(paymentProcessorId);
							setApiLoading(false);
						}}
					>
						Onboard to Processor
					</Button>

					<CreateMerchantButton setOpen={setOpen} />
				</div>
			</CardTitle>
		</CardHeader>
	);
};

const ProcessorCell: React.FC<{ processorId: number }> = ({ processorId }) => {
	if (processorId === stripeProcessorId) {
		return (
			<div className="ml-2 flex items-center gap-2">
				<StripeIcon />
				<span className="font-medium text-gray-800">Stripe</span>
			</div>
		);
	}

	return <span className="ml-2 text-gray-700">Unknown</span>;
};

const MerchantProfileTable: React.FC<{
	data: MerchantAccountRowData;
	setOpen: Dispatch<SetStateAction<boolean | number>>;
	isLoading?: boolean;
	selectedIds: string[];
	setSelectedIds: Dispatch<SetStateAction<string[]>>;
	onOnboard: (paymentProcessorId: string) => Promise<void>;
}> = ({ data, isLoading, setOpen, onOnboard, selectedIds, setSelectedIds }) => {
	if (isLoading) return <SkeletonMerchantProfileTable setOpen={setOpen} />;
	if (!data?.length) return <EmptyState setOpen={setOpen} />;

	return (
		<Card className="bg-white">
			<MerchantCardHeader
				setOpen={setOpen}
				onOnboard={onOnboard}
				onboardDisabled={!selectedIds.length}
			/>
			<div className="pb-6">
				<div className="space-y-8">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead className="bg-[#F9FAFB]">
								<tr className="border-b border-t border-[#E5E7EB]">
									<th className="px-4 py-3">
										<input
											type="checkbox"
											className="h-5 w-5 cursor-pointer accent-blue-600"
											checked={
												selectedIds.length ===
												data.length
											}
											onChange={(e) => {
												setSelectedIds(
													e.target.checked
														? data.map(
																(d) =>
																	d.profileId,
															)
														: [],
												);
											}}
										/>
									</th>
									<th className="px-4 py-3 text-sm font-semibold text-left text-gray-600">
										Processor
									</th>
									<th className="px-4 py-3 text-sm font-semibold text-left text-gray-600">
										Status
									</th>
									<th className="px-4 py-3 text-sm font-semibold text-left text-gray-600">
										Account ID
									</th>
									<th className="px-4 py-3 text-sm font-semibold text-left text-gray-600">
										Created
									</th>
									<th className="px-4 py-3 text-sm font-semibold text-left text-gray-600">
										Last Updated
									</th>
									<th className="px-4 py-3 text-sm font-semibold text-left text-gray-600">
										Actions
									</th>
								</tr>
							</thead>

							<tbody className="divide-y divide-gray-100">
								{data.map((row) => {
									// Use processor_status from API response directly
									const status =
										row.processorStatus ??
										WorthPreProcessorStatus.NOT_SUBMITTED;
									const statusStyle =
										STATUS_STYLES[status] ??
										STATUS_STYLES[
											WorthProcessorStatus.UNKNOWN
										];
									const isChecked = selectedIds.includes(
										row.profileId,
									);
									return (
										<tr
											key={row.profileId}
											className="hover:bg-gray-50"
										>
											<td className="flex justify-center py-3.5 h-full">
												<input
													type="checkbox"
													checked={isChecked}
													className="h-5 w-5 cursor-pointer accent-blue-600"
													onChange={(e) => {
														setSelectedIds(
															(prev) =>
																e.target.checked
																	? [
																			...prev,
																			row.profileId,
																		]
																	: prev.filter(
																			(
																				id,
																			) =>
																				id !==
																				row.profileId,
																		),
														);
													}}
												/>
											</td>

											<td className="px-4 py-3 ml-2 text-sm text-gray-700">
												<ProcessorCell
													processorId={
														row.processorId
													}
												/>
											</td>

											<td className="px-4 py-3">
												<span
													className={twMerge(
														"inline-flex items-center px-2 py-1 text-xs font-medium rounded-md",
														statusStyle.bg,
														statusStyle.text,
													)}
												>
													{statusStyle.label}
												</span>
											</td>

											<td className="px-4 py-3 text-sm text-gray-700">
												<span className="px-2 py-1 bg-gray-100 rounded">
													{row.profileId}
												</span>
											</td>

											<td className="px-4 py-3 text-sm text-gray-600">
												{formatSourceDate(
													row.createdAt,
													DATE_FORMATS.MONTH_DAY_YEAR,
												)}
											</td>

											<td className="px-4 py-3 text-sm text-gray-600">
												{formatSourceDate(
													row.updatedAt,
													DATE_FORMATS.MONTH_DAY_YEAR,
												)}
											</td>

											<td className="px-4 py-3 text-left">
												<button
													className="text-blue-600 hover:text-blue-800 mr-3"
													onClick={() => {
														setOpen(1);
													}}
												>
													<EyeIcon className="h-5 w-5" />
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</Card>
	);
};

const MerchantProfilesTable: React.FC = () => {
	const { slug: businessId } = useParams();
	const { customerId } = useAppContextStore();
	const { errorToast, successToast } = useCustomToast();

	const [open, setOpen] = useState<boolean | number>(false);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const {
		data: merchantAccountData,
		isLoading: merchantAccountLoading,
		refetch: refetchMerchantAccount,
	} = useGetMerchantProfiles({
		businessId,
		customerId,
	});

	const { mutateAsync: onboardPaymentProcessor } =
		useOnboardPaymentProcessorAccounts();

	const handleOnboard = async (paymentProcessorId: string) => {
		await onboardPaymentProcessor({
			customerId,
			body: {
				customerId,
				platformId: stripeProcessorId,
				processorId: paymentProcessorId,
				businessIds: [businessId ?? ""],
			},
		})
			.then(() => {
				setSelectedIds([]);
				successToast("Successfully onboarded to payment processor.");
			})
			.catch((e) => {
				const errorMessage = e?.response?.data?.message;
				errorToast({
					message:
						typeof errorMessage === "string"
							? errorMessage
							: "An error occurred while onboarding to payment processor.",
				});
			});

		void refetchMerchantAccount();
	};

	return (
		<CaseWrapper>
			<div className="gap-6">
				<MerchantProfileTable
					data={mapMerchantAccounts(merchantAccountData)}
					setOpen={setOpen}
					isLoading={merchantAccountLoading}
					selectedIds={selectedIds}
					setSelectedIds={setSelectedIds}
					onOnboard={handleOnboard}
				/>
			</div>
			{!!open && (
				<ManageMerchantProfileModal
					isOpen={!!open}
					onClose={() => {
						setOpen(false);
					}}
					onSubmitSuccess={() => {
						void refetchMerchantAccount();
					}}
					businessId={businessId ?? ""}
					platformId={stripeProcessorId}
					customerId={customerId}
					disabled={open === 1}
				/>
			)}
		</CaseWrapper>
	);
};

export default MerchantProfilesTable;
