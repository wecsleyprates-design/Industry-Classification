import React, { memo, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import Badge from "@/components/Badge";
import { FormattedInput, Toggle } from "@/components/Input";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { capitalize } from "@/lib/helper";
import { type CustomerApplicantConfigResponseData } from "@/types/agingThreshold";
import { type IScoreRangesForm } from "@/types/riskAlerts";
import EditWebhookMessageModal from "./EditWebhookMessageModal";

import FEATURE_FLAGS from "@/constants/FeatureFlags";

type formKeys =
	| "agingThreshold"
	| "agingThresholdHIGH"
	| "agingThresholdMEDIUM"
	| "agingThresholdLOW";

const initialData = {
	records: [
		{
			key: "LOW",
			index: 0,
			days: 30,
		},
		{
			key: "MEDIUM",
			index: 1,
			days: 60,
		},
		{
			key: "HIGH",
			index: 2,
			days: 90,
		},
	],
	total_items: 3,
	total_pages: 1,
};

interface Props {
	agingThresholdData?: CustomerApplicantConfigResponseData;
	customerId: string;
	platform: "admin" | "customer";
}

const AgingThresholds: React.FC<Props> = ({
	agingThresholdData,
	customerId,
	platform,
}) => {
	const flags = useFlags();
	const isCustomizeAgingThresholdsWebhookMessagesEnabled =
		flags[FEATURE_FLAGS.PAT_984_CUSTOMIZE_AGING_THRESHOLDS_WEBHOOK_MESSAGES] ??
		false;
	const [isEditWebhookMessageModalOpen, setIsEditWebhookMessageModalOpen] =
		useState(false);
	const {
		watch,
		register,
		getValues,
		setValue,
		trigger,
		formState: { errors },
	} = useFormContext<IScoreRangesForm>();
	const columns: column[] = [
		{
			title: "Aging Threshold",
			path: "aging_threshold",
			content: (item) => {
				let color: "red" | "green" | "yellow" = "green";
				switch (item.key) {
					case "LOW":
						color = "green";
						break;
					case "MEDIUM":
						color = "yellow";
						break;
					case "HIGH":
						color = "red";
						break;
					default:
						color = "green";
				}
				return (
					<div className="text-[#1E1E1E] flex items-center h-10 mt-2.5">
						{
							<Badge
								color={color}
								isRemoveable={false}
								text={capitalize(item.key)}
								className="text-xs"
							/>
						}
					</div>
				);
			},
		},
		{
			title: "Days Since Invite Accepted",
			path: "aging_threshold_days",
			content: (item) => {
				return (
					<div>
						<div className="w-[87px]">
							<FormattedInput
								type="text"
								id={`agingThreshold${String(item.key)}`}
								name={`agingThreshold${String(item.key)}`}
								suffix="Days"
								register={register}
								onChange={(e) => {
									const sanitizedValue = e?.target?.value
										.replace(/[^0-9]/g, "")
										.slice(0, 4);
									e.target.value = sanitizedValue;
									setValue(
										`agingThreshold${String(item.key)}` as any,
										Number(sanitizedValue),
										{ shouldDirty: true },
									);
									// Trigger validation on all aging threshold fields
									void trigger([
										"agingThresholdLOW",
										"agingThresholdMEDIUM",
										"agingThresholdHIGH",
									]);
								}}
							/>
						</div>

						<div className="flex">
							<div className="justify-start block text-start mt-2">
								{errors &&
									errors[`agingThreshold${String(item.key)}` as formKeys] && (
										<p
											className="flex justify-end text-sm text-red-600 overscroll-auto"
											id="email-error"
										>
											<InformationCircleIcon className="w-5 h-5 text-red-600" />
											&nbsp;&nbsp;
											{
												errors[`agingThreshold${String(item.key)}` as formKeys]
													?.message
											}
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
		if (!agingThresholdData) return base;

		return base;
	}, []);

	return (
		<>
			<div className="p-4 border bg-white rounded-2xl border-[#E5E7EB] mt-6 pb-0 mb-32">
				<div className="justify-between my-2 sm:flex py-b">
					<div className="px-4 sm:px-4">
						<p className="font-semibold  text-gray-800 text-base">
							Aging Thresholds
						</p>
						<p className="text-gray-500 font-normal text-sm mt-2 md:mr-56 lg:mr-80">
							When enabled, you can set thresholds and filters on applications
							that have not been submitted during a specific time interval.
							Thresholds on applications are updated daily.
						</p>
						{getValues().agingThreshold &&
						(isCustomizeAgingThresholdsWebhookMessagesEnabled ||
							platform === "admin") ? (
							<button
								className="text-sm text-blue-600 cursor-pointer"
								type="button"
								onClick={() => {
									setIsEditWebhookMessageModalOpen(true);
								}}
							>
								Edit Webhook Messages
							</button>
						) : null}
					</div>
					<div className="mt-5 ml-3.5 sm:mt-0 sm:ml-0">
						<Toggle
							value={watch().agingThreshold}
							onChange={async () => {
								setValue("agingThreshold", !getValues().agingThreshold, {
									shouldDirty: true,
								});
							}}
						/>
					</div>
				</div>

				{watch().agingThreshold && (
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
											switch (item.key) {
												case "HIGH":
													color = "red";
													break;
												case "MEDIUM":
													color = "yellow";
													break;
												case "LOW":
													color = "green";
													break;
												default:
													color = "green";
											}
											return (
												<div
													key={item.key}
													className="flex flex-col w-full p-4 my-3 space-y-4 border border-gray-200 divide-y divide-gray-200 rounded-lg"
												>
													<div className="py-2 space-y-2">
														<p className="text-xs font-medium text-[#6B7280]">
															Aging Threshold
														</p>
														<p>
															<Badge
																color={color}
																isRemoveable={false}
																text={capitalize(item.key)}
																className="text-xs"
															/>
														</p>
													</div>
													<div className="py-2 space-y-1">
														<p className="text-xs font-medium  text-[#6B7280]">
															Days Since Invite Accepted
														</p>
														<p className="flex justify-between">
															<div className="w-[87px]">
																<FormattedInput
																	type="text"
																	id={`agingThreshold${String(item.key)}`}
																	name={`agingThreshold${String(item.key)}`}
																	suffix="Days"
																	register={register}
																	onChange={(e) => {
																		const sanitizedValue = e?.target?.value
																			.replace(/[^0-9]/g, "")
																			.slice(0, 4);
																		e.target.value = sanitizedValue;
																		setValue(
																			`agingThreshold${String(
																				item.key,
																			)}` as any,
																			Number(sanitizedValue),
																			{ shouldDirty: true },
																		);
																		// Trigger validation on all aging threshold fields
																		void trigger([
																			"agingThresholdLOW",
																			"agingThresholdMEDIUM",
																			"agingThresholdHIGH",
																		]);
																	}}
																	errors={errors}
																/>
															</div>
														</p>
														<div className="justify-start block text-start mt-2">
															{errors &&
																errors[
																	`agingThreshold${String(
																		item.key,
																	)}` as formKeys
																]?.message && (
																	<p
																		className="flex justify-end text-sm text-red-600 overscroll-auto"
																		id="email-error"
																	>
																		<InformationCircleIcon className="w-5 h-5 text-red-600" />
																		&nbsp;&nbsp;
																		{
																			errors[
																				`agingThreshold${String(
																					item.key,
																				)}` as formKeys
																			]?.message
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
						</div>
					</div>
				)}
			</div>
			{isEditWebhookMessageModalOpen && (
				<EditWebhookMessageModal
					isOpen={isEditWebhookMessageModalOpen}
					onClose={() => {
						setIsEditWebhookMessageModalOpen(false);
					}}
					customerId={customerId}
					agingThresholdData={agingThresholdData}
				/>
			)}
		</>
	);
};

export default memo(AgingThresholds);
