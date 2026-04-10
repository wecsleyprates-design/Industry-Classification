import React, { useCallback, useEffect, useState } from "react";
import { type UseFormGetValues, type UseFormSetValue } from "react-hook-form";
import Button from "@/components/Button";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import Toggle from "@/components/Input/Toggle";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { useUpdateRiskAlertConfig } from "@/services/queries/riskAlert.query";
import {
	type IScoreRangesForm,
	type RiskAlertConfigBody,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const getWorthScoreOptions = () => {
	const options: Array<{ value: number; label: string }> = [];
	for (let i = 10; i <= 100; i += 10) {
		options.push({ value: i, label: i.toString() });
	}
	return options;
};

interface Props {
	riskConfigData?: RiskAlertConfigurationResponse;
	refetchRiskConfigHandler?: () => void;
	updatePayload?: (payload: RiskAlertConfigBody) => void;
	setValue: UseFormSetValue<IScoreRangesForm>;
	getValues: UseFormGetValues<IScoreRangesForm>;
}

const WorthScoreChange: React.FC<Props> = ({
	riskConfigData,
	refetchRiskConfigHandler,
	updatePayload,
	setValue,
	getValues,
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);

	const { successHandler, errorHandler } = useCustomToast();

	useEffect(() => {
		const customerData =
			JSON.stringify(riskConfigData?.data?.customer) !== JSON.stringify({});
		const adminData =
			JSON.stringify(riskConfigData?.data?.admin) !== JSON.stringify({});
		const score = customerData
			? Number(
					riskConfigData?.data?.customer?.worth_score_change?.HIGH
						.measurement_config.threshold ?? 50,
				)
			: adminData
				? Number(
						riskConfigData?.data?.admin?.worth_score_change?.HIGH
							.measurement_config.threshold ?? 50,
					)
				: 50;
		const worthScoreStatus =
			riskConfigData?.data?.customer?.risk_alert_statuses
				?.worth_score_change_status !== undefined
				? riskConfigData?.data?.customer?.risk_alert_statuses
						?.worth_score_change_status
				: riskConfigData?.data?.admin?.risk_alert_statuses
							?.worth_score_change_status !== undefined
					? riskConfigData?.data?.admin?.risk_alert_statuses
							?.worth_score_change_status
					: false;
		setValue("worthScoreChange", score);
		setValue("worthScoreStatus", worthScoreStatus);
	}, [riskConfigData]);

	const {
		mutateAsync: updateRiskAlertConfig,
		data: updateRiskAlertConfigData,
		error: updateRiskAlertConfigError,
		isPending: isLoading,
	} = useUpdateRiskAlertConfig();

	const handleDefaultWorthScoreChange = useCallback(async () => {
		const threshold =
			riskConfigData?.data?.admin?.worth_score_change?.HIGH?.measurement_config
				?.threshold;
		if (threshold) {
			setValue("worthScoreChange", threshold);
			await updateRiskAlertConfig({
				customer_id: customerId,
				worth_score_change_config: [
					{
						risk_level: "HIGH",
						drop_value: Number(threshold),
					},
				],
				risk_alert_statuses: {
					risk_alerts_status: getValues().riskAlertsStatus, // Universal
					score_risk_tier_transition_status:
						getValues().scoreRiskTierTransitionStatus,
					new_bankruptcy_lien_judgement_status:
						getValues().newBankruptcyLienJudgementStatus,
					worth_score_change_status: getValues().worthScoreStatus,
					credit_score_config_status: getValues().creditScoreStatus,
				},
			});
			refetchRiskConfigHandler?.();
		}
	}, [riskConfigData]);

	useEffect(() => {
		if (updateRiskAlertConfigData) {
			successHandler({ message: updateRiskAlertConfigData?.message });
		}
	}, [updateRiskAlertConfigData]);

	useEffect(() => {
		if (updateRiskAlertConfigError) errorHandler(updateRiskAlertConfigError);
	}, [updateRiskAlertConfigError]);

	return (
		<>
			{isLoading && <FullPageLoader />}
			<div className="pb-4 border-b border-[#E5E7EB]">
				<div className="justify-between my-6 sm:flex py-b">
					<div className="px-3 sm:px-4">
						<p className="font-semibold  text-[#1F2937] text-base ">
							Worth Score Change Risk Alerts
						</p>
						<p className="text-[#6B7280] font-normal text-sm">
							Trigger high severity risk alert for Worth score decline exceeding
							selected point amount from score at time of onboarding.
						</p>
					</div>
					<div className="mt-5">
						<Toggle
							disabled={false}
							value={getValues().worthScoreStatus}
							onChange={async () => {
								setValue("worthScoreStatus", !getValues().worthScoreStatus);
							}}
						/>
					</div>
				</div>
				{getValues().worthScoreStatus && (
					<div className="rounded-lg">
						<div className="flex flex-col-reverse px-3 sm:grid sm:grid-cols-6 sm:relative">
							<div className="my-2 text-end">
								<SelectComponent
									defaultValue={{
										label: `${String(getValues().worthScoreChange)}`,
										value: Number(getValues().worthScoreChange),
									}}
									value={{
										label: `${String(getValues().worthScoreChange)}`,
										value: Number(getValues().worthScoreChange),
									}}
									className="w-full sm:w-[100px] text-start"
									options={getWorthScoreOptions()}
									onChange={(value) => {
										setValue("worthScoreChange", Number(value.value));
									}}
								/>
							</div>
							<div className="my-1 text-end">
								<Button
									color="grey"
									outline
									type="button"
									className="text-[#2563EB] rounded-lg my-1 h-11 hidden sm:block"
									onClick={() => {
										setIsWarningModalOpen(true);
									}}
								>
									Reset to default
								</Button>
							</div>
						</div>
						<div className="px-3">
							<Button
								color="grey"
								type="button"
								outline
								className="text-[#2563EB] w-full py-3  rounded-lg my-5 sm:hidden block"
								onClick={() => {
									setIsWarningModalOpen(true);
								}}
							>
								Reset to default
							</Button>
						</div>
					</div>
				)}
			</div>
			{isWarningModalOpen && (
				<WarningModal
					isOpen={isWarningModalOpen}
					onClose={() => {
						setIsWarningModalOpen(false);
					}}
					onSucess={handleDefaultWorthScoreChange}
					title={"Reset to default"}
					description={
						"Are you sure you want to update the relative score to default?"
					}
					buttonText={"Yes"}
					type={"dark"}
				/>
			)}
		</>
	);
};

export default WorthScoreChange;
