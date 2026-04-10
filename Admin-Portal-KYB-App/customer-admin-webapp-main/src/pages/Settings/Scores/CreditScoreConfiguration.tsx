import React, { memo, useCallback, useEffect, useState } from "react";
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
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const getCreditScoreOptions = () => {
	const options: Array<{ value: number; label: string }> = [];
	for (let i = 5; i <= 40; i += 5) {
		options.push({ value: i, label: `${i}%` });
	}
	return options;
};

interface Props {
	riskConfigData?: RiskAlertConfigurationResponse;
	refetchRiskConfigHandler?: () => void;
	setValue: UseFormSetValue<IScoreRangesForm>;
	getValues: UseFormGetValues<IScoreRangesForm>;
}

const CreditScoreConfiguration: React.FC<Props> = ({
	riskConfigData,
	refetchRiskConfigHandler,
	setValue,
	getValues,
}) => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { successHandler, errorHandler } = useCustomToast();
	const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);

	const {
		mutateAsync: updateRiskAlertConfig,
		data: updateRiskAlertConfigData,
		error: updateRiskAlertConfigError,
		isPending: isLoading,
	} = useUpdateRiskAlertConfig();

	const handleDefaultCreditScore = useCallback(async () => {
		const threshold =
			riskConfigData?.data?.admin?.equifax_credit_score?.MODERATE
				?.measurement_config?.threshold;
		if (threshold) {
			setValue("creditScoreChange", threshold);
			await updateRiskAlertConfig({
				customer_id: customerId,
				credit_score_config: [
					{
						risk_level: "MODERATE",
						drop_percentage: Number(threshold),
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
		const customerData =
			JSON.stringify(riskConfigData?.data?.customer) !== JSON.stringify({});
		const adminData =
			JSON.stringify(riskConfigData?.data?.admin) !== JSON.stringify({});
		const score = customerData
			? Number(
					riskConfigData?.data?.customer?.equifax_credit_score?.MODERATE
						?.measurement_config?.threshold ?? 0,
				)
			: adminData
				? Number(
						riskConfigData?.data?.admin?.equifax_credit_score?.MODERATE
							?.measurement_config?.threshold ?? 0,
					)
				: 0;
		const creditScoreStatus =
			riskConfigData?.data?.customer?.risk_alert_statuses
				?.credit_score_config_status !== undefined
				? riskConfigData?.data?.customer?.risk_alert_statuses
						?.credit_score_config_status
				: riskConfigData?.data?.admin?.risk_alert_statuses
							?.credit_score_config_status !== undefined
					? riskConfigData?.data?.admin?.risk_alert_statuses
							?.credit_score_config_status
					: false;
		setValue("creditScoreStatus", creditScoreStatus);
		setValue("creditScoreChange", score);
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
			<div>
				<div className="rounded-lg">
					<div className="justify-between my-6 sm:flex py-b">
						<div className="px-3 py-b sm:px-4">
							<p className="font-semibold  text-[#1F2937] text-base">
								VantageScore® 4.0 Alerts
							</p>
							<p className="text-[#6B7280] font-normal text-sm">
								Trigger a medium severity risk alert for personal credit score
								declines exceeding selected percentage points.
							</p>
						</div>
						<div className="mt-5">
							<Toggle
								disabled={false}
								value={getValues().creditScoreStatus}
								onChange={async () => {
									setValue("creditScoreStatus", !getValues().creditScoreStatus);
								}}
							/>
						</div>
					</div>
					{getValues().creditScoreStatus && (
						<div className="rounded-lg">
							<div className="text-sm">
								<div className="flex flex-col-reverse px-3 sm:grid sm:grid-cols-6 sm:relative">
									<div className="my-2 text-end">
										<SelectComponent
											defaultValue={{
												label: `${getValues().creditScoreChange}%`,
												value: Number(getValues().creditScoreChange),
											}}
											value={{
												label: `${getValues().creditScoreChange}%`,
												value: Number(getValues().creditScoreChange),
											}}
											className="w-full sm:w-[100px] text-start"
											options={getCreditScoreOptions()}
											onChange={(value) => {
												setValue("creditScoreChange", Number(value.value));
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
										outline
										type="button"
										className="text-[#2563EB] w-full py-3  rounded-lg my-5 sm:hidden block"
										onClick={() => {
											setIsWarningModalOpen(true);
										}}
									>
										Reset to default
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
			{isWarningModalOpen && (
				<WarningModal
					isOpen={isWarningModalOpen}
					onClose={() => {
						setIsWarningModalOpen(false);
					}}
					onSucess={handleDefaultCreditScore}
					title={"Reset to default"}
					description={
						"Are you sure you want to reset the credit score configuration to default?"
					}
					buttonText={"Yes"}
					type={"dark"}
				/>
			)}
		</>
	);
};

export default memo(CreditScoreConfiguration);
