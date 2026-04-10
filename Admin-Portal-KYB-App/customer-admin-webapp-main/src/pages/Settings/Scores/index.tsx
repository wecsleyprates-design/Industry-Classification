import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import Button from "@/components/Button";
import Toggle from "@/components/Input/Toggle";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { scoreRangesSchema } from "@/lib/validation";
import {
	useGetCustomerIntegrationSettingsByCustomerId,
	useGetRiskAlertConfig,
	useUpdateRiskAlertConfig,
} from "@/services/queries/riskAlert.query";
import {
	type IScoreRangesForm,
	type RiskAlertConfigBody,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";
import CreditScoreConfiguration from "./CreditScoreConfiguration";
import ScoreRangeConfiguration from "./ScoreRangeConfiguration";
import WorthScoreChange from "./WorthScoreChange";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const getData = (
	type: "customer" | "admin",
	riskConfigData: RiskAlertConfigurationResponse,
) => ({
	HIGHmin: Number(
		riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config?.min ??
			0,
	),
	HIGHmax: Number(
		riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config?.max ??
			0,
	),
	MODERATEmin: Number(
		riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
			?.min ?? 0,
	),
	MODERATEmax: Number(
		riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
			?.max ?? 0,
	),
	LOWmin: Number(
		riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config?.min ??
			0,
	),
	LOWmax: Number(
		riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config?.max ??
			0,
	),
	creditScoreChange: Number(
		riskConfigData?.data?.[type]?.equifax_credit_score?.MODERATE
			?.measurement_config?.threshold,
	),
	worthScoreChange: Number(
		riskConfigData?.data?.[type]?.worth_score_change?.HIGH?.measurement_config
			?.threshold,
	),
	creditScoreStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.credit_score_config_status,
	worthScoreStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.worth_score_change_status,
	scoreRiskTierTransitionStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.score_risk_tier_transition_status,
	newBankruptcyLienJudgementStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses
			?.new_bankruptcy_lien_judgement_status,
	riskAlertsStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses?.risk_alerts_status,
	newAdverseMediaStatus:
		riskConfigData?.data?.[type]?.risk_alert_statuses?.new_adverse_media,
});

const Scores = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [requestPayload, setRequestPayload] = useState<RiskAlertConfigBody>({});
	const [showModal, setShowModal] = useState<boolean>(false);
	const {
		register,
		setValue,
		getValues,
		reset,
		watch,
		handleSubmit,
		formState: { errors },
	} = useForm<IScoreRangesForm>({
		mode: "all",
		defaultValues: {
			HIGHmin: 0,
			HIGHmax: 549,
			MODERATEmin: 550,
			MODERATEmax: 699,
			LOWmin: 700,
			LOWmax: 850,
			creditScoreChange: 15,
			worthScoreChange: 50,
		},
		resolver: yupResolver(scoreRangesSchema),
	});
	const { successHandler, errorHandler } = useCustomToast();

	const {
		data: riskConfigData,
		isLoading,
		refetch: refetchRiskConfig,
	} = useGetRiskAlertConfig(customerId);

	const {
		mutateAsync: updateRiskAlertConfig,
		data: updateRiskAlertConfigData,
		error: updateRiskAlertConfigError,
		isPending: updateRiskAlertConfigLoading,
	} = useUpdateRiskAlertConfig();

	const { data: customerIntegrationSettingsData } =
		useGetCustomerIntegrationSettingsByCustomerId(customerId ?? "");

	useEffect(() => {
		if (updateRiskAlertConfigData) {
			successHandler({ message: updateRiskAlertConfigData?.message });
		}
	}, [updateRiskAlertConfigData]);
	useEffect(() => {
		const riskAlertsStatus =
			riskConfigData?.data?.customer?.risk_alert_statuses
				?.risk_alerts_status !== undefined
				? riskConfigData?.data?.customer?.risk_alert_statuses
						?.risk_alerts_status
				: riskConfigData?.data?.admin?.risk_alert_statuses
							?.risk_alerts_status !== undefined
					? riskConfigData?.data?.admin?.risk_alert_statuses?.risk_alerts_status
					: false;

		const newBankruptcyLienJudgementStatus =
			riskConfigData?.data?.customer?.risk_alert_statuses
				?.new_bankruptcy_lien_judgement_status !== undefined
				? riskConfigData?.data?.customer?.risk_alert_statuses
						?.new_bankruptcy_lien_judgement_status
				: riskConfigData?.data?.admin?.risk_alert_statuses
							?.new_bankruptcy_lien_judgement_status !== undefined
					? riskConfigData?.data?.admin?.risk_alert_statuses
							?.new_bankruptcy_lien_judgement_status
					: false;

		const scoreRiskTierTransitionStatus =
			riskConfigData?.data?.customer?.risk_alert_statuses
				?.score_risk_tier_transition_status !== undefined
				? riskConfigData?.data?.customer?.risk_alert_statuses
						?.score_risk_tier_transition_status
				: riskConfigData?.data?.admin?.risk_alert_statuses
							?.score_risk_tier_transition_status !== undefined
					? riskConfigData?.data?.admin?.risk_alert_statuses
							?.score_risk_tier_transition_status
					: false;

		const newAdverseMediaStatus =
			riskConfigData?.data?.customer?.risk_alert_statuses?.new_adverse_media !==
			undefined
				? riskConfigData?.data?.customer?.risk_alert_statuses?.new_adverse_media
				: riskConfigData?.data?.admin?.risk_alert_statuses
							?.new_adverse_media !== undefined
					? riskConfigData?.data?.admin?.risk_alert_statuses?.new_adverse_media
					: false;

		setValue("riskAlertsStatus", riskAlertsStatus);
		setValue(
			"newBankruptcyLienJudgementStatus",
			newBankruptcyLienJudgementStatus,
		);
		setValue("scoreRiskTierTransitionStatus", scoreRiskTierTransitionStatus);
		setValue("newAdverseMediaStatus", newAdverseMediaStatus);
	}, [riskConfigData]);
	useEffect(() => {
		if (updateRiskAlertConfigError) errorHandler(updateRiskAlertConfigError);
	}, [updateRiskAlertConfigError]);

	const refetchRiskConfigHandler = async () => {
		await refetchRiskConfig();
	};

	const discardChangeHandler = async () => {
		if (riskConfigData) {
			const customerData = getData("customer", riskConfigData);
			reset(customerData);
		}
	};

	const handleSaveChanges = async () => {
		await updateRiskAlertConfig(requestPayload);
		await refetchRiskConfig();
	};

	const onSubmit = (data: IScoreRangesForm) => {
		const {
			HIGHmax,
			HIGHmin,
			MODERATEmax,
			MODERATEmin,
			LOWmax,
			LOWmin,
			creditScoreChange,
			worthScoreChange,
			creditScoreStatus,
			worthScoreStatus,
			scoreRiskTierTransitionStatus,
			newBankruptcyLienJudgementStatus,
			riskAlertsStatus,
			newAdverseMediaStatus,
		} = data;
		const payload = {
			customer_id: customerId,
			score_config: [
				{
					risk_level: "HIGH" as "HIGH" | "MODERATE" | "LOW",
					min: Number(HIGHmin),
					max: Number(HIGHmax),
				},
				{
					risk_level: "MODERATE" as "HIGH" | "MODERATE" | "LOW",
					min: Number(MODERATEmin),
					max: Number(MODERATEmax),
				},
				{
					risk_level: "LOW" as "HIGH" | "MODERATE" | "LOW",
					min: Number(LOWmin),
					max: Number(LOWmax),
				},
			],
			worth_score_change_config: [
				{
					risk_level: "HIGH" as "HIGH" | "MODERATE" | "LOW",
					drop_value: Number(worthScoreChange),
				},
			],
			credit_score_config: [
				{
					risk_level: "MODERATE" as "HIGH" | "MODERATE" | "LOW",
					drop_percentage: Number(creditScoreChange),
				},
			],
			risk_alert_statuses: {
				risk_alerts_status: riskAlertsStatus, // Universal
				score_risk_tier_transition_status: scoreRiskTierTransitionStatus,
				new_bankruptcy_lien_judgement_status: newBankruptcyLienJudgementStatus,
				worth_score_change_status: worthScoreStatus,
				credit_score_config_status: creditScoreStatus,
				new_adverse_media: newAdverseMediaStatus,
			},
		};
		setRequestPayload(payload);
		setShowModal(true);
	};

	const checkValueChange = (currentValues: any, oldValues: any) => {
		if (currentValues && oldValues) {
			if (
				currentValues?.HIGHmin === oldValues?.HIGHmin &&
				currentValues?.HIGHmax === oldValues?.HIGHmax &&
				currentValues?.MODERATEmin === oldValues?.MODERATEmin &&
				currentValues?.MODERATEmax === oldValues?.MODERATEmax &&
				currentValues?.LOWmin === oldValues?.LOWmin &&
				currentValues?.LOWmax === oldValues?.LOWmax &&
				currentValues?.creditScoreChange === oldValues?.creditScoreChange &&
				currentValues?.worthScoreChange === oldValues?.worthScoreChange &&
				currentValues?.riskAlertsStatus === oldValues?.riskAlertsStatus &&
				currentValues?.creditScoreStatus === oldValues?.creditScoreStatus &&
				currentValues?.worthScoreStatus === oldValues?.worthScoreStatus &&
				currentValues?.scoreRiskTierTransitionStatus ===
					oldValues?.scoreRiskTierTransitionStatus &&
				currentValues?.newBankruptcyLienJudgementStatus ===
					oldValues?.newBankruptcyLienJudgementStatus &&
				currentValues?.newAdverseMediaStatus ===
					oldValues?.newAdverseMediaStatus
			)
				return false;
			else return true;
		}
	};

	const renderButtons = useMemo(
		() =>
			riskConfigData &&
			checkValueChange(getValues(), getData("customer", riskConfigData)),
		[riskConfigData, getValues()],
	);

	return (
		<>
			<form onSubmit={handleSubmit(onSubmit)}>
				{isLoading && <FullPageLoader />}
				<div className="mb-8 p-4 border rounded-2xl  border-[#E5E7EB] bg-white">
					<div className="justify-between my-6 sm:flex">
						<div className="px-3 sm:px-4 ">
							<p className="font-semibold  text-[#1F2937] text-base ">
								Risk Alerts
							</p>
							<p className="text-[#6B7280] font-normal text-sm">
								{watch().riskAlertsStatus ? (
									<>
										Customize and define which type of risk alerts are enabled.
										To disable risk monitoring please
									</>
								) : (
									<>To Enable risk monitoring please</>
								)}

								<Link
									to="mailto:support@joinworth.com"
									className="text-blue-500"
								>
									<span> </span>
									contact us.
								</Link>
							</p>
						</div>
						<div className="mt-5 opacity-50 pointer-events-none">
							<Toggle
								disabled={true}
								value={watch().riskAlertsStatus}
								onChange={() => {}}
							/>
						</div>
					</div>
				</div>
				{watch().riskAlertsStatus && (
					<div>
						<ScoreRangeConfiguration
							riskConfigData={riskConfigData}
							register={register}
							setValue={setValue}
							getValues={getValues}
							reset={reset}
							watch={watch}
							handleSubmit={handleSubmit}
							errors={errors}
							values={watch()}
						/>
						<div className="mt-10 p-4 border rounded-2xl border-[#E5E7EB] bg-white">
							<div className="pb-4 border-b border-[#E5E7EB]">
								<div className="justify-between my-6 sm:flex py-b">
									<div className="px-3 sm:px-4">
										<p className="font-semibold  text-[#1F2937] text-base ">
											Movement to Higher Risk Tier
										</p>
										<p className="text-[#6B7280] font-normal text-sm">
											A score from a low risk tier to a medium risk tier
											triggers a medium risk alert. A score from a medium risk
											tier to a high risk tier triggers a high risk alert.
										</p>
									</div>
									<div className="mt-5">
										<Toggle
											disabled={false}
											value={getValues().scoreRiskTierTransitionStatus}
											onChange={async () => {
												setValue(
													"scoreRiskTierTransitionStatus",
													!getValues().scoreRiskTierTransitionStatus,
												);
											}}
										/>
									</div>
								</div>
							</div>

							<div className="pb-4 border-b border-[#E5E7EB]">
								<div className="justify-between my-6 sm:flex py-b">
									<div className="px-3 sm:px-4">
										<p className="font-semibold  text-[#1F2937] text-base ">
											New Adverse Media
										</p>
										<p className="text-[#6B7280] font-normal text-sm">
											{customerIntegrationSettingsData?.data?.settings
												?.isAdverseMediaEnabled ? (
												<>
													Trigger a medium risk alert when new adverse media is
													found for the company, control person, or any
													beneficial owners.
												</>
											) : (
												<>
													To enable Adverse Media monitoring, please
													<Link
														to="mailto:support@joinworth.com"
														className="text-blue-500"
													>
														<span> </span>contact us.
													</Link>
												</>
											)}
										</p>
									</div>
									<div
										className={`mt-5 ${
											customerIntegrationSettingsData?.data?.settings
												?.isAdverseMediaEnabled
												? ""
												: "opacity-50 pointer-events-none"
										}`}
									>
										<Toggle
											disabled={
												!customerIntegrationSettingsData?.data?.settings
													?.isAdverseMediaEnabled
											}
											value={
												customerIntegrationSettingsData?.data?.settings
													?.isAdverseMediaEnabled
													? getValues().newAdverseMediaStatus
													: false
											}
											onChange={async () => {
												setValue(
													"newAdverseMediaStatus",
													!getValues().newAdverseMediaStatus,
												);
											}}
										/>
									</div>
								</div>
							</div>
							<div className="pb-4 border-b border-[#E5E7EB]">
								<div className="justify-between my-6 sm:flex py-b">
									<div className="px-3 sm:px-4">
										<p className="font-semibold  text-[#1F2937] text-base ">
											New Bankruptcy, Lien, or Judgement
										</p>
										<p className="text-[#6B7280] font-normal text-sm">
											Trigger a high risk alert when there is a delta between a
											reported date, amount, status, or count.
										</p>
									</div>
									<div className="mt-5">
										<Toggle
											disabled={false}
											value={getValues().newBankruptcyLienJudgementStatus}
											onChange={async () => {
												setValue(
													"newBankruptcyLienJudgementStatus",
													!getValues().newBankruptcyLienJudgementStatus,
												);
											}}
										/>
									</div>
								</div>
							</div>
							<WorthScoreChange
								riskConfigData={riskConfigData}
								refetchRiskConfigHandler={refetchRiskConfigHandler}
								setValue={setValue}
								getValues={getValues}
							/>
							<CreditScoreConfiguration
								riskConfigData={riskConfigData}
								refetchRiskConfigHandler={refetchRiskConfigHandler}
								setValue={setValue}
								getValues={getValues}
							/>
						</div>
						<motion.div
							initial={{ y: "100%", opacity: 0 }}
							animate={{
								y: renderButtons ? "0%" : "100%",
								opacity: renderButtons ? 1 : 0,
							}}
							transition={{ duration: 0.5 }}
							className="fixed bottom-0 z-50 flex items-center justify-between w-full h-[72px] -ml-4 bg-white border-t border-gray-200 shadow-sm sm:-ml-8 shrink-0"
						>
							<div></div>
							<div className="mr-2 space-x-2 sm:mr-10 lg:mr-80">
								<Button
									color="transparent"
									type="button"
									outline
									className="rounded-lg"
									onClick={discardChangeHandler}
								>
									Discard Changes
								</Button>
								<Button
									onClick={() => {
										handleSubmit(onSubmit);
									}}
									type="submit"
									color="dark"
									className="rounded-lg sm:w-fit"
									isLoading={updateRiskAlertConfigLoading}
								>
									Save Changes
								</Button>
							</div>
						</motion.div>
					</div>
				)}
			</form>

			{showModal && (
				<WarningModal
					isOpen={showModal}
					onClose={() => {
						setShowModal(false);
					}}
					onSucess={async () => {
						await handleSaveChanges();
					}}
					title={"Update Configurations"}
					description={"Are you sure you want to change the configurations?"}
					buttonText={"Yes"}
					type={"dark"}
				/>
			)}
		</>
	);
};

export default Scores;
