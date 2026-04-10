import React, { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import CloseIcon from "@/assets/svg/CloseICon";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import {
	useGetCoreBetaSettings,
	useUpdateCustomerBetaSettings,
} from "@/services/queries/customer.query";
import Button from "../Button";
import CaseManagementV2Modal from "./Modals/CaseManagementV2Modal";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { useBetaSettings } from "@/providers/BetaSettingsProvider";

interface BetaOptInBannerProps {
	title: string;
	description: string;
	featureKey: "case_management_v2";
}

const BetaOptInBanner: React.FC<BetaOptInBannerProps> = ({
	title,
	description,
	featureKey,
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [isOpen, setIsOpen] = useState(false);
	const { successHandler } = useCustomToast();
	const { data: coreBetaSettings, isLoading: isCoreBetaSettingLoading } =
		useGetCoreBetaSettings();

	const {
		mutateAsync: updateCustomerSettings,
		isPending: isLoading,
		data: updateCustomerSettingsData,
	} = useUpdateCustomerBetaSettings();

	const {
		data: customerBetaSettings,
		isLoading: customerBetaSettingsLoading,
		refetch: fetchBetaSettings,
		isRefetching,
	} = useBetaSettings();

	const handleClose = async () => {
		await updateCustomerSettings({
			customerId,
			body: {
				feature: featureKey,
				is_enabled: false,
				prompt_seen_status: false,
			},
		});
	};

	const handleUpgrade = async () => {
		await updateCustomerSettings({
			customerId,
			body: {
				feature: featureKey,
				is_enabled: true,
			},
		});
		setIsOpen(false);
	};

	const showBanner = useMemo(() => {
		if (
			!customerBetaSettingsLoading &&
			!isRefetching &&
			!isLoading &&
			!isCoreBetaSettingLoading
		) {
			const feature = customerBetaSettings?.data?.find(
				(item) => item.feature === featureKey,
			);
			const coreFeature = coreBetaSettings?.data?.find(
				(item) => item.code === featureKey,
			);
			return coreFeature?.is_enabled &&
				typeof feature?.prompt_seen_status === "boolean"
				? !!feature?.prompt_seen_status
				: true;
		}
	}, [
		customerBetaSettings,
		customerBetaSettingsLoading,
		isRefetching,
		isLoading,
		featureKey,
		isCoreBetaSettingLoading,
		coreBetaSettings,
	]);

	useEffect(() => {
		if (updateCustomerSettingsData) {
			successHandler({
				message:
					updateCustomerSettingsData?.message ||
					"Settings updated successfully.",
			});
			void fetchBetaSettings?.();
		}
	}, [updateCustomerSettingsData]);

	return (
		<div>
			{showBanner ? (
				<div className="flex items-center justify-between p-4 mb-4 border rounded-lg bg-blue-50">
					<div className="items-center gap-x-2 md:flex">
						<div>
							<span className="text-sm font-medium text-[#1F2937]">
								{title}
							</span>
							<span className="text-xs px-2 py-0.5 rounded-full bg-[#FFFFFF] text-[#6666CC] font-medium">
								Beta
							</span>
						</div>

						<p className="text-sm font-normal text-[#1F2937]">
							• {description}
						</p>
						<Button
							onClick={() => {
								setIsOpen(true);
							}}
							className="text-sm font-semibold text-[#2563EB] px-0 py-0 flex gap-x-1 items-center align-middle"
						>
							Learn More
							<ArrowRightIcon className="w-4 h-4 text-[#2563EB]" />
						</Button>
					</div>
					<div
						className="mr-2 text-[#030712] rounded-sm cursor-pointer"
						onClick={handleClose}
					>
						<CloseIcon />
					</div>
				</div>
			) : null}
			{featureKey === "case_management_v2" && isOpen ? (
				<CaseManagementV2Modal
					isOpen={isOpen}
					onClose={() => {
						setIsOpen(false);
					}}
					handleUpgrade={handleUpgrade}
				/>
			) : null}
		</div>
	);
};

export default BetaOptInBanner;
