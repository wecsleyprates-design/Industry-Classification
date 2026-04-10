import React, { useMemo } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import useCustomToast from "@/hooks/useCustomToast";
import { downloadOcrDocumentUpload } from "@/services/api/integration.service";
import { type GetProcessingStatementsResponse } from "@/types/integrations";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { GuestOwnerStyle } from "@/constants/TailwindStyles";

interface ProcessingMetric {
	label: string;
	value: string;
	key: string;
	isGuestOwnerEdit?: boolean;
}

const createProcessingMetrics = ({
	data,
}: GetProcessingStatementsResponse): ProcessingMetric[] => {
	if (!data || data.length === 0) return [];

	const firstStatement = data[0];

	const formatCurrency = (value: number) =>
		value
			? new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
				}).format(value)
			: "-";

	return [
		{
			label: "Monthly Volume",
			value: formatCurrency(
				Number(firstStatement?.general_data?.monthly_volume ?? 0),
			),
			key: "monthlyVolumeGEN",
			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"monthly_volume",
				),
		},
		{
			label: "Annual Volume",
			value: formatCurrency(
				Number(firstStatement?.general_data?.annual_volume ?? 0),
			),
			key: "annualVolumeGEN",
			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"annual_volume",
				),
		},
		{
			label: "Average Ticket Size",
			value: formatCurrency(
				Number(firstStatement?.general_data?.average_ticket_size ?? 0),
			),
			key: "averageTicketSizeGEN",

			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"average_ticket_size",
				),
		},
		{
			label: "High Ticket",
			value: formatCurrency(
				Number(firstStatement?.general_data?.high_ticket_size ?? 0),
			),
			key: "highTicketSizeGEN",
			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"high_ticket_size",
				),
		},
		{
			label: "Desired Limit",
			value: formatCurrency(
				Number(firstStatement?.general_data?.desired_limit ?? 0),
			),
			key: "desiredLimitGEN",
			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"desired_limit",
				),
		},
		{
			label: "Monthly Occurrence of High Ticket",
			value:
				firstStatement?.general_data?.monthly_occurrence_of_high_ticket ?? "-",
			key: "monthlyOccurrenceOfHighTicket",
			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"monthly_occurrence_of_high_ticket",
				),
		},
		{
			label: "Explanation of High Ticket",
			value: firstStatement?.general_data?.explanation_of_high_ticket ?? "-",
			key: "explanationOfHighTicket",
			isGuestOwnerEdit:
				firstStatement?.general_data?.guest_owner_edits?.includes(
					"explanation_of_high_ticket",
				),
		},
		{
			label: "Is your business seasonal?",
			value:
				typeof firstStatement?.seasonal_data?.is_seasonal_business === "boolean"
					? firstStatement?.seasonal_data?.is_seasonal_business
						? "Yes"
						: "No"
					: "-",
			key: "isBusinessSeasonal",
			isGuestOwnerEdit:
				firstStatement?.seasonal_data?.guest_owner_edits?.includes(
					"is_seasonal_business",
				),
		},
		{
			label: "High Volume Months",
			value:
				firstStatement?.seasonal_data?.high_volume_months?.toString() ?? "-",
			key: "highVolumeMonths",
			isGuestOwnerEdit:
				firstStatement?.seasonal_data?.guest_owner_edits?.includes(
					"high_volume_months",
				),
		},
		{
			label: "Explanation of High Volume Months",
			value:
				firstStatement?.seasonal_data?.explanation_of_high_volume_months ?? "-",
			key: "explanationOfHighVolumeMonths",
			isGuestOwnerEdit:
				firstStatement?.seasonal_data?.guest_owner_edits?.includes(
					"explanation_of_high_volume_months",
				),
		},
		{
			label: "Visa/Mastercard/Discover (Monthly Volume)",
			value: formatCurrency(
				Number(firstStatement?.card_data?.monthly_volume ?? 0),
			),
			key: "monthlyVolumeVMD",
			isGuestOwnerEdit:
				firstStatement?.card_data?.guest_owner_edits?.includes(
					"monthly_volume",
				),
		},
		{
			label: "Visa/Mastercard/Discover (Annual Volume)",
			value: formatCurrency(
				Number(firstStatement?.card_data?.annual_volume ?? 0),
			),
			key: "annualVolumeVMD",
			isGuestOwnerEdit:
				firstStatement?.card_data?.guest_owner_edits?.includes("annual_volume"),
		},
		{
			label: "Visa/Mastercard/Discover (Average Ticket Size)",
			value: formatCurrency(
				Number(firstStatement?.card_data?.average_ticket_size ?? 0),
			),
			key: "averageTicketSizeVMD",
			isGuestOwnerEdit: firstStatement?.card_data?.guest_owner_edits?.includes(
				"average_ticket_size",
			),
		},
		{
			label: "Visa/Mastercard/Discover (High Ticket)",
			value: formatCurrency(
				Number(firstStatement?.card_data?.high_ticket_size ?? 0),
			),
			key: "highTicketSizeVMD",
			isGuestOwnerEdit:
				firstStatement?.card_data?.guest_owner_edits?.includes(
					"high_ticket_size",
				),
		},
		{
			label: "Visa/Mastercard/Discover (Desired Limit)",
			value: formatCurrency(
				Number(firstStatement?.card_data?.desired_limit ?? 0),
			),
			key: "desiredLimitVMD",
			isGuestOwnerEdit:
				firstStatement?.card_data?.guest_owner_edits?.includes("desired_limit"),
		},
		{
			label: "American Express (Monthly Volume)",
			value: formatCurrency(
				Number(firstStatement?.american_express_data?.monthly_volume ?? 0),
			),
			key: "monthlyVolumeAE",
			isGuestOwnerEdit:
				firstStatement?.american_express_data?.guest_owner_edits?.includes(
					"monthly_volume",
				),
		},
		{
			label: "American Express (Annual Volume)",
			value: formatCurrency(
				Number(firstStatement?.american_express_data?.annual_volume ?? 0),
			),
			key: "annualVolumeAE",
			isGuestOwnerEdit:
				firstStatement?.american_express_data?.guest_owner_edits?.includes(
					"annual_volume",
				),
		},
		{
			label: "American Express (Average Ticket Size)",
			value: formatCurrency(
				Number(firstStatement?.american_express_data?.average_ticket_size ?? 0),
			),
			key: "averageTicketSizeAE",
			isGuestOwnerEdit:
				firstStatement?.american_express_data?.guest_owner_edits?.includes(
					"average_ticket_size",
				),
		},
		{
			label: "American Express (High Ticket)",
			value: formatCurrency(
				Number(firstStatement?.american_express_data?.high_ticket_size ?? 0),
			),
			key: "highTicketSizeAE",
			isGuestOwnerEdit:
				firstStatement?.american_express_data?.guest_owner_edits?.includes(
					"high_ticket_size",
				),
		},
		{
			label: "American Express (Desired Limit)",
			value: formatCurrency(
				Number(firstStatement?.american_express_data?.desired_limit ?? 0),
			),
			key: "desiredLimitAE",
			isGuestOwnerEdit:
				firstStatement?.american_express_data?.guest_owner_edits?.includes(
					"desired_limit",
				),
		},
	];
};

