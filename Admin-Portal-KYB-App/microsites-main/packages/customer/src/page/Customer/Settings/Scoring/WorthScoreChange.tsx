import React, { useCallback, useEffect, useState } from "react";
import { type UseFormGetValues, type UseFormSetValue } from "react-hook-form";
import { ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import Toggle from "@/components/Input/Toggle";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import { useCustomToast } from "@/hooks";
import { useUpdateRiskAlertConfig } from "@/services/queries/riskAlert.query";
import {
	type IScoreRangesForm,
	type RiskAlertConfigBody,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

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
	customerId: string;
}

const WorthScoreChange: React.FC<Props> = ({
	riskConfigData,
	refetchRiskConfigHandler,
	updatePayload,
	setValue,
	getValues,
	customerId,
}) => {
	const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);

	const { successToast, errorToast } = useCustomToast();

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
					new_adverse_media: getValues().newAdverseMediaStatus,
				},
			});
			refetchRiskConfigHandler?.();
		}
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
							<ArrowTrendingDownIcon className="w-5 h-5" />
						</div>
						<div>
							<p className="font-medium  text-[#1F2937] text-sm ">
								Worth Score Change
							</p>
							<p className="text-gray-500 font-normal text-sm mt-1">
								Trigger high severity risk alert for Worth score decline
								exceeding selected point amount from score at time of
								onboarding.
							</p>
						</div>
					</div>
					<div className="mt-4 shrink-0">
						<Toggle
							disabled={false}
							value={getValues().worthScoreStatus}
							onChange={async () => {
								setValue("worthScoreStatus", !getValues().worthScoreStatus, {
									shouldDirty: true,
								});
							}}
						/>
					</div>
				</div>
				{getValues().worthScoreStatus && (
					<div className="rounded-lg">
						<div className="flex flex-row ml-12 gap-5">
							<SelectComponent
								defaultValue={{
									label: `${String(getValues().worthScoreChange)}`,
									value: Number(getValues().worthScoreChange),
								}}
								value={{
									label: `${String(getValues().worthScoreChange)}`,
									value: Number(getValues().worthScoreChange),
								}}
								options={getWorthScoreOptions()}
								onChange={(value) => {
									if (value) {
										setValue("worthScoreChange", Number(value.value), {
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
