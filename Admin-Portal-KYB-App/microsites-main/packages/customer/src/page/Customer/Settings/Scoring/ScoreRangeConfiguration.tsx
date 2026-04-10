import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	type FieldErrors,
	type UseFormGetValues,
	type UseFormHandleSubmit,
	type UseFormRegister,
	type UseFormReset,
	type UseFormSetValue,
	type UseFormTrigger,
	type UseFormWatch,
} from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input/Input";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { useCustomToast } from "@/hooks/useCustomToast";
import { useUpdateRiskAlertConfig } from "@/services/queries/riskAlert.query";
import {
	type IScoreRangesForm,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

type formKeys =
	| "HIGHmin"
	| "HIGHmax"
	| "MODERATEmin"
	| "MODERATEmax"
	| "LOWmin"
	| "LOWmax"
	| "creditScoreChange";

const getData = (
	type: "customer" | "admin",
	riskConfigData: RiskAlertConfigurationResponse,
) => ({
	HIGH: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config
				?.min ??
				riskConfigData?.data?.admin?.score_config?.HIGH?.measurement_config
					?.min ??
				0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config
				?.max ??
				riskConfigData?.data?.admin?.score_config?.HIGH?.measurement_config
					?.max ??
				0,
		),
	},
	MODERATE: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
				?.min ??
				riskConfigData?.data?.admin?.score_config?.MODERATE?.measurement_config
					?.min ??
				0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
				?.max ??
				riskConfigData?.data?.admin?.score_config?.MODERATE?.measurement_config
					?.max ??
				0,
		),
	},
	LOW: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config
				?.min ??
				riskConfigData?.data?.admin?.score_config?.LOW?.measurement_config
					?.min ??
				0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config
				?.max ??
				riskConfigData?.data?.admin?.score_config?.LOW?.measurement_config
					?.max ??
				0,
		),
	},
});

const initialData = {
	records: [
		{
			key: "HIGH",
			index: 0,
			onboarding_score: "High Risk, Auto-Reject",
			risk_monitoring_score: "High severity",
			min: 0,
			minDisabled: true,
			max: 549,
			maxDisabled: false,
		},
		{
			key: "MODERATE",
			index: 1,
			onboarding_score: "Moderate Risk, Manual Review Needed",
			risk_monitoring_score: "Medium severity",
			min: 550,
			minDisabled: true,
			max: 699,
			maxDisabled: false,
		},
		{
			key: "LOW",
			index: 2,
			onboarding_score: "Low Risk, Auto-Approve",
			risk_monitoring_score: "Low severity",
			min: 700,
			minDisabled: true,
			max: 850,
			maxDisabled: true,
		},
	],
	total_items: 3,
	total_pages: 1,
};

interface Props {
	register: UseFormRegister<IScoreRangesForm>;
	setValue: UseFormSetValue<IScoreRangesForm>;
	getValues: UseFormGetValues<IScoreRangesForm>;
	reset: UseFormReset<IScoreRangesForm>;
	watch: UseFormWatch<IScoreRangesForm>;
	handleSubmit: UseFormHandleSubmit<IScoreRangesForm>;
	trigger: UseFormTrigger<IScoreRangesForm>;
	errors: FieldErrors<IScoreRangesForm>;
	riskConfigData?: RiskAlertConfigurationResponse;
	values?: any;
	customerId?: string;
	refetchRiskConfigHandler: () => void;
	isDirty?: boolean;
	discardChangeHandler: () => void;
}