const createPosVolumes = ({
	data,
}: GetProcessingStatementsResponse): ProcessingMetric[] => {
	if (!data || data.length === 0) return [];

	const firstStatement = data[0];
	const ps = firstStatement.point_of_sale_data;

	const total =
		(ps?.swiped_cards ?? 0) +
		(ps?.typed_cards ?? 0) +
		(ps?.e_commerce ?? 0) +
		(ps?.mail_telephone ?? 0);

	const formatPercent = (value: number) =>
		total > 0
			? new Intl.NumberFormat("en-US", {
					style: "percent",
					maximumFractionDigits: 0,
				}).format(value / total)
			: "-";

	return [
		{
			label: "Point of Sale Volume - Card (Swiped)",
			value: formatPercent(ps?.swiped_cards ?? 0),
			key: "swipedCards",
			isGuestOwnerEdit: ps?.guest_owner_edits?.includes("swiped_cards"),
		},
		{
			label: "Point of Sale Volume - Card (Keyed)",
			value: formatPercent(ps?.typed_cards ?? 0),
			key: "typedCards",
			isGuestOwnerEdit: ps?.guest_owner_edits?.includes("typed_cards"),
		},
		{
			label: "Point of Sale Volume - Card (eCommerce)",
			value: formatPercent(ps?.e_commerce ?? 0),
			key: "eCommerce",
			isGuestOwnerEdit: ps?.guest_owner_edits?.includes("e_commerce"),
		},
		{
			label: "Point of Sale Volume - Mail & Telephone",
			value: formatPercent(ps?.mail_telephone ?? 0),
			key: "mailAndTelephone",
			isGuestOwnerEdit: ps?.guest_owner_edits?.includes("mail_telephone"),
		},
	];
};

