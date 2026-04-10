import React, { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import { useFlags } from "launchdarkly-react-client-sdk";
import { type ObjectSchema } from "yup";
import Button from "@/components/Button";
import { WarningModal } from "@/components/Modal";
import { FullPageLoader } from "@/components/Spinner";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import { useCustomToast } from "@/hooks";
import { getFlagValue } from "@/lib/helper";
import { scoreRangesSchema } from "@/lib/validation";
import {
	useGetCustomerApplicantConfig,
	useUpdateCustomerApplicantConfig,
	useUpdateCustomerApplicantDaysConfig,
} from "@/services/queries/aging.query";
import { useGetCustomerIntegrationSettingsByCustomerId } from "@/services/queries/customer.query";
import {
	useGetRiskAlertConfig,
	useUpdateRiskAlertConfig,
} from "@/services/queries/riskAlert.query";
import {
	type ApplicantConfigBody,
	type ApplicantDaysConfigBody,
	type ApplicantDaysConfigPreBody,
	type CustomerApplicantConfigResponse,
} from "@/types/agingThreshold";
import {
	type IScoreRangesForm,
	type RiskAlertConfigBody,
} from "@/types/riskAlerts";
import AgingThresholds from "./AgingThresholds";
import DecisioningSelection from "./DecisioningSelection";
import { getRiskConfigData } from "./riskConfigHelper";
import RiskMonitoring from "./RiskMonitoring";
import ScoreRangeConfiguration from "./ScoreRangeConfiguration";

import { PLATFORM } from "@/constants/Platform";

interface Props {
	customerId: string;
	platform?: "admin" | "customer";
}

const RiskMonitoringScoring: React.FC<Props> = ({
	customerId,
	platform = "admin",
}) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [requestPayload, setRequestPayload] = useState<
		[RiskAlertConfigBody, ApplicantConfigBody, ApplicantDaysConfigPreBody]
	>([{}, {}, {}]);
	const [showModal, setShowModal] = useState<boolean>(false);
	const [activeId, setActiveId] = useState<number>(0); // Default to Scoring tab (id: 0)

	useEffect(() => {
		const subtab = searchParams.get("subtab");
		if (subtab === "decisioning") {
			setActiveId(2);
		} else if (subtab === "risk-alerts") {
			setActiveId(1);
		} else if (subtab === "scoring") {
			setActiveId(0);
		}
	}, [searchParams]);

	const handleTabChange = (id: number) => {
		setActiveId(id);
		const newParams = new URLSearchParams(searchParams);
		if (id === 2) {
			newParams.set("subtab", "decisioning");
		} else if (id === 1) {
			newParams.set("subtab", "risk-alerts");
		} else {
			newParams.set("subtab", "scoring");
		}
		setSearchParams(newParams);
	};

	const flags = useFlags();
	const isApprovalWorkflowsEnabled = getFlagValue(
		flags.FOTC_79_APPROVAL_WORKFLOWS,
	);

	const methods = useForm<IScoreRangesForm>({
		mode: "all",
		defaultValues: {
			HIGHmin: 0,
			HIGHmax: 549,
			MODERATEmin: 550,
			MODERATEmax: 699,
			LOWmin: 700,
			LOWmax: 850,
			agingThreshold: false,
			agingThresholdLOW: 30,
			agingThresholdMEDIUM: 60,
			agingThresholdHIGH: 90,
			creditScoreChange: 15,
			worthScoreChange: 50,
			riskAlertsStatus: false,
			creditScoreStatus: false,
			worthScoreStatus: false,
			scoreRiskTierTransitionStatus: false,
			newBankruptcyLienJudgementStatus: false,
			newAdverseMediaStatus: false,
		},
		resolver: yupResolver(scoreRangesSchema as ObjectSchema<IScoreRangesForm>),
	});

	const {
		register,
		setValue,
		getValues,
		reset,
		watch,
		handleSubmit,
		trigger,
		formState: { errors, isDirty, dirtyFields },
	} = methods;

	const { data: customerIntegrationSettingsData } =
		useGetCustomerIntegrationSettingsByCustomerId(customerId ?? "");

	const {
		data: riskConfigData,
		isLoading: riskConfigLoading,
		refetch: refetchRiskConfig,
	} = useGetRiskAlertConfig(customerId ?? "");

	const {
		data: customerApplicantConfigData,
		isLoading: customerApplicantConfigLoading,
		refetch: refetchCustomerApplicantConfig,
	} = useGetCustomerApplicantConfig(customerId ?? "");

	const { successToast, errorToast } = useCustomToast();
	const {
		mutateAsync: updateRiskAlertConfig,
		data: updateRiskAlertConfigData,
		error: updateRiskAlertConfigError,
		isPending: updateRiskAlertConfigLoading,
	} = useUpdateRiskAlertConfig();

	const {
		mutateAsync: updateCustomerApplicantConfig,
		isPending: updateCustomerApplicantConfigLoading,
		error: updateCustomerApplicantConfigError,
	} = useUpdateCustomerApplicantConfig();

	const {
		mutateAsync: updateCustomerApplicantDaysConfig,
		isPending: updateCustomerApplicantDaysConfigLoading,
		error: updateCustomerApplicantDaysConfigError,
	} = useUpdateCustomerApplicantDaysConfig();

	const isLoading = riskConfigLoading || customerApplicantConfigLoading;
	const preSubmitIsLoading =
		updateRiskAlertConfigLoading ||
		updateCustomerApplicantConfigLoading ||
		updateCustomerApplicantDaysConfigLoading;

	useEffect(() => {
		if (updateRiskAlertConfigData) {
			successToast(updateRiskAlertConfigData?.message);
			setShowModal(false);
			// Don't reset form here - let the data loading effect handle it
		}
	}, [updateRiskAlertConfigData]);

	useEffect(() => {
		if (updateCustomerApplicantConfigError) {
			errorToast(updateCustomerApplicantConfigError);
			setShowModal(false);
		}
	}, [updateCustomerApplicantConfigError]);

	useEffect(() => {
		if (updateCustomerApplicantDaysConfigError) {
			errorToast(updateCustomerApplicantDaysConfigError);
			setShowModal(false);
		}
	}, [updateCustomerApplicantDaysConfigError]);

	useEffect(() => {
		if (updateRiskAlertConfigError) {
			errorToast(updateRiskAlertConfigError);
			setShowModal(false);
		}
	}, [updateRiskAlertConfigError]);

	const refetchRiskConfigHandler = async () => {
		await refetchRiskConfig();
	};

	const discardChangeHandler = async () => {
		if (riskConfigData) {
			const currentValues = getValues();
			const data = getRiskConfigData(
				Object.keys(riskConfigData?.data?.customer).length !== 0
					? "customer"
					: "admin",
				riskConfigData,
			);

			const agingConfig = customerApplicantConfigData?.data?.config || [];
			const getAgingThreshold = (urgency: string, defaultValue: number) => {
				const config = agingConfig.find((c) => c.urgency === urgency);
				return Number(config?.threshold) || defaultValue;
			};

			const resetValues = {
				...currentValues,
				HIGHmin: Number(data.HIGH.min),
				HIGHmax: Number(data.HIGH.max),
				MODERATEmin: Number(data.MODERATE.min),
				MODERATEmax: Number(data.MODERATE.max),
				LOWmin: Number(data.LOW.min),
				LOWmax: Number(data.LOW.max),
				creditScoreChange: Number(data.creditScoreChange),
				worthScoreChange: Number(data.worthScoreChange),
				riskAlertsStatus: Boolean(data.riskAlertsStatus),
				creditScoreStatus: Boolean(data.creditScoreStatus),
				worthScoreStatus: Boolean(data.worthScoreStatus),
				scoreRiskTierTransitionStatus: Boolean(
					data.scoreRiskTierTransitionStatus,
				),
				newBankruptcyLienJudgementStatus: Boolean(
					data.newBankruptcyLienJudgementStatus,
				),
				newAdverseMediaStatus: Boolean(data.newAdverseMediaStatus),
				agingThreshold: Boolean(customerApplicantConfigData?.data?.is_enabled),
				agingThresholdLOW: getAgingThreshold("low", 30),
				agingThresholdMEDIUM: getAgingThreshold("medium", 60),
				agingThresholdHIGH: getAgingThreshold("high", 90),
			};
			reset(resetValues);
		}
	};

	const handleSaveChanges = async () => {
		const isriskConfigUpdated = Object.keys(dirtyFields).some(
			(k) =>
				![
					"agingThresholdLOW",
					"agingThresholdMEDIUM",
					"agingThresholdHIGH",
					"agingThreshold",
				].includes(k),
		);

		const isAgingThresholdDaysUpdated: boolean = Object.keys(dirtyFields).some(
			(k) =>
				[
					"agingThreshold",
					"agingThresholdLOW",
					"agingThresholdMEDIUM",
					"agingThresholdHIGH",
				].includes(k),
		);

		if (isAgingThresholdDaysUpdated) {
			await updateCustomerApplicantConfig(requestPayload[1]).then(
				async (
					updatedCustomerApplicantConfigData: CustomerApplicantConfigResponse,
				) => {
					if (isAgingThresholdDaysUpdated && requestPayload[1].is_enabled) {
						const currentConfig =
							updatedCustomerApplicantConfigData?.data?.config.map((item) => ({
								...item,
								threshold:
									requestPayload[2].payload?.[item.urgency] ?? item.threshold,
							}));
						await updateCustomerApplicantDaysConfig({
							customer_id: customerId,
							payload: currentConfig,
						} as ApplicantDaysConfigBody);
					}
				},
			);
		}
		await refetchCustomerApplicantConfig();
		if (isriskConfigUpdated) {
			await updateRiskAlertConfig(requestPayload[0]);
			await refetchRiskConfig();
		}
		setShowModal(false);
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
			riskAlertsStatus,
			creditScoreStatus,
			worthScoreStatus,
			scoreRiskTierTransitionStatus,
			newBankruptcyLienJudgementStatus,
			newAdverseMediaStatus,
			agingThreshold,
			agingThresholdLOW,
			agingThresholdMEDIUM,
			agingThresholdHIGH,
		} = data;
		const payload: [
			RiskAlertConfigBody,
			ApplicantConfigBody,
			ApplicantDaysConfigPreBody,
		] = [
			{
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
					new_bankruptcy_lien_judgement_status:
						newBankruptcyLienJudgementStatus,
					worth_score_change_status: worthScoreStatus,
					credit_score_config_status: creditScoreStatus,
					new_adverse_media: newAdverseMediaStatus,
				},
			},

			{
				customer_id: String(customerId),
				is_enabled: Boolean(agingThreshold),
			},
			{
				customer_id: customerId,
				payload: {
					low: agingThresholdLOW,
					medium: agingThresholdMEDIUM,
					high: agingThresholdHIGH,
				},
			} as ApplicantDaysConfigPreBody,
		];
		setRequestPayload(payload);
		setShowModal(true);
	};

	useEffect(() => {
		if (riskConfigData && customerApplicantConfigData) {
			const customerKeys = Object.keys(riskConfigData?.data?.customer);
			const data = getRiskConfigData(
				customerKeys.length > 0 ? "customer" : "admin",
				riskConfigData,
			);

			const values = getValues();

			const value = {
				...values,
				HIGHmin: Number(data.HIGH.min),
				HIGHmax: Number(data.HIGH.max),
				MODERATEmin: Number(data.MODERATE.min),
				MODERATEmax: Number(data.MODERATE.max),
				LOWmin: Number(data.LOW.min),
				LOWmax: Number(data.LOW.max),
				creditScoreChange: Number(
					data.creditScoreChange && !isNaN(data.creditScoreChange)
						? data.creditScoreChange
						: values.creditScoreChange,
				),
				worthScoreChange: Number(
					data.worthScoreChange && !isNaN(data.worthScoreChange)
						? data.worthScoreChange
						: values.worthScoreChange,
				),
				riskAlertsStatus: Boolean(data.riskAlertsStatus),
				creditScoreStatus: Boolean(data.creditScoreStatus),
				worthScoreStatus: Boolean(data.worthScoreStatus),
				scoreRiskTierTransitionStatus: Boolean(
					data.scoreRiskTierTransitionStatus,
				),
				newBankruptcyLienJudgementStatus: Boolean(
					data.newBankruptcyLienJudgementStatus,
				),
				newAdverseMediaStatus: Boolean(data.newAdverseMediaStatus),
				agingThreshold: Boolean(customerApplicantConfigData?.data?.is_enabled),
				agingThresholdLOW:
					Number(
						customerApplicantConfigData?.data?.config.find((config) => {
							return config.urgency === "low";
						})?.threshold,
					) || 30,
				agingThresholdMEDIUM:
					Number(
						customerApplicantConfigData?.data?.config.find((config) => {
							return config.urgency === "medium";
						})?.threshold,
					) || 60,
				agingThresholdHIGH:
					Number(
						customerApplicantConfigData?.data?.config.find((config) => {
							return config.urgency === "high";
						})?.threshold,
					) || 90,
			};

			reset(value);
		}
	}, [riskConfigData, customerApplicantConfigData]);

	const tabs = [
		{
			key: "ranges",
			id: 0,
			name: "Scoring & Aging",
			content: (
				<div>
					<ScoreRangeConfiguration
						riskConfigData={riskConfigData}
						register={register}
						setValue={setValue}
						getValues={getValues}
						reset={reset}
						watch={watch}
						handleSubmit={handleSubmit}
						trigger={trigger}
						errors={errors}
						values={watch()}
						customerId={customerId}
						refetchRiskConfigHandler={refetchRiskConfigHandler}
						isDirty={isDirty}
						discardChangeHandler={discardChangeHandler}
					/>
					<AgingThresholds
						agingThresholdData={customerApplicantConfigData?.data}
						customerId={customerId}
						platform={platform}
					/>
				</div>
			),
		},
		{
			key: "alerts",
			id: 1,
			name: "Risk Alerts",
			content: (
				<RiskMonitoring
					platform={platform}
					isLoading={isLoading}
					getValues={getValues}
					setValue={setValue}
					customerIntegrationSettingsData={customerIntegrationSettingsData}
					riskConfigData={riskConfigData}
					refetchRiskConfigHandler={refetchRiskConfigHandler}
					watch={watch}
					customerId={customerId}
				/>
			),
		},
		...(isApprovalWorkflowsEnabled || platform === PLATFORM.admin
			? [
					{
						key: "decisioning",
						id: 2,
						name: "Decisioning",
						content: (
							<DecisioningSelection
								customerId={customerId ?? ""}
								platform={platform}
								onNavigateToScoring={() => {
									handleTabChange(0);
								}}
							/>
						),
					},
				]
			: []),
	];

	// Only show form wrapper for tabs that need it (Scoring tab, id: 0)
	const needsFormWrapper = [0, 1].includes(activeId);

	return (
		<div className="pb-3">
			<FormProvider {...methods}>
				<form onSubmit={handleSubmit(onSubmit)}>
					<TabsWithButton
						tabs={tabs}
						activeId={activeId}
						onTabChange={(id: number) => {
							handleTabChange(id);
						}}
					/>

					<motion.div
						initial={{ y: "100%", opacity: 0 }}
						animate={{
							y: isDirty && needsFormWrapper ? "0%" : "100%",
							opacity: isDirty && needsFormWrapper ? 1 : 0,
						}}
						transition={{ duration: 0.5 }}
						className="fixed bottom-0 z-50 flex items-center justify-between w-full h-[72px] -ml-4 bg-white border-t border-gray-200 shadow-sm sm:-ml-8 shrink-0"
					>
						<div></div>
						<div className="flex flex-row space-x-2 sm:mr-20 lg:mr-80">
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
								type="submit"
								color="dark"
								className="w-full rounded-lg sm:w-fit"
								isLoading={updateRiskAlertConfigLoading}
								disabled={Object.keys(errors).length > 0}
							>
								Save Changes
							</Button>
						</div>
					</motion.div>
				</form>
			</FormProvider>

			{preSubmitIsLoading && <FullPageLoader />}
			{showModal && (
				<WarningModal
					isOpen={showModal}
					onClose={() => {
						setShowModal(false);
					}}
					onSucess={async () => {
						await handleSaveChanges();
						setShowModal(false);
					}}
					title={"Update Configurations"}
					description={"Are you sure you want to change the configurations?"}
					buttonText={"Yes"}
					type={"dark"}
				/>
			)}
		</div>
	);
};

export default RiskMonitoringScoring;
