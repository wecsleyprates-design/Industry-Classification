import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
	type FieldErrors,
	type UseFormGetValues,
	type UseFormHandleSubmit,
	type UseFormRegister,
	type UseFormReset,
	type UseFormSetValue,
	type UseFormWatch,
} from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { useUpdateRiskAlertConfig } from "@/services/queries/riskAlert.query";
import {
	type IScoreRangesForm,
	type RiskAlertConfigurationResponse,
} from "@/types/riskAlerts";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

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
				?.min ?? 0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.HIGH?.measurement_config
				?.max ?? 0,
		),
	},
	MODERATE: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
				?.min ?? 0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.MODERATE?.measurement_config
				?.max ?? 0,
		),
	},
	LOW: {
		min: Number(
			riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config
				?.min ?? 0,
		),
		max: Number(
			riskConfigData?.data?.[type]?.score_config?.LOW?.measurement_config
				?.max ?? 0,
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
	errors: FieldErrors<IScoreRangesForm>;
	riskConfigData?: RiskAlertConfigurationResponse;
	values?: any;
}

const ScoreRangeConfiguration: React.FC<Props> = ({
	riskConfigData,
	register,
	reset,
	getValues,
	setValue,
	watch,
	errors,
	values,
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

	useEffect(() => {
		if (values.MODERATEmax) {
			setValue("MODERATEmin", Number(values.HIGHmax) + 1);
			reset({ ...getValues() });
		}
	}, [values.HIGHmax]);

	useEffect(() => {
		if (values.LOWmax) {
			setValue("LOWmin", Number(values.MODERATEmax) + 1);
			reset({ ...getValues() });
		}
	}, [values.MODERATEmax]);

	useEffect(() => {
		if (updateRiskAlertConfigData) {
			successHandler({ message: updateRiskAlertConfigData?.message });
		}
	}, [updateRiskAlertConfigData]);

	useEffect(() => {
		if (updateRiskAlertConfigError) errorHandler(updateRiskAlertConfigError);
	}, [updateRiskAlertConfigError]);

	const columns: column[] = [
		{
			title: "Onboarding",
			path: "onboarding_score",
			content: (item) => (
				<div className="text-[#1E1E1E]">{item.onboarding_score}</div>
			),
		},
		{
			title: "Risk monitoring",
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
			title: "Score range",
			path: "score_range",
			content: (item) => {
				return (
					<div className="py-0 mt-0">
						<div className="flex space-x-6 -translate-y-5">
							<div>
								<Input
									type="number"
									id={`${String(item.key)}min`}
									name={`${String(item.key)}min`}
									register={register}
									disabled={item.minDisabled}
									className={twMerge(
										"w-24 h-fit border border-slate-300 rounded-md ring-0 text-[15px] text-[#5E5E5E] py-2 px-4",
										errors &&
											errors[`${String(item.key)}min` as formKeys] &&
											"border-red-600",
									)}
									onChange={(e) => {
										setValue(
											`${String(item.key)}min` as formKeys,
											Number(e.target.value),
										);
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
										"w-24 h-fit ring-0 border border-slate-300 rounded-md text-[15px] text-[#5E5E5E] py-2 px-4",
										errors &&
											errors[`${String(item.key)}max` as formKeys] &&
											"border-red-600",
									)}
									onChange={(e) => {
										setValue(
											`${String(item.key)}max` as formKeys,
											Number(e.target.value),
										);
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
		if (riskConfigData) {
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
				initialData.records[0] = { ...initialData.records[0], ...data.HIGH };
				initialData.records[1] = {
					...initialData.records[1],
					...data.MODERATE,
				};
				initialData.records[2] = { ...initialData.records[2], ...data.LOW };
				Object.entries(data).forEach(([key, { min, max }]) => {
					setValue(`${key}min` as formKeys, min);
					setValue(`${key}max` as formKeys, max);
				});
			}
			return initialData;
		} else {
			return initialData;
		}
	}, [riskConfigData]);

	const resetConfigurableScores = useCallback(async () => {
		if (riskConfigData) {
			const data = getData("admin", riskConfigData);

			const payload = {
				customer_id: customerId,
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
					risk_alerts_status: getValues().riskAlertsStatus, // Universal
					score_risk_tier_transition_status:
						getValues().scoreRiskTierTransitionStatus,
					new_bankruptcy_lien_judgement_status:
						getValues().newBankruptcyLienJudgementStatus,
					worth_score_change_status: getValues().worthScoreStatus,
					credit_score_config_status: getValues().creditScoreStatus,
				},
			};
			reset({
				...getValues(),
				HIGHmin: Number(data.HIGH.min),
				HIGHmax: Number(data.HIGH.max),
				MODERATEmin: Number(data.MODERATE.min),
				MODERATEmax: Number(data.MODERATE.max),
				LOWmin: Number(data.LOW.min),
				LOWmax: Number(data.LOW.max),
			});
			await updateRiskAlertConfig(payload);
		}
	}, [riskConfigData]);

	return (
		<>
			{isLoading && <FullPageLoader />}
			<div className="p-4 border rounded-2xl border-[#E5E7EB] bg-white">
				<div className="justify-between my-4 sm:flex py-b">
					<div className="px-4 py-b sm:px-4">
						<p className="font-semibold text-[#1F2937] text-base">
							Worth Score Ranges
						</p>
						<p className="text-[#6B7280] font-normal text-sm">
							Configure your settings on score ranges and risk monitoring.
						</p>
					</div>
					<Button
						color="grey"
						outline
						type="button"
						className="text-[#2563EB] rounded-xl my-1 hidden sm:block"
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
								{/* Desktop view table format */}
								<div className="hidden min-w-full pb-2 align-middle sm:inline-block">
									<table className="w-full min-w-full text-left divide-y ">
										<TableHeader
											columns={columns}
											sortHandler={() => {}}
											payload={{}}
											className="text-[#6B7280] text-xs font-semibold"
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
									{tableData.records.map((item) => {
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
													<p className="text-xs font-medium text-[#6B7280]">
														Score range
													</p>
													<p className="flex justify-between">
														<Input
															type="number"
															id={`${String(item.key)}min`}
															name={`${String(item.key)}min`}
															register={register}
															disabled={item.minDisabled}
															className="w-24 ring-0 h-fit border border-gray-200 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
														/>
														<span className="my-4">-</span>
														<Input
															type="number"
															name={`${String(item.key)}max`}
															id={`${String(item.key)}max`}
															register={register}
															disabled={item.maxDisabled}
															className="w-24 h-fit ring-0 border border-gray-200 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
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
								className="text-[#2563EB] w-full rounded-lg my-1 sm:hidden block"
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
