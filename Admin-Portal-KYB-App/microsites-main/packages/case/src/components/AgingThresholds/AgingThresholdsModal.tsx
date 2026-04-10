import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { useQueryClient } from "@tanstack/react-query";
import { useFlags } from "launchdarkly-react-client-sdk";
import { useCustomToast } from "@/hooks";
import { capitalize } from "@/lib/helper";
import { agingThresholdsSchema } from "@/lib/validation";
import {
	useGetBusinessApplicantConfig,
	useGetCustomerApplicantConfig,
	usePostBusinessApplicantConfig,
	useUpdateBusinessApplicantConfig,
} from "@/services/queries/aging.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type BusinessApplicantConfigResponseDataConfig } from "@/types/aging";
import { FormattedInput } from "../Input";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { AgingThresholdBadge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";

const DEFAULT_AGING_THRESHOLDS = {
	agingThresholdLOW: 30,
	agingThresholdMEDIUM: 60,
	agingThresholdHIGH: 90,
	agingThresholdMessageLOW: "Please complete your application soon.",
	agingThresholdMessageMEDIUM:
		"Your application has been pending for some time — please review missing details.",
	agingThresholdMessageHIGH:
		"Your application is overdue and may be closed soon if no action is taken.",
} as const;

const AGING_THRESHOLDS_CONFIG = [
	{
		key: "agingThresholdLOW" as const,
		label: "Low",
		variant: "success" as const,
		color: "green" as const,
		defaultValue: DEFAULT_AGING_THRESHOLDS.agingThresholdLOW,
	},
	{
		key: "agingThresholdMEDIUM" as const,
		label: "Medium",
		variant: "warning" as const,
		color: "yellow" as const,
		defaultValue: DEFAULT_AGING_THRESHOLDS.agingThresholdMEDIUM,
	},
	{
		key: "agingThresholdHIGH" as const,
		label: "High",
		variant: "destructive" as const,
		color: "red" as const,
		defaultValue: DEFAULT_AGING_THRESHOLDS.agingThresholdHIGH,
	},
];

interface AgingThresholdsModalProps {
	isOpen: boolean;
	onClose?: () => void;
	businessId: string;
	customerId: string;
	showBanner: boolean;
}

const AgingThresholdsModal: React.FC<AgingThresholdsModalProps> = ({
	isOpen,
	onClose,
	businessId,
	customerId,
	showBanner,
}) => {
	const flags = useFlags();
	const queryClient = useQueryClient();
	const { platformType } = useAppContextStore();
	const { errorToast, successToast } = useCustomToast();

	const isCustomizeAgingThresholdsWebhookMessagesEnabled =
		(flags[
			FEATURE_FLAGS.PAT_984_CUSTOMIZE_AGING_THRESHOLDS_WEBHOOK_MESSAGES
		] ??
			false) ||
		platformType === "admin";

	const {
		register,
		setValue,
		trigger,
		handleSubmit,
		formState: { errors },
	} = useForm({
		defaultValues: {
			agingThresholdLOW: DEFAULT_AGING_THRESHOLDS.agingThresholdLOW,
			agingThresholdMEDIUM: DEFAULT_AGING_THRESHOLDS.agingThresholdMEDIUM,
			agingThresholdHIGH: DEFAULT_AGING_THRESHOLDS.agingThresholdHIGH,
			agingThresholdMessageLOW:
				DEFAULT_AGING_THRESHOLDS.agingThresholdMessageLOW,
			agingThresholdMessageMEDIUM:
				DEFAULT_AGING_THRESHOLDS.agingThresholdMessageMEDIUM,
			agingThresholdMessageHIGH:
				DEFAULT_AGING_THRESHOLDS.agingThresholdMessageHIGH,
		},
		resolver: yupResolver(agingThresholdsSchema),
	});

	const { data: businessApplicantConfigData } =
		useGetBusinessApplicantConfig(businessId);
	const { data: customerApplicantConfigData } =
		useGetCustomerApplicantConfig(customerId);

	const { mutateAsync: postBusinessApplicantConfig } =
		usePostBusinessApplicantConfig();

	const { mutateAsync: updateBusinessApplicantConfig } =
		useUpdateBusinessApplicantConfig();

	useEffect(() => {
		let config: BusinessApplicantConfigResponseDataConfig[] = [];
		if (businessApplicantConfigData?.data?.config) {
			config = businessApplicantConfigData.data.config;
		} else if (customerApplicantConfigData?.data?.config) {
			config = customerApplicantConfigData.data.config;
		}
		config.forEach((item) => {
			setValue(
				`agingThreshold${item.urgency.toUpperCase()}` as any,
				item.threshold,
			);
			setValue(
				`agingThresholdMessage${item.urgency.toUpperCase()}` as any,
				item.message,
			);
		});
	}, [businessApplicantConfigData, customerApplicantConfigData]);

	const onSubmit = async (data: any) => {
		const postBusinessApplicantConfigPayload = {
			is_enabled: true,
		};

		let config: BusinessApplicantConfigResponseDataConfig[] = [];
		if (businessApplicantConfigData?.data?.config) {
			config = businessApplicantConfigData.data.config;
		} else if (customerApplicantConfigData?.data?.config) {
			config = customerApplicantConfigData.data.config;
		}
		config.forEach((item) => {
			item.threshold =
				data[`agingThreshold${item.urgency.toUpperCase()}`];
			item.message =
				data[`agingThresholdMessage${item.urgency.toUpperCase()}`];
		});

		try {
			await postBusinessApplicantConfig({
				businessId,
				payload: postBusinessApplicantConfigPayload,
			}).then(async () => {
				await updateBusinessApplicantConfig({
					businessId,
					payload: config,
				});
			});
			successToast("Aging thresholds updated successfully");
			// Invalidate queries to update all components using this data
			await queryClient.invalidateQueries({
				queryKey: ["getBusinessApplicantConfig", businessId],
			});
			await queryClient.invalidateQueries({
				queryKey: ["getCustomerApplicantConfig", customerId],
			});
			onClose?.();
		} catch (error) {
			errorToast(error);
		}
	};

	return (
		<Modal open={isOpen} onOpenChange={onClose}>
			<ModalContent className="p-0 w-full max-w-[600px] rounded-xl overflow-hidden top-[55%] lg:top-[50%] max-h-[660px]">
				<ModalHeader
					onClose={onClose}
					description="Aging Thresholds"
					className="px-4"
					title={
						<div className="flex flex-row items-center gap-2 justify-between">
							Aging Thresholds
						</div>
					}
				/>
				<div className="border-t border-gray-200" />
				<form onSubmit={handleSubmit(onSubmit)}>
					<ModalBody className="px-4 py-0 max-h-[500px] overflow-y-auto">
						<p className="text-sm text-gray-500">
							When enabled, you can set thresholds and filters on
							applications that have not been submitted during a
							specific time interval.
						</p>

						{/* table */}
						<table className="w-full text-left">
							<thead>
								<tr>
									<th className="text-sm text-gray-600 font-normal">
										Aging Threshold
									</th>
									<th className="text-sm text-gray-600 font-normal">
										Days Since Invite Accepted
									</th>
								</tr>
							</thead>
							<tbody>
								{AGING_THRESHOLDS_CONFIG.map(
									({ key, label, color }) => (
										<tr key={key}>
											<td>
												<AgingThresholdBadge
													color={color}
													label={capitalize(label)}
													className="text-xs w-fit px-3 py-1 rounded"
												/>
											</td>
											<td>
												<FormattedInput
													type="text"
													id={key}
													name={key}
													suffix="Days"
													register={register}
													errors={errors}
													className="w-[87px]"
													onChange={(e) => {
														const sanitizedValue =
															e?.target?.value
																.replace(
																	/[^0-9]/g,
																	"",
																)
																.slice(0, 4);
														e.target.value =
															sanitizedValue;
														setValue(
															key as any,
															Number(
																sanitizedValue,
															),
															{
																shouldDirty: true,
															},
														);
														// Trigger validation on all aging threshold fields
														void trigger([
															"agingThresholdLOW",
															"agingThresholdMEDIUM",
															"agingThresholdHIGH",
														]);
													}}
												/>
											</td>
										</tr>
									),
								)}
							</tbody>
						</table>

						{isCustomizeAgingThresholdsWebhookMessagesEnabled ? (
							<>
								<h3 className="text-lg font-semibold text-[#0A0A0A]">
									Manage Webhook Messages
								</h3>
								<p className="text-sm text-gray-500">
									Customize the messages sent via webhooks
									when each aging threshold is triggered.
								</p>
								{[
									{
										key: "agingThresholdMessageLOW" as const,
										label: "Low Aging Threshold Message",
										placeholder:
											"Enter low aging threshold message...",
										urgency: "low" as const,
										defaultValue:
											DEFAULT_AGING_THRESHOLDS.agingThresholdMessageLOW,
									},
									{
										key: "agingThresholdMessageMEDIUM" as const,
										label: "Medium Aging Threshold Message",
										placeholder:
											"Enter medium aging threshold message...",
										urgency: "medium" as const,
										defaultValue:
											DEFAULT_AGING_THRESHOLDS.agingThresholdMessageMEDIUM,
									},
									{
										key: "agingThresholdMessageHIGH" as const,
										label: "High Aging Threshold Message",
										placeholder:
											"Enter high aging threshold message...",
										urgency: "high" as const,
										defaultValue:
											DEFAULT_AGING_THRESHOLDS.agingThresholdMessageHIGH,
									},
								].map(
									({
										key,
										label,
										placeholder,
										defaultValue,
									}) => (
										<div key={key}>
											<div className="flex justify-between">
												<p className="text-xs text-gray-500">
													{label}*
												</p>
												<button
													type="button"
													className="text-xs text-blue-600 cursor-pointer"
													onClick={() => {
														setValue(
															key,
															defaultValue,
															{
																shouldDirty: true,
															},
														);
														void trigger([key]);
													}}
												>
													Reset to Default
												</button>
											</div>
											<textarea
												{...register(key)}
												placeholder={placeholder}
												className="w-full mt-2 h-24 border ring-1 ring-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-800 text-sm 3xl:text-base rounded-md p-2 resize-none"
											/>
											{errors[key] && (
												<p className="text-sm text-red-500">
													{errors[key]?.message}
												</p>
											)}
										</div>
									),
								)}
							</>
						) : null}
						{showBanner && (
							<div className="bg-yellow-100 text-xs my-2 flex gap-x-2 text-yellow-800 p-4 rounded">
								<InformationCircleIcon className="w-5 h-5 text-[#A16207]" />{" "}
								<span className="text-sm">
									Saving these changes will apply to all cases
									associated with this business
								</span>
							</div>
						)}
					</ModalBody>
					<div className="border-t border-gray-200" />
					<ModalFooter className="flex flex-row items-center justify-end p-2 px-4">
						<Button
							variant="outline"
							type="button"
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button variant="default" type="submit">
							Save
						</Button>
					</ModalFooter>
				</form>
			</ModalContent>
		</Modal>
	);
};

export default AgingThresholdsModal;