const ProcessingHistory = ({
	businessId,
	processingHistory,
}: {
	businessId: string;
	processingHistory: GetProcessingStatementsResponse;
}) => {
	const featureFlags = useFlags();
	const { errorHandler, successHandler } = useCustomToast();

	const processingMetrics = createProcessingMetrics(processingHistory);
	const posVolumes = createPosVolumes(processingHistory);

	const documents = useMemo(() => {
		return processingHistory?.data
			?.filter((item) => item?.file_name)
			?.map((val) => ({
				filePath: val.file_path,
				fileName: val.file_name,
			}));
	}, [processingHistory]);

	return (
		<div className="pt-0.5">
			<div className="relative mb-4">
				<div className="absolute inset-0 flex items-center" aria-hidden="true">
					<div className="w-full border-t border-gray-200" />
				</div>
				<div className="relative flex justify-start">
					<div className="pr-2 leading-6 text-gray-900 bg-white">
						<div className="flex gap-2">
							<h1 className="text-base text-gray-500">Processing History</h1>
						</div>
					</div>
				</div>
			</div>

			<div className="grid items-start grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
				{processingMetrics.map((metric, index) => {
					const klassName = `flex flex-col justify-between h-full ${
						[
							"explanationOfHighTicket",
							"isBusinessSeasonal",
							"highVolumeMonths",
							"explanationOfHighVolumeMonths",
						].includes(metric.key)
							? "md:col-span-2 xl:col-span-3"
							: ""
					}`;
					return (
						<div key={index} className={klassName}>
							<div className="text-sm text-gray-500 min-h-[40px] flex items-end">
								{metric.label}
							</div>
							<div
								className={twMerge(
									"mt-1 font-medium text-gray-900 text-md tabular-nums",
									metric?.isGuestOwnerEdit && GuestOwnerStyle,
								)}
							>
								{metric.value}
								<ConditionalPlusIcon
									isNotapplicant={metric?.isGuestOwnerEdit ?? false}
								/>
							</div>
						</div>
					);
				})}
			</div>

			<div className="grid items-start grid-cols-1 gap-4 mt-6 md:grid-cols-3">
				{posVolumes.map((volume, index) => (
					<div key={index} className="flex flex-col justify-between h-full">
						<div className="text-sm text-gray-500 min-h-[40px] flex items-end">
							{volume.label}
						</div>
						<div
							className={twMerge(
								"mt-1 font-medium text-gray-900 text-md tabular-nums",
								volume?.isGuestOwnerEdit && GuestOwnerStyle,
							)}
						>
							{volume.value}
							<ConditionalPlusIcon
								isNotapplicant={volume?.isGuestOwnerEdit ?? false}
							/>
						</div>
					</div>
				))}
			</div>

			<div className="mt-8">
				<h3 className="mb-2 text-gray-500 text-md">Statements</h3>
				{documents?.length
					? documents?.map((document) => (
							<button
								key={document.filePath}
								className={twMerge(
									"inline-flex items-center text-blue-600 cursor-pointer hover:text-blue-800",
									processingHistory?.data[0]?.guest_owner_edits?.includes(
										"file_name",
									) && GuestOwnerStyle,
								)}
								onClick={async () => {
									try {
										await downloadOcrDocumentUpload(
											businessId,
											document.filePath,
											document.fileName,
										);
										successHandler({
											message: `Document downloaded successfully`,
										});
									} catch (error) {
										errorHandler({ message: "Error downloading file" });
									}
								}}
							>
								<span>{document.fileName}</span>
								<ConditionalPlusIcon
									isNotapplicant={
										!!processingHistory?.data[0]?.guest_owner_edits?.includes(
											"file_name",
										)
									}
								/>
								<svg
									className="w-4 h-4 ml-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
									/>
								</svg>
							</button>
						))
					: "-"}
			</div>
			{featureFlags[FEATURE_FLAGES?.PAT_466_TRIGGERING_APPLICATION_EDIT] &&
			(processingHistory?.data[0]?.general_data?.guest_owner_edits?.length ||
				processingHistory?.data[0]?.american_express_data?.guest_owner_edits
					?.length ||
				processingHistory?.data[0]?.point_of_sale_data?.guest_owner_edits
					?.length ||
				processingHistory?.data[0]?.card_data?.guest_owner_edits?.length) ? (
				<div className="flex flex-row p-4 font-normal tracking-tight font-inter">
					<div className="flex items-center justify-center h-10 text-sm bg-blue-50 min-w-10">
						†
					</div>
					<div className="ml-4 text-xs ">
						Denotes fields that were filled out internally. These fields are
						only visible to applicants on documents that required an e-signature
						and have been mapped accordingly. For additional information, please
						reach out to your Worth representative.
					</div>
				</div>
			) : null}
		</div>
	);
};

export default ProcessingHistory;
