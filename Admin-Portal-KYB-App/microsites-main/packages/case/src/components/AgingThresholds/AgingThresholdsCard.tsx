import React, { useMemo, useState } from "react";
import {
	InformationCircleIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/outline";
import Badge from "@/components/Badge";
import { capitalize } from "@/lib/helper";
import {
	useGetBusinessApplicantConfig,
	useGetCustomerApplicantConfig,
} from "@/services/queries/aging.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type Aging } from "@/types/case";
import AgingThresholdsModal from "./AgingThresholdsModal";

import { Card } from "@/ui/card";
import { Tooltip } from "@/ui/tooltip";

const AgingThresholdsCard = ({
	businessId,
	customerId,
	aging,
}: {
	businessId: string;
	customerId: string;
	aging?: Aging;
}) => {
	const [isAgingThresholdsModalOpen, setisAgingThresholdsModalOpen] =
		useState(false);
	const { moduleType } = useAppContextStore();

	const { data: customerApplicantConfigData } = useGetCustomerApplicantConfig(
		customerId ?? "",
	);
	const { data: businessApplicantConfigData } = useGetBusinessApplicantConfig(
		businessId ?? "",
	);

	let agingThresholdColor: "red" | "green" | "yellow" | null = null;
	switch (aging?.urgency) {
		case "low":
			agingThresholdColor = "green";
			break;
		case "medium":
			agingThresholdColor = "yellow";
			break;
		case "high":
			agingThresholdColor = "red";
			break;
		default:
			agingThresholdColor = null;
	}

	const agingThresholds = useMemo(() => {
		const config =
			businessApplicantConfigData?.data?.config ??
			customerApplicantConfigData?.data?.config ??
			[];
		return config.reduce<Record<"low" | "medium" | "high", number>>(
			(acc, item) => {
				acc[item.urgency] = item.threshold;
				return acc;
			},
			{ low: 30, medium: 60, high: 90 },
		);
	}, [businessApplicantConfigData, customerApplicantConfigData]);

	return moduleType !== "standalone_case" &&
		customerApplicantConfigData?.data?.is_enabled ? (
		<Card className="flex flex-col gap-2 p-4 bg-white">
			<div className="flex justify-between">
				<div className="text-xs text-gray-500 flex items-center gap-x-1">
					Aging Threshold
					<Tooltip
						trigger={
							<div>
								<InformationCircleIcon className=" text-gray-500 min-w-4 min-h-4" />
							</div>
						}
						content={
							<p className="w-[367px]">
								Aging Threshold represents how long an
								application has been invited but not submitted.
								The thresholds are assigned after:
								<br />
								Low = {agingThresholds.low} days
								<br />
								Medium = {agingThresholds.medium} days
								<br />
								High = {agingThresholds.high} days
							</p>
						}
					/>
				</div>
				{agingThresholdColor === null ? (
					<span className="mr-2"> -</span>
				) : (
					<div className="font-semibold gap-x-2 flex">
						<>{aging?.days_since_invited} Days</>
						<Badge
							color={agingThresholdColor}
							text={
								capitalize(
									`${aging?.urgency} ${
										aging?.config_source === "business"
											? " • Custom "
											: ""
									}`,
								) ?? ""
							}
							className="text-xs"
						/>
						<button
							type="button"
							aria-label="Edit aging thresholds"
							className="p-0 m-0 bg-transparent border-none cursor-pointer"
							onClick={() => {
								setisAgingThresholdsModalOpen(true);
							}}
						>
							<PencilSquareIcon className="w-5 h-5 text-gray-800" />
						</button>
					</div>
				)}
			</div>
			<AgingThresholdsModal
				isOpen={isAgingThresholdsModalOpen}
				onClose={() => {
					setisAgingThresholdsModalOpen(false);
				}}
				showBanner={true}
				businessId={businessId ?? ""}
				customerId={customerId ?? ""}
			/>
		</Card>
	) : null;
};

export default AgingThresholdsCard;
