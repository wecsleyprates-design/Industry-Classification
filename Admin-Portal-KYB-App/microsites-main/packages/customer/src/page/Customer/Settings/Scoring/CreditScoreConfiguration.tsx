import React, { memo, useCallback, useEffect, useState } from "react";
import { type UseFormGetValues, type UseFormSetValue } from "react-hook-form";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import Toggle from "@/components/Input/Toggle";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import { useCustomToast } from "@/hooks";
import { useUpdateRiskAlertConfig } from "@/services/queries/riskAlert.query";
import {
	type IScoreRangesForm,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

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
	customerId: string;
}

const CreditScoreConfiguration: React.FC<Props> = ({
	riskConfigData,
	refetchRiskConfigHandler,
	setValue,
	getValues,
	customerId,
}) => {
	const { successToast, errorToast } = useCustomToast();
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
					new_adverse_media: getValues().newAdverseMediaStatus,
				},
			});
			refetchRiskConfigHandler?.();
		}
	}, [riskConfigData]);

	useEffect(() => {
		const score = riskConfigData?.data?.customer?.equifax_credit_score
			? Number(
					riskConfigData?.data?.customer?.equifax_credit_score?.MODERATE
						?.measurement_config?.threshold ?? 0,
				)
			: riskConfigData?.data?.admin?.equifax_credit_score
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
			successToast(updateRiskAlertConfigData?.message);
		}
	}, [updateRiskAlertConfigData]);

	useEffect(() => {
		if (updateRiskAlertConfigError) errorToast(updateRiskAlertConfigError);
	}, [updateRiskAlertConfigError]);

	return (
		<>
			<div className="pb-2">
				<div className="flex items-start justify-between px-4 sm:px-3 my-4">
					<div className="flex items-start gap-4 flex-1">
						<div className="text-red-600 rounded-lg bg-red-50 p-3 shrink-0">
							<ExclamationTriangleIcon className="w-5 h-5" />
						</div>
						<div>
							<p className="font-medium  text-[#1F2937] text-sm ">
								VantageScore® 4.0 Alerts
							</p>
							<p className="text-gray-500 font-normal text-sm mt-1">
								Trigger a medium severity risk alert for personal credit score
								declines exceeding selected percentage points.
							</p>
						</div>
					</div>
					<div className="mt-4 shrink-0">
						<Toggle
							disabled={false}
							value={getValues().creditScoreStatus}
							onChange={async () => {
								setValue("creditScoreStatus", !getValues().creditScoreStatus, {
									shouldDirty: true,
								});
							}}
						/>
					</div>
				</div>
				{getValues().creditScoreStatus && (
					<div className="rounded-lg">
						<div className="flex flex-row ml-12 gap-5">
							<SelectComponent
								defaultValue={{
									label: `${getValues().creditScoreChange}%`,
									value: Number(getValues().creditScoreChange),
								}}
								value={{
									label: `${getValues().creditScoreChange}%`,
									value: Number(getValues().creditScoreChange),
								}}
								options={getCreditScoreOptions()}
								onChange={(value) => {
									if (value) {
										setValue("creditScoreChange", Number(value.value), {
											shouldDirty: true,
										});
									}
								}}
								className="rounded-lg"
								customStyles={{
									control: (provided: any) => ({
										...provided,
										width: 100,
										height: 39,
										fontSize: "12px",
										fontWeight: 500,
										borderRadius: "8px",
										marginLeft: "28px",
									}),
									menu: (provided: any) => ({
										...provided,
										width: 100,
									}),
								}}
							/>
							<div>
								<Button
									color="grey"
									outline
									type="button"
									className="text-[#2563EB] rounded-lg h-10"
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