const ScoreRangeConfiguration: React.FC<Props> = ({
	riskConfigData,
	register,
	reset,
	getValues,
	setValue,
	watch,
	trigger,
	errors,
	values,
	customerId,
	refetchRiskConfigHandler,
	isDirty,
	discardChangeHandler,
	handleSubmit,
}) => {
	const { successToast, errorToast } = useCustomToast();
	const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);
	const {
		mutateAsync: updateRiskAlertConfig,
		data: updateRiskAlertConfigData,
		error: updateRiskAlertConfigError,
		isPending: updateRiskAlertConfigLoading,
	} = useUpdateRiskAlertConfig();

	useEffect(() => {
		if (values.MODERATEmax) {
			setValue("MODERATEmin", Number(values.HIGHmax) + 1, {
				shouldDirty: true,
			});
			// Trigger validation for affected fields
			void trigger("MODERATEmin");
			void trigger("MODERATEmax");
		}
	}, [values.HIGHmax, setValue, trigger]);

	useEffect(() => {
		if (values.LOWmax) {
			setValue("LOWmin", Number(values.MODERATEmax) + 1, {
				shouldDirty: true,
			});
			// Trigger validation for affected fields
			void trigger("LOWmin");
			void trigger("LOWmax");
		}
	}, [values.MODERATEmax, setValue, trigger]);

	useEffect(() => {
		if (updateRiskAlertConfigData) {
			successToast(updateRiskAlertConfigData?.message);
			refetchRiskConfigHandler();
		}
	}, [updateRiskAlertConfigData]);

	useEffect(() => {
		if (updateRiskAlertConfigError) errorToast(updateRiskAlertConfigError);
	}, [updateRiskAlertConfigError]);

	const columns: column[] = [
		{
			title: "Onboarding",
			path: "onboarding_score",
			content: (item) => (
				<div className="text-gray-800 text-sm">{item.onboarding_score}</div>
			),
		},
		{
			title: "Risk Monitoring",
			path: "risk_monitoring_score",
			content: (item) => {
				let color: "red" | "green" | "yellow" = "green";
				switch (item.risk_monitoring_score) {
					case "High severity":
						color = "red";
						break;
					case "Medium severity":
						color = "yellow";
						break;
					case "Low severity":
						color = "green";
						break;
					default:
						color = "green";
				}
				return (
					<div className="text-[#1E1E1E]">
						{
							<Badge
								color={color}
								isRemoveable={false}
								text={item.risk_monitoring_score}
								className="text-xs"
							/>
						}
					</div>
				);
			},
		},
		{
			title: "Score Range",
			path: "score_range",
			content: (item) => {
				return (
					<div className="py-0 mt-0">
						<div className="flex space-x-6">
							<div>
								<Input
									type="number"
									id={`${String(item.key)}min`}
									name={`${String(item.key)}min`}
									register={register}
									disabled={item.minDisabled}
									className={twMerge(
										"w-20 h-10 border ring-0 border-slate-300 rounded-md  font-Montserrat text-[15px] text-[#5E5E5E] py-2 px-4",
										errors &&
											errors[`${String(item.key)}min` as formKeys] &&
											"border-red-600",
									)}
									onChange={async (e: any) => {
										setValue(
											`${String(item.key)}min` as formKeys,
											Number(e.target.value),
											{
												shouldDirty: true,
											},
										);
										// Trigger validation for both min and max fields
										await trigger(`${String(item.key)}min` as formKeys);
										await trigger(`${String(item.key)}max` as formKeys);
									}}
								/>
							</div>
							<span className="py-2">-</span>
							<div>
								<Input
									type="number"
									name={`${String(item.key)}max`}
									id={`${String(item.key)}max`}
									register={register}
									disabled={item.maxDisabled}
									defaultValue={item.max}
									className={twMerge(
										"w-20 h-10 border ring-0 border-slate-300 rounded-md font-Montserrat text-[15px] text-[#5E5E5E] py-2 px-4",
										errors &&
											errors[`${String(item.key)}max` as formKeys] &&
											"border-red-600",
									)}
									onChange={async (e: any) => {
										setValue(
											`${String(item.key)}max` as formKeys,
											Number(e.target.value),
											{
												shouldDirty: true,
											},
										);
										// Trigger validation for both min and max fields
										await trigger(`${String(item.key)}min` as formKeys);
										await trigger(`${String(item.key)}max` as formKeys);
									}}
								/>
							</div>
						</div>
						<div className="flex">
							<div className="justify-start block text-start">
								{errors && errors[`${String(item.key)}max` as formKeys] && (
									<p
										className="flex justify-end text-sm text-red-600 overscroll-auto"
										id="email-error"
									>
										<InformationCircleIcon className="w-5 h-5 text-red-600" />
										&nbsp;&nbsp;
										{errors[`${String(item.key)}max` as formKeys]?.message}
									</p>
								)}
								{errors &&
									errors[`${String(item.key)}min` as formKeys]?.message && (
										<p
											className="flex justify-end text-sm text-red-600 overscroll-auto"
											id="email-error"
										>
											<InformationCircleIcon className="w-5 h-5 text-red-600" />
											&nbsp;&nbsp;
											{errors[`${String(item.key)}min` as formKeys]?.message}
										</p>
									)}
							</div>
						</div>
					</div>
				);
			},
		},
	];

	const tableData = useMemo(() => {
		const base = JSON.parse(JSON.stringify(initialData));
		if (!riskConfigData) return base;
		const customerData =
			JSON.stringify(riskConfigData?.data?.customer) !== JSON.stringify({});
		const adminData =
			JSON.stringify(riskConfigData?.data?.admin) !== JSON.stringify({});
		const data =
			customerData && riskConfigData?.data?.customer?.score_config
				? getData("customer", riskConfigData)
				: adminData && riskConfigData?.data?.admin?.score_config
					? getData("admin", riskConfigData)
					: null;
		if (data) {
			base.records[0] = { ...base.records[0], ...data.HIGH };
			base.records[1] = { ...base.records[1], ...data.MODERATE };
			base.records[2] = { ...base.records[2], ...data.LOW };
			Object.entries(data).forEach(([key, { min, max }]) => {
				setValue(`${key}min` as formKeys, min, { shouldDirty: false });
				setValue(`${key}max` as formKeys, max, { shouldDirty: false });
			});
		}
		return base;
	}, [riskConfigData]);

	const resetConfigurableScores = async () => {
		if (riskConfigData) {
			const data = getData("admin", riskConfigData);
			const currentValues = getValues();

			const payload = {
				customer_id: customerId ?? "",
				score_config: [
					{
						risk_level: "HIGH" as "HIGH" | "MODERATE" | "LOW",
						min: Number(data.HIGH.min),
						max: Number(data.HIGH.max),
					},
					{
						risk_level: "MODERATE" as "HIGH" | "MODERATE" | "LOW",
						min: Number(data.MODERATE.min),
						max: Number(data.MODERATE.max),
					},
					{
						risk_level: "LOW" as "HIGH" | "MODERATE" | "LOW",
						min: Number(data.LOW.min),
						max: Number(data.LOW.max),
					},
				],
				risk_alert_statuses: {
					risk_alerts_status: currentValues.riskAlertsStatus, // Universal
					score_risk_tier_transition_status:
						currentValues.scoreRiskTierTransitionStatus,
					new_bankruptcy_lien_judgement_status:
						currentValues.newBankruptcyLienJudgementStatus,
					worth_score_change_status: currentValues.worthScoreStatus,
					credit_score_config_status: currentValues.creditScoreStatus,
					new_adverse_media: currentValues.newAdverseMediaStatus,
				},
			};

			// Execute mutation first, then reset form after it completes
			await updateRiskAlertConfig(payload);

			// Reset form after mutation completes to avoid React context issues
			reset({
				...currentValues,
				HIGHmin: Number(data.HIGH.min),
				HIGHmax: Number(data.HIGH.max),
				MODERATEmin: Number(data.MODERATE.min),
				MODERATEmax: Number(data.MODERATE.max),
				LOWmin: Number(data.LOW.min),
				LOWmax: Number(data.LOW.max),
			});
		}
	};

	return (
		<>
			<div className="p-4 border bg-white rounded-2xl border-[#E5E7EB] mt-6">
				<div className="justify-between my-2 sm:flex py-b">
					<div className="px-4 sm:px-4">
						<p className="font-semibold  text-[#1F2937] text-base">
							Worth Score Ranges
						</p>
						<p className="text-[#6B7280] font-normal text-sm mt-2">
							Configure your settings on score ranges and risk monitoring.
						</p>
					</div>
					<Button
						color="grey"
						outline
						type="button"
						className="text-[#2563EB] text-sm font-medium rounded-lg my-1 hidden sm:block"
						onClick={() => {
							setIsWarningModalOpen(true);
						}}
					>
						Reset to default
					</Button>
				</div>

				<div className="h-full sm:px-0">
					<div className="my-4 sm:my-8">
						<div className="flow-root">
							<div className="mx-2 overflow-x-auto sm:mx-1 lg:mx-2">
								{/* Desktop view table format   */}
								<div className="hidden min-w-full align-middle sm:inline-block -mt-4">
									<table className="w-100% min-w-full text-left divide-y">
										<TableHeader
											columns={columns}
											sortHandler={() => {}}
											payload={{}}
											tableHeaderClassname="text-gray-500 text-xs font-semibold"
										/>
										<TableBody
											isLoading={false}
											columns={columns}
											tableData={tableData}
											renderDiv={true}
										/>
									</table>
								</div>

								{/* Mobile view card formats */}
								<div className="block sm:hidden">
									{tableData.records.map((item: any) => {
										let color: "red" | "green" | "yellow" = "green";
										switch (item.risk_monitoring_score) {
											case "High severity":
												color = "red";
												break;
											case "Medium severity":
												color = "yellow";
												break;
											case "Low severity":
												color = "green";
												break;
											default:
												color = "green";
										}
										return (
											<div
												key={item.index}
												className="flex flex-col w-full p-4 my-3 space-y-4 border border-gray-200 divide-y divide-gray-200 rounded-lg"
											>
												<div className="py-2 space-y-1">
													<p className="text-xs font-medium text-[#6B7280]">
														Onboarding
													</p>
													<p>{item.onboarding_score}</p>
												</div>
												<div className="py-2 space-y-2">
													<p className="text-xs font-medium text-[#6B7280]">
														Risk monitoring
													</p>
													<p>
														<Badge
															color={color}
															isRemoveable={false}
															text={item.risk_monitoring_score}
															className="text-xs"
														/>
													</p>
												</div>
												<div className="py-2 space-y-1">
													<p className="text-xs font-medium  text-[#6B7280]">
														Score range
													</p>
													<p className="flex justify-between">
														<Input
															type="number"
															id={`${String(item.key)}min`}
															name={`${String(item.key)}min`}
															register={register}
															disabled={item.minDisabled}
															className={twMerge(
																"w-20 h-10 border border-gray-200 rounded-md mt-2.5 font-Montserrat text-[15px] text-[#5E5E5E] py-2.5 px-4",
																errors &&
																	errors[
																		`${String(item.key)}min` as formKeys
																	] &&
																	"border-red-600",
															)}
															onChange={async (e: any) => {
																setValue(
																	`${String(item.key)}min` as formKeys,
																	Number(e.target.value),
																	{
																		shouldDirty: true,
																	},
																);
																// Trigger validation for both min and max fields
																await trigger(
																	`${String(item.key)}min` as formKeys,
																);
																await trigger(
																	`${String(item.key)}max` as formKeys,
																);
															}}
														/>
														<span className="my-2">-</span>
														<Input
															type="number"
															name={`${String(item.key)}max`}
															id={`${String(item.key)}max`}
															register={register}
															disabled={item.maxDisabled}
															className={twMerge(
																"w-20 h-10 ring-0 border border-gray-200 rounded-md mt-2.5 font-Montserrat text-[15px] text-[#5E5E5E] py-2.5 px-4",
																errors &&
																	errors[
																		`${String(item.key)}max` as formKeys
																	] &&
																	"border-red-600",
															)}
															onChange={async (e: any) => {
																setValue(
																	`${String(item.key)}max` as formKeys,
																	Number(e.target.value),
																	{
																		shouldDirty: true,
																	},
																);
																// Trigger validation for both min and max fields
																await trigger(
																	`${String(item.key)}min` as formKeys,
																);
																await trigger(
																	`${String(item.key)}max` as formKeys,
																);
															}}
														/>
													</p>
													<div className="justify-start block text-start">
														{errors &&
															errors[`${String(item.key)}max` as formKeys] && (
																<p
																	className="flex justify-end text-sm text-red-600 overscroll-auto"
																	id="email-error"
																>
																	<InformationCircleIcon className="w-5 h-5 text-red-600" />
																	&nbsp;&nbsp;
																	{
																		errors[`${String(item.key)}max` as formKeys]
																			?.message
																	}
																</p>
															)}
														{errors &&
															errors[`${String(item.key)}min` as formKeys]
																?.message && (
																<p
																	className="flex justify-end text-sm text-red-600 overscroll-auto"
																	id="email-error"
																>
																	<InformationCircleIcon className="w-5 h-5 text-red-600" />
																	&nbsp;&nbsp;
																	{
																		errors[`${String(item.key)}min` as formKeys]
																			?.message
																	}
																</p>
															)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						</div>
						<div className="block px-2 space-y-3 sm:justify-end sm:flex">
							<Button
								color="grey"
								outline
								type="button"
								className="text-[#2563EB] w-full rounded-lg my-1 text-sm font-medium sm:hidden block"
								onClick={() => {
									setIsWarningModalOpen(true);
								}}
							>
								Reset to default
							</Button>
						</div>
					</div>
				</div>
			</div>

			<motion.div
				initial={{ y: "100%", opacity: 0 }}
				animate={{
					y: isDirty ? "0%" : "100%",
					opacity: isDirty ? 1 : 0,
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

			{isWarningModalOpen && (
				<WarningModal
					isOpen={isWarningModalOpen}
					onClose={() => {
						setIsWarningModalOpen(false);
					}}
					onSucess={async () => {
						await resetConfigurableScores();
					}}
					title={"Reset to default"}
					description={
						"Are you sure you want to reset the score configuration to default?"
					}
					buttonText={"Yes"}
					type={"dark"}
				/>
			)}
		</>
	);
};

export default memo(ScoreRangeConfiguration);
