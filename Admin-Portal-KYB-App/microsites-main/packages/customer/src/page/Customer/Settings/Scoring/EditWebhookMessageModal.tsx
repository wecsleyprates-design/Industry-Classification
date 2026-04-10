import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useCustomToast } from "@/hooks";
import { webhookMessageSchema } from "@/lib/validation";
import {
	useGetCustomerApplicantConfig,
	useUpdateCustomerApplicantDaysConfig,
} from "@/services/queries/aging.query";
import { type CustomerApplicantConfigResponseData } from "@/types/agingThreshold";

import { Button } from "@/ui/button";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";

interface WebhookMessageFormValues {
	lowAgingThresholdMessage: string;
	mediumAgingThresholdMessage: string;
	highAgingThresholdMessage: string;
}

type Props = {
	isOpen: boolean;
	onClose: () => void;
	customerId: string;
	agingThresholdData?: CustomerApplicantConfigResponseData;
};

const DEFAULT_MESSAGES = {
	low: "Please complete your application soon.",
	medium:
		"Your application has been pending for some time — please review missing details.",
	high: "Your application is overdue and may be closed soon if no action is taken.",
} as const;

const EditWebhookMessageModal: React.FC<Props> = ({
	isOpen,
	onClose,
	customerId,
	agingThresholdData,
}) => {
	const { successToast, errorToast } = useCustomToast();

	const { refetch: refetchCustomerApplicantConfig } =
		useGetCustomerApplicantConfig(customerId);

	const {
		mutateAsync: updateCustomerApplicantDaysConfig,
		isPending: isUpdating,
	} = useUpdateCustomerApplicantDaysConfig();

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		formState: { errors, isDirty },
	} = useForm<WebhookMessageFormValues>({
		resolver: yupResolver(webhookMessageSchema),
		defaultValues: {
			lowAgingThresholdMessage: "",
			mediumAgingThresholdMessage: "",
			highAgingThresholdMessage: "",
		},
	});

	// Populate form with existing data when modal opens or data changes
	useEffect(() => {
		if (agingThresholdData?.config) {
			const configByUrgency = agingThresholdData.config.reduce<
				Record<string, { message?: string }>
			>((acc, config) => {
				acc[config.urgency] = config;
				return acc;
			}, {});

			reset({
				lowAgingThresholdMessage: configByUrgency.low?.message ?? "",
				mediumAgingThresholdMessage: configByUrgency.medium?.message ?? "",
				highAgingThresholdMessage: configByUrgency.high?.message ?? "",
			});
		}
	}, [agingThresholdData, reset]);

	const handleResetToDefault = (
		field: keyof WebhookMessageFormValues,
		urgency: "low" | "medium" | "high",
	) => {
		setValue(field, DEFAULT_MESSAGES[urgency], { shouldDirty: true });
	};

	const onSubmit = async (data: WebhookMessageFormValues) => {
		if (!agingThresholdData?.config) {
			errorToast("No aging threshold configuration found");
			return;
		}

		try {
			const messageMap = {
				low: data.lowAgingThresholdMessage,
				medium: data.mediumAgingThresholdMessage,
				high: data.highAgingThresholdMessage,
			} as const;

			const updatedConfig = agingThresholdData.config.map((item) => ({
				...item,
				message: messageMap[item.urgency] ?? item.message,
			}));

			await updateCustomerApplicantDaysConfig({
				customer_id: customerId,
				payload: updatedConfig,
			});

			await refetchCustomerApplicantConfig();
			successToast("Webhook messages updated successfully");
			onClose();
		} catch (error) {
			errorToast("Failed to update webhook messages");
		}
	};

	return (
		<Modal open={isOpen} onOpenChange={onClose}>
			<ModalContent className="gap-0 px-0 py-2 top-[50%] w-[600px] max-w-full">
				<ModalHeader
					onClose={onClose}
					description="Manage Webhook Messages"
					className="px-4"
					title={
						<div className="flex flex-row items-center gap-2 justify-between">
							Manage Webhook Messages
						</div>
					}
				/>
				<div className="border-t border-gray-200" />
				<form
					onSubmit={async (e) => {
						e.stopPropagation();
						await handleSubmit(onSubmit)(e);
					}}
				>
					<ModalBody className="px-4">
						<p className="text-sm text-gray-500 pt-2">
							Customize the messages sent via webhooks when each aging threshold
							is triggered.
						</p>
						{[
							{
								key: "lowAgingThresholdMessage" as const,
								label: "Low Aging Threshold Message",
								urgency: "low" as const,
							},
							{
								key: "mediumAgingThresholdMessage" as const,
								label: "Medium Aging Threshold Message",
								urgency: "medium" as const,
							},
							{
								key: "highAgingThresholdMessage" as const,
								label: "High Aging Threshold Message",
								urgency: "high" as const,
							},
						].map(({ key, label, urgency }) => (
							<div key={key}>
								<div className="flex justify-between">
									<p className="text-xs text-gray-500">{label}*</p>
									<button
										type="button"
										className="text-xs text-blue-600 cursor-pointer"
										onClick={() => {
											handleResetToDefault(key, urgency);
										}}
									>
										Reset to Default
									</button>
								</div>
								<textarea
									{...register(key)}
									className="w-full mt-2 h-24 border ring-1 ring-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-800 text-sm 3xl:text-base rounded-md p-2 resize-none"
								/>
								{errors[key] && (
									<p className="text-sm text-red-500">{errors[key]?.message}</p>
								)}
							</div>
						))}
					</ModalBody>
					<div className="border-t border-gray-200" />
					<ModalFooter className="flex flex-row items-center justify-end p-2 px-4">
						<Button variant="outline" type="button" onClick={onClose}>
							Cancel
						</Button>
						<Button
							variant="default"
							type="submit"
							disabled={!isDirty || isUpdating}
						>
							{isUpdating ? "Saving..." : "Save"}
						</Button>
					</ModalFooter>
				</form>
			</ModalContent>
		</Modal>
	);
};

export default EditWebhookMessageModal;
