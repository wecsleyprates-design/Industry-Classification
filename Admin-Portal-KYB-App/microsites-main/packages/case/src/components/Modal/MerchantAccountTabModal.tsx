import React from "react";
import { useForm } from "react-hook-form";
import { CheckIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import StripeIcon from "@/assets/svg/StripeIcon";
import { CreateMerchantProfileSchema } from "@/lib/validation";
import {
	useCreateMerchantProfile,
	useGetPaymentProcessorDetails,
} from "@/services/queries/integration.query";
import { type createMerchantProfilePayload } from "@/types/integrations";
import DepositoryAccountSelect from "../Dropdown/DepositAccountDropdown";

import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Form, FormField } from "@/ui/form";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";
import Toggle from "@/ui/toggle";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSubmitSuccess: () => void;
	businessId: string;
	platformId: number;
	customerId: string;
	disabled?: boolean;
};

const CAPABILITIES = [
	{
		name: "capabilities.card_payments" as const,
		label: "Card Payments",
	},
	{
		name: "capabilities.transfers" as const,
		label: "Transfers",
	},
	{
		name: "capabilities.us_bank_account_ach_payments" as const,
		label: "ACH Debit (US Bank Account Payments)",
	},
];

export const ManageMerchantProfileModal: React.FC<Props> = ({
	isOpen,
	onClose,
	onSubmitSuccess,
	platformId,
	businessId,
	customerId,
	disabled = false,
}) => {
	const { data: paymentProcessorData, isLoading: paymentProcessorLoading } =
		useGetPaymentProcessorDetails(disabled ? "" : customerId);
	const {
		mutateAsync: createMerchantProfile,
		isPending: createMerchantProfileLoading,
	} = useCreateMerchantProfile();

	const form = useForm({
		resolver: yupResolver(CreateMerchantProfileSchema),
		defaultValues: {
			onboardImmediately: false,
			capabilities: {
				card_payments: true,
				transfers: true,
				us_bank_account_ach_payments: true,
			},
			bankId: "",
		},
	});

	const handleSubmit = async (data: any) => {
		const paymentProcessorObject = paymentProcessorData?.data.find((e) => {
			return e.platform_id === 41 && Object.keys(e.metadata).length;
		});
		const payload: createMerchantProfilePayload = {
			onboardImmediately: data.onboardImmediately,
			processorId: String(
				paymentProcessorObject?.metadata.metadata["worth:processorId"],
			),
			platformId: paymentProcessorObject?.platform_id ?? 41,
			paymentGroupId: String(paymentProcessorObject?.platform_id),
			capabilities: {
				card_payments: { requested: data.capabilities.card_payments },
				transfers: { requested: data.capabilities.transfers },
				us_bank_account_ach_payments: {
					requested: data.capabilities.us_bank_account_ach_payments,
				},
			},
			businesses: [businessId].map((businessId) => ({
				businessId,
				platformId,
				banking: {
					bankId: data.bankId,
					bankType: "depositor",
				},
			})),
		};
		await createMerchantProfile({ customerId, body: payload });
		onSubmitSuccess();
		onClose();
	};

	return (
		<Modal open={isOpen} onOpenChange={onClose}>
			<ModalContent className="p-0 min-w-[440px] w-[440px] gap-0 top-1/2">
				<ModalHeader
					title="Manage Merchant Profile"
					className="border-b"
					onClose={onClose}
				/>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)}>
						<ModalBody className="px-5 pb-4 h-[calc(100vh-150px)] overflow-y-auto">
							<div className="space-y-3">
								<div className="text-gray-600 font-medium text-base">
									Payment Processor
								</div>
								<div className="border border-[#155DFC] bg-blue-50 rounded-md px-3 py-2 text-sm flex gap-x-3 justify-between">
									<div className="flex gap-x-3">
										<div className="my-auto">
											<StripeIcon />
										</div>
										<div>
											Stripe
											<div className="text-xs text-muted-foreground">
												Online payment processing
											</div>
										</div>
									</div>
									<div className="my-auto">
										<CheckIcon className="w-4 text-[#155DFC] stroke-2" />
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<div className="text-gray-600 font-medium text-base">
									Capabilities
								</div>
								<div className="text-sm text-gray-500">
									Select the capabilities this merchant should
									be enabled for.
								</div>

								<div className="rounded-xl border border-gray-200 overflow-hidden">
									{CAPABILITIES.map((capability, index) => (
										<React.Fragment key={capability.name}>
											<FormField
												control={form.control}
												name={capability.name}
												render={({ field }) => (
													<div className="flex items-center gap-4 px-4 py-4 select-none">
														<Checkbox
															className="shadow-none"
															checked={
																field.value
															}
															disabled
														/>

														<span className="text-base text-gray-900">
															{capability.label}
														</span>
													</div>
												)}
											/>

											{index <
												CAPABILITIES.length - 1 && (
												<div className="h-px bg-gray-200 mx-4" />
											)}
										</React.Fragment>
									))}
								</div>
							</div>

							<div className="text-gray-600 font-medium text-base">
								Provisioning
							</div>

							<FormField
								control={form.control}
								name="onboardImmediately"
								render={({ field }) => (
									<div className="flex items-center justify-between rounded-xl px-4 py-4  bg-gray-50 ">
										<div className="space-y-1">
											<div className="text-gray-900 text-base">
												Immediate Provisioning
											</div>
											<div className="text-sm text-gray-500">
												Merchant accounts will be
												provisioned automatically once
												the business is verified.
											</div>
										</div>
										<Toggle
											value={field.value}
											onChange={() => {
												field.onChange(!field.value);
											}}
											disabled={disabled}
										/>
									</div>
								)}
							/>

							<div className="text-gray-600 font-medium text-base">
								Payout Account
							</div>
							<div className="text-sm text-gray-500 -mt-3">
								Choose the bank account to use for Stripe
								payouts.
							</div>
							<div className="text-sm text-gray-500 -mb-2.5">
								Bank Account
							</div>
							<DepositoryAccountSelect
								name={"selectBank"}
								bankIdField={"bankId"}
								businessId={businessId}
								disabled={disabled}
							/>
						</ModalBody>

						<ModalFooter className="border-t flex justify-end gap-2 px-5 py-3">
							<Button
								variant="outline"
								type="button"
								onClick={onClose}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={
									paymentProcessorLoading ||
									createMerchantProfileLoading ||
									disabled
								}
							>
								Save
							</Button>
						</ModalFooter>
					</form>
				</Form>
			</ModalContent>
		</Modal>
	);
};
