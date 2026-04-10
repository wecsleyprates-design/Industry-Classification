import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	DocumentTextIcon,
	ExclamationTriangleIcon,
	GlobeAmericasIcon,
	KeyIcon,
	PencilSquareIcon,
	ScaleIcon,
	ShieldCheckIcon,
	UserCircleIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import Button from "@/components/Button";
import { Toggle } from "@/components/Input";
import { useCustomToast } from "@/hooks/useCustomToast";
import { EnhancementSchema } from "@/lib/validation";
import {
	useCreateOrUpdateCustomerIntegrationSettings,
	useCreatePaymentProcessorEntitlements,
	useGetCustomerById,
	useGetCustomerIntegrationSettingsByCustomerId,
	useGetCustomerIntegrationStatus,
	useGetCustomerSettingsById,
	useUpdateCustomerById,
	useUpdateCustomerIntegrationStatus,
} from "@/services/queries/customer.query";
import {
	useGetOnboardingSetup,
	useUpdateOnboardingSetup,
} from "@/services/queries/onboarding.query";
import {
	type EnhancementForm,
	type getCustomerIntegrationResponseData,
} from "@/types/customer";

interface Props {
	customerId: string;
}

const EnhancementFeatures: React.FC<Props> = ({ customerId }) => {
	const { successToast, errorToast } = useCustomToast();

	const {
		setValue,
		getValues,
		reset,
		watch,
		handleSubmit,
		formState: { isDirty },
	} = useForm<EnhancementForm>({
		mode: "all",
		defaultValues: {
			enhancedKYB: false,
			enhancedPublicRecords: false,
			identityDataPrefill: false,
			internationalKYB: false,
			isPostSubmissionEditingEnabled: false,
			processorOrchestration: false,
			riskMonitoring: false,
			advancedWatchlist: false,
		} satisfies EnhancementForm,
		resolver: yupResolver(EnhancementSchema),
	});

	const {
		data: customerDetailsData,
		isLoading: customerDetailsLoading,
		refetch: refetchCustomerDetails,
	} = useGetCustomerById(customerId);

	const {
		mutateAsync: updateCustomerById,
		isPending: updateCustomerByIdLoading,
		data: updateCustomerByIdData,
		error: updateCustomerByIdError,
	} = useUpdateCustomerById();

	const {
		data: customerIntegrationStatusData,
		isLoading: customerIntegrationStatusLoading,
		refetch: refetchCustomerIntegrationStatus,
	} = useGetCustomerIntegrationStatus(customerId ?? "");

	const { data: integrationSettingsData, refetch: refetchIntegrationSettings } =
		useGetCustomerIntegrationSettingsByCustomerId(customerId ?? "");

	const { mutateAsync: createOrUpdateCustomerIntegrationSettings } =
		useCreateOrUpdateCustomerIntegrationSettings();

	const {
		mutateAsync: updateCustomerIntegrationStatus,
		data: updateCustomerIntegrationStatusData,
		error: updateCustomerIntegrationError,
		isPending: updateCustomerIntegrationStatusLoading,
		reset: resetUpdateCustomerIntegrationStatus,
	} = useUpdateCustomerIntegrationStatus();

	const {
		mutateAsync: createPaymentProcessorEntitlements,
		error: createPaymentProcessorEntitlementsError,
		isPending: createPaymentProcessorEntitlementsLoading,
	} = useCreatePaymentProcessorEntitlements();

	const {
		data: onboardingSetupData,
		isLoading: onboardingSetupLoading,
		refetch: refetchOnboardingSetup,
	} = useGetOnboardingSetup(customerId ?? "");

	const {
		mutateAsync: updateOnboardingSetup,
		data: updateOnboardingSetupData,
		error: updateOnboardingSetupError,
		isPending: updateOnboardingSetupLoading,
		reset: resetUpdateOnboardingSetup,
	} = useUpdateOnboardingSetup();

	const { data: preFilledSettingData } = useGetCustomerSettingsById(
		customerId ?? "",
	);

	const shouldShowPostSubmissionEditing =
		preFilledSettingData?.data?.domain &&
		onboardingSetupData?.data?.find((data) => data.code === "white_label_setup")
			?.is_enabled;

	const discardChangeHandler = async () => {
		const kyxStatus = customerIntegrationStatusData?.data?.find(
			(integration) => integration.integration_code === "kyx",
		)?.status;

		const truliooStatus = customerIntegrationStatusData?.data?.find(
			(item) => item.integration_code === "trulioo",
		)?.status;

		const advancedWatchlistStatus =
			integrationSettingsData?.data?.settings?.advanced_watchlist?.status;

		const middeskStatus = customerIntegrationStatusData?.data?.find(
			(item) => item.integration_code === "middesk",
		)?.status;

		const verdataStatus = customerIntegrationStatusData?.data?.find(
			(item) => item.integration_code === "verdata",
		)?.status;

		const processorOrchestrationStatus =
			customerIntegrationStatusData?.data?.find(
				(item) => item.integration_code === "processor_orchestration",
			)?.status;

		const postSubmissionStatus = onboardingSetupData?.data?.find(
			(data) => data.code === "post_submission_editing_setup",
		)?.is_enabled;

		const riskMonitoringStatus =
			customerDetailsData?.data?.settings?.risk_monitoring;

		reset({
			identityDataPrefill: kyxStatus === "ENABLED",
			enhancedKYB: middeskStatus === "ENABLED",
			enhancedPublicRecords: verdataStatus === "ENABLED",
			internationalKYB: truliooStatus === "ENABLED",
			advancedWatchlist: advancedWatchlistStatus === "ACTIVE",
			isPostSubmissionEditingEnabled: postSubmissionStatus ?? false,
			processorOrchestration: processorOrchestrationStatus === "ENABLED",
			riskMonitoring: riskMonitoringStatus ?? false,
		});
	};

	const onSubmit = async (submitData: EnhancementForm) => {
		try {
			const {
				identityDataPrefill,
				enhancedKYB,
				enhancedPublicRecords,
				internationalKYB,
				advancedWatchlist,
				isPostSubmissionEditingEnabled,
				processorOrchestration,
				riskMonitoring,
			} = submitData;

			const updates = [];

			let kyx: getCustomerIntegrationResponseData | undefined;
			let trulioo: getCustomerIntegrationResponseData | undefined;
			let middesk: getCustomerIntegrationResponseData | undefined;
			let verdata: getCustomerIntegrationResponseData | undefined;
			let processorOrch: getCustomerIntegrationResponseData | undefined;

			customerIntegrationStatusData?.data?.forEach((item) => {
				if (item.integration_code === "kyx") {
					kyx = item;
				} else if (item.integration_code === "trulioo") {
					trulioo = item;
				} else if (item.integration_code === "middesk") {
					middesk = item;
				} else if (item.integration_code === "verdata") {
					verdata = item;
				} else if (item.integration_code === "processor_orchestration") {
					processorOrch = item;
				}
			});

			if (
				kyx &&
				(identityDataPrefill ? "ENABLED" : "DISABLED") !== kyx.status
			) {
				updates.push({
					integrationStatusId: kyx.integration_status_id,
					newStatus: identityDataPrefill
						? "ENABLED"
						: ("DISABLED" as "ENABLED" | "DISABLED"),
				});
			}

			if (
				trulioo &&
				(internationalKYB ? "ENABLED" : "DISABLED") !== trulioo.status
			) {
				updates.push({
					integrationStatusId: trulioo.integration_status_id,
					newStatus: internationalKYB
						? "ENABLED"
						: ("DISABLED" as "ENABLED" | "DISABLED"),
				});
			}

			// Handle Advanced Watchlist separately as it uses a different API
			const currentSettings =
				integrationSettingsData?.data?.settings?.advanced_watchlist;
			const initialStatus = currentSettings?.status === "ACTIVE";

			if (advancedWatchlist !== initialStatus) {
				await createOrUpdateCustomerIntegrationSettings({
					customerID: customerId ?? "",
					settings: {
						advanced_watchlist: {
							mode: currentSettings?.mode ?? "PRODUCTION",
							status: advancedWatchlist ? "ACTIVE" : "INACTIVE",
						},
					},
				});
				await refetchIntegrationSettings();
			}

			if (
				middesk &&
				(enhancedKYB ? "ENABLED" : "DISABLED") !== middesk.status
			) {
				updates.push({
					integrationStatusId: middesk.integration_status_id,
					newStatus: enhancedKYB
						? "ENABLED"
						: ("DISABLED" as "ENABLED" | "DISABLED"),
				});
			}

			if (
				verdata &&
				(enhancedPublicRecords ? "ENABLED" : "DISABLED") !== verdata.status
			) {
				updates.push({
					integrationStatusId: verdata.integration_status_id,
					newStatus: enhancedPublicRecords
						? "ENABLED"
						: ("DISABLED" as "ENABLED" | "DISABLED"),
				});
			}

			const isProcessorOrchestrationChanging =
				processorOrch &&
				(processorOrchestration ? "ENABLED" : "DISABLED") !==
					processorOrch.status;

			if (isProcessorOrchestrationChanging) {
				await createPaymentProcessorEntitlements({
					customerId,
					payload: { enabled: processorOrchestration },
				});
			}

			if (
				processorOrch &&
				(processorOrchestration ? "ENABLED" : "DISABLED") !==
					processorOrch.status
			) {
				updates.push({
					integrationStatusId: processorOrch.integration_status_id,
					newStatus: processorOrchestration
						? "ENABLED"
						: ("DISABLED" as "ENABLED" | "DISABLED"),
				});
			}

			if (updates.length > 0) {
				await updateCustomerIntegrationStatus({
					customerId: customerId ?? "",
					payload: updates,
				});

				await refetchCustomerIntegrationStatus();
				resetUpdateCustomerIntegrationStatus();
			}

			const currentPostSubmission = onboardingSetupData?.data?.find(
				(d) => d.code === "post_submission_editing_setup",
			);
			if (
				currentPostSubmission &&
				isPostSubmissionEditingEnabled !==
					(currentPostSubmission.is_enabled ?? false)
			) {
				await updateOnboardingSetup({
					customerId: customerId ?? "",
					body: {
						setups: [
							{
								setup_id: currentPostSubmission.setup_id ?? 6,
								is_enabled: isPostSubmissionEditingEnabled,
							},
						],
					},
				});
				await refetchOnboardingSetup();
				resetUpdateOnboardingSetup();
			}

			const riskMonitoringCurrentValue =
				customerDetailsData?.data?.settings?.risk_monitoring;
			if (riskMonitoring !== riskMonitoringCurrentValue) {
				await updateCustomerById({
					customerId: customerId ?? "",
					body: { settings: { risk_monitoring: riskMonitoring } },
				});
				await refetchCustomerDetails();
			}

			// Always reset form state to initial or new data after a submit attempt
			// to clear isDirty and hide the action bar.
			successToast("Settings processed.");
			reset(submitData);
		} catch (error) {
			console.error("Error in onSubmit:", error);
			errorToast("An error occurred while saving changes.");
		}
	};

	useEffect(() => {
		if (customerIntegrationStatusData?.data && integrationSettingsData?.data) {
			const truliooStatus = customerIntegrationStatusData.data.find(
				(integration) => integration.integration_code === "trulioo",
			)?.status;

			const advancedWatchlistStatus =
				integrationSettingsData.data.settings?.advanced_watchlist?.status;

			const kyxStatus = customerIntegrationStatusData.data.find(
				(integration) => integration.integration_code === "kyx",
			)?.status;

			const middeskStatus = customerIntegrationStatusData.data.find(
				(integration) => integration.integration_code === "middesk",
			)?.status;

			const verdataStatus = customerIntegrationStatusData.data.find(
				(integration) => integration.integration_code === "verdata",
			)?.status;

			const processorOrchestrationStatus =
				customerIntegrationStatusData.data.find(
					(integration) =>
						integration.integration_code === "processor_orchestration",
				)?.status;
			const riskMonitoringStatus =
				customerDetailsData?.data?.settings?.risk_monitoring;

			if (onboardingSetupData?.data) {
				const postSubmissionStatus = onboardingSetupData.data.find(
					(data) => data.code === "post_submission_editing_setup",
				)?.is_enabled;

				reset({
					enhancedKYB: middeskStatus === "ENABLED",
					enhancedPublicRecords: verdataStatus === "ENABLED",
					internationalKYB: truliooStatus === "ENABLED",
					advancedWatchlist: advancedWatchlistStatus === "ACTIVE",
					identityDataPrefill: kyxStatus === "ENABLED",
					isPostSubmissionEditingEnabled: postSubmissionStatus ?? false,
					processorOrchestration: processorOrchestrationStatus === "ENABLED",
					riskMonitoring: riskMonitoringStatus ?? false,
				});
			}
		}
	}, [
		customerIntegrationStatusData,
		integrationSettingsData,
		onboardingSetupData,
		customerDetailsData,
	]);

	useEffect(() => {
		if (updateCustomerIntegrationStatusData) {
			successToast((updateCustomerIntegrationStatusData as any)?.message);
		}
		if (updateOnboardingSetupData) {
			successToast((updateOnboardingSetupData as any)?.message);
		}
		if (updateCustomerByIdData) {
			successToast(updateCustomerByIdData?.message);
		}
	}, [
		updateCustomerIntegrationStatusData,
		updateOnboardingSetupData,
		updateCustomerByIdData,
	]);

	useEffect(() => {
		if (updateCustomerIntegrationError)
			errorToast(updateCustomerIntegrationError);
		if (updateOnboardingSetupError) errorToast(updateOnboardingSetupError);
		if (createPaymentProcessorEntitlementsError)
			errorToast(createPaymentProcessorEntitlementsError);
		if (updateCustomerByIdError) errorToast(updateCustomerByIdError);
	}, [
		updateCustomerIntegrationError,
		updateOnboardingSetupError,
		createPaymentProcessorEntitlementsError,
		updateCustomerByIdError,
	]);

	return (
		<form
			onSubmit={handleSubmit(onSubmit, (errors) => {
				console.error("Form validation errors:", errors);
				errorToast("Please check the form for errors.");
			})}
		>
			<div className="overflow-hidden bg-white border divide-gray-200 rounded-xl mb-7 p-1">
				<div className="px-5 pt-2">
					<div className="mt-2 text-base font-semibold">Enhancements</div>
					<div className="mt-2 text-sm font-normal text-gray-500">
						Configure which integrations to include to match the customer’s
						needs.
					</div>
					{/* Identity Data Prefill :- KYX */}
					<div className={twMerge("flex justify-between px-3 pt-3")}>
						<div className="flex items-center my-4 mr-2">
							<div
								className="flex items-center justify-center w-10 h-10 round
			  ed-lg min-w-10 bg-blue-50"
							>
								<UserCircleIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									Identity Data Prefill
								</h2>
								<p className="text-sm text-gray-500">
									Enable the Worth platform to prefill PII about provided
									owners.
								</p>
							</div>
						</div>
						<div className="flex">
							<Toggle
								disabled={
									customerIntegrationStatusLoading ||
									updateCustomerIntegrationStatusLoading
								}
								value={watch().identityDataPrefill}
								onChange={async () => {
									setValue(
										"identityDataPrefill",
										!getValues().identityDataPrefill,
										{
											shouldDirty: true,
										},
									);
								}}
							/>
						</div>
					</div>
					{/* International KYB :- Trulioo */}
					<div className={twMerge("flex justify-between px-3")}>
						<div className="flex items-center my-4 mr-2">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
								<GlobeAmericasIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									International KYB
								</h2>
								<p className="text-sm text-gray-500">
									International KYB and business verification (e.g. foreign
									company filings, overseas addresses & names, global regulatory
									data, etc.)
								</p>
							</div>
						</div>
						<div className="flex">
							<Toggle
								disabled={
									customerIntegrationStatusLoading ||
									updateCustomerIntegrationStatusLoading
								}
								value={watch().internationalKYB}
								onChange={async () => {
									setValue("internationalKYB", !getValues().internationalKYB, {
										shouldDirty: true,
									});
								}}
							/>
						</div>
					</div>
					{/* Advanced Watchlists :- Trulioo */}
					<div className={twMerge("flex justify-between px-3")}>
						<div className="flex items-center my-4 mr-2">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
								<ShieldCheckIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									Advanced Watchlists
								</h2>
								<p className="text-sm text-gray-500">
									Submit individual owners/controllers for advanced PEP and OFAC
									watchlist screening for U.S. businesses.
								</p>
							</div>
						</div>
						<div className="flex">
							<Toggle
								disabled={
									customerIntegrationStatusLoading ||
									updateCustomerIntegrationStatusLoading
								}
								value={watch().advancedWatchlist}
								onChange={async () => {
									setValue(
										"advancedWatchlist",
										!getValues().advancedWatchlist,
										{
											shouldDirty: true,
										},
									);
								}}
							/>
						</div>
					</div>
					{/* Enhanced KYB :- Middesk */}
					<div className={twMerge("flex justify-between  px-3")}>
						<div className="flex items-center my-4 mr-2">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
								<DocumentTextIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									Enhanced KYB (United States Only)
								</h2>
								<p className="text-sm text-gray-500">
									KYB and business verification (e.g. Secretary of State
									filings, known addresses & names, etc.)
								</p>
							</div>
						</div>

						<div className="flex">
							<Toggle
								disabled={
									customerIntegrationStatusLoading ||
									updateCustomerIntegrationStatusLoading
								}
								value={watch().enhancedKYB}
								onChange={async () => {
									setValue("enhancedKYB", !getValues().enhancedKYB, {
										shouldDirty: true,
									});
								}}
							/>
						</div>
					</div>
					{/* Equifax */}
					<div className={twMerge("flex justify-between px-3")}>
						<div className="flex items-center my-4 mr-2">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
								<ScaleIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									Enhanced Public Records
								</h2>
								<p className="text-sm text-gray-500">
									Pull social reviews, bankruptcies, judgements, and liens.
								</p>
							</div>
						</div>

						<div className="flex">
							<Toggle
								disabled={
									customerIntegrationStatusLoading ||
									updateCustomerIntegrationStatusLoading
								}
								value={watch().enhancedPublicRecords}
								onChange={async () => {
									setValue(
										"enhancedPublicRecords",
										!getValues().enhancedPublicRecords,
										{
											shouldDirty: true,
										},
									);
								}}
							/>
						</div>
					</div>
					{shouldShowPostSubmissionEditing && (
						<div className={twMerge("flex justify-between px-3")}>
							<div className="flex items-center my-4 mr-2">
								<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
									<PencilSquareIcon className="w-6 h-6 text-blue-600" />
								</div>
								<div className="pl-3.5">
									<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
										Post-Submission Editing
									</h2>
									<p className="text-sm text-gray-500">
										Enable applicants to upload documents and edit applications
										after application has been submitted.
									</p>
								</div>
							</div>

							<div className="flex">
								<Toggle
									disabled={
										onboardingSetupLoading ||
										updateCustomerIntegrationStatusLoading ||
										updateOnboardingSetupLoading
									}
									value={watch().isPostSubmissionEditingEnabled}
									onChange={async () => {
										setValue(
											"isPostSubmissionEditingEnabled",
											!getValues().isPostSubmissionEditingEnabled,
											{
												shouldDirty: true,
											},
										);
									}}
								/>
							</div>
						</div>
					)}
					{/* Processor Orchestration */}
					<div className={twMerge("flex justify-between px-3")}>
						<div className="flex items-center my-4 mr-2">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
								<KeyIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									Processor Orchestration
								</h2>
								<p className="text-sm text-gray-500">
									Enables payment processor integrations at the platform level.
								</p>
							</div>
						</div>

						<div className="flex">
							<Toggle
								disabled={
									customerIntegrationStatusLoading ||
									updateCustomerIntegrationStatusLoading ||
									createPaymentProcessorEntitlementsLoading
								}
								value={watch().processorOrchestration}
								onChange={async () => {
									setValue(
										"processorOrchestration",
										!getValues().processorOrchestration,
										{
											shouldDirty: true,
										},
									);
								}}
							/>
						</div>
					</div>

					<div className={twMerge("flex justify-between px-3")}>
						<div className="flex items-center my-4 mr-2">
							<div className="flex items-center justify-center w-10 h-10 rounded-lg min-w-10 bg-blue-50">
								<ExclamationTriangleIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="pl-3.5">
								<h2 className="text-sm text-[#1F2937] font-medium -mt-1 mb-1">
									Risk Monitoring
								</h2>
								<p className="text-sm text-gray-500">
									Enable risk monitoring for this customer.
								</p>
							</div>
						</div>

						<div className="flex">
							<Toggle
								disabled={customerDetailsLoading || updateCustomerByIdLoading}
								value={watch().riskMonitoring}
								onChange={async () => {
									setValue("riskMonitoring", !getValues().riskMonitoring, {
										shouldDirty: true,
									});
								}}
							/>
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
				<div className="flex flex-row mr-2 space-x-2 sm:mr-10 lg:mr-80">
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
						isLoading={
							updateCustomerIntegrationStatusLoading ||
							updateOnboardingSetupLoading ||
							createPaymentProcessorEntitlementsLoading
						}
					>
						Save Changes
					</Button>
				</div>
			</motion.div>
		</form>
	);
};

export default EnhancementFeatures;
