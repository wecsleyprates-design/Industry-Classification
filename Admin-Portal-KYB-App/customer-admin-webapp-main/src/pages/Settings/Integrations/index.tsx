import { useRef, useState } from "react";
import { Switch } from "@headlessui/react";
import {
	ArrowUpTrayIcon,
	CreditCardIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	EyeSlashIcon,
	InformationCircleIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import ReactCustomTooltip from "@/components/Tooltip/ReactCustomTooltip";
import { useIntegrationSettings } from "@/hooks/useIntegrationSettings";
import { getItem } from "@/lib/localStorage";
import { useGetCustomerIntegrationSettingsByCustomerId } from "@/services/queries/riskAlert.query";
import ConnectionBox from "./ConnectionBox";
import StripeIntegration from "./StripeIntegration";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const Integrations = () => {
	const [showKeyPassword, setShowKeyPassword] = useState(false);
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [pendingFormData, setPendingFormData] = useState<any>(null);

	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";

	const { data: customerIntegrationSettings } =
		useGetCustomerIntegrationSettingsByCustomerId(customerId);

	const isProcessorOrchestrationEnabled =
		customerIntegrationSettings?.data?.settings?.processor_orchestration
			?.isEnabled;

	const fileInputRef = useRef<HTMLInputElement>(null);
	const {
		handleSubmitAndTest,
		handleSubmit,
		register,
		setValue,
		watch,
		reset,
		isLoading,
		isSubmitting,
		errors: errorsFormSubmit,
		checkRequiredFieldsFilled,
		onSubmit,
		fields,
		append,
		remove,
	} = useIntegrationSettings();

	const isActive = watch("isActive");

	const onToggle = () => {
		setValue("isActive", !isActive);
		if (isActive) {
			setShowKeyPassword(false);
		}
	};

	const resetFile = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
			setValue("keyFile", null);
		}
	};

	const closeModal = () => {
		setShowConfirmModal(false);
		setPendingFormData(null);
	};

	const handleConfirmEnableSwitch = () => {
		if (pendingFormData) {
			setValue("isActive", true);

			if (pendingFormData.needsTest) {
				// This was from "Save & Test" button
				void handleSubmitAndTest();
			} else {
				// This was from "Save" button
				void handleSubmit();
			}
		}
		closeModal();
	};

	const handleDisableMatchPro = () => {
		if (pendingFormData) {
			const { needsTest, ...formData } = pendingFormData;
			onSubmit(formData);
		}
		closeModal();
	};

	// Custom submit handlers with modal logic
	const handleSaveWithModal = (shouldTest: boolean) => {
		const formData = watch();
		// If switch is OFF but required fields are filled, show confirmation modal
		if (!formData.isActive && checkRequiredFieldsFilled(formData)) {
			setPendingFormData({ ...formData, needsTest: shouldTest });
			setShowConfirmModal(true);
			return;
		}
		if (shouldTest) {
			void handleSubmitAndTest();
		} else {
			void handleSubmit();
		}
	};

	if (isLoading || isSubmitting) {
		return <FullPageLoader />;
	}

	return (
		<>
			<div className="bg-white w-full p-4 border rounded-xl mt-8 border-[#E5E7EB]">
				<div className="flex items-start mt-2">
					<div className="flex-shrink-0">
						<div className="flex items-center p-2 ml-2 mr-2 bg-blue-50 rounded-xl w-14 h-14">
							<CreditCardIcon className="w-8 h-8 mx-auto text-blue-700" />
						</div>
					</div>
					<div className="flex flex-grow ml-4 flex-col">
						<div className="flex flex-row justify-between">
							<div className="flex items-start justify-start flex-col">
								<h2 className="mr-2 text-base font-semibold text-gray-800">
									Match Pro
								</h2>
								<p className="mt-1.5 text-sm text-gray-500">
									Enable MATCH Pro to support identity verification and risk
									assessment.
								</p>
							</div>
							<div className="flex items-center justify-end">
								<Switch
									checked={isActive}
									name="isActive"
									onChange={() => {
										onToggle();
									}}
									className={`${isActive ? "bg-blue-600" : "bg-gray-200"}
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2`}
								>
									<span
										aria-hidden="true"
										className={`${isActive ? "translate-x-5" : "translate-x-0"}
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
									/>
								</Switch>
							</div>
						</div>
						<div className="w-full">
							<form action="" className="w-full mt-4">
								<div className="w-full gap-x-8 gap-y-4 flex flex-col justify-between items-stretch sm:grid sm:grid-cols-2 sm:grid-rows-[minmax(min-content,1fr)]">
									<Input
										errors={errorsFormSubmit}
										label={"Consumer Key"}
										type="text"
										placeholder={`Enter Consumer Key`}
										register={register}
										name={"consumerKey"}
										className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
										labelClassName="text-xs font-medium text-gray-500"
										isRequired
									/>
									<div className="w-full flex flex-col col-span-1 row-span-1 relative">
										<Input
											errors={errorsFormSubmit}
											label="Key Password"
											id="keyPassword"
											name="keyPassword"
											placeholder="Enter key password"
											isRequired
											type={showKeyPassword ? "text" : "password"}
											register={register}
											className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
											labelClassName="text-xs font-medium text-gray-500"
											tooltip={
												<ReactCustomTooltip
													id="keyPassword"
													tooltip={
														<span>
															Key Password is required for the integration to
															work. Please enter the key password.
														</span>
													}
												>
													<InformationCircleIcon className="w-4 text-gray-400" />
												</ReactCustomTooltip>
											}
										>
											<div
												onClick={() => {
													setShowKeyPassword(!showKeyPassword);
												}}
												className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
											>
												{showKeyPassword ? (
													<EyeIcon className="w-5 h-5" aria-hidden="true" />
												) : (
													<EyeSlashIcon
														className="w-5 h-5"
														aria-hidden="true"
													/>
												)}
											</div>
										</Input>
									</div>
									{/* ICA Input List */}
									<div className="flex flex-col w-full col-span-2 space-y-2">
										<div className="flex items-center gap-x-1 mb-1">
											<label className="text-xs font-medium text-gray-500 block leading-6">
												Default Acquirer ID(s)
												<span className="text-red-500 ml-1">*</span>
											</label>
											<ReactCustomTooltip
												id="icas"
												tooltip={
													<span>
														Enter one or more Acquirer IDs. Select the radio
														button to set the default Acquirer ID.
													</span>
												}
											>
												<InformationCircleIcon className="w-4 text-gray-400" />
											</ReactCustomTooltip>
										</div>

										{fields.map((field, index) => (
											<div key={field.id} className="flex items-center gap-3">
												{/* Default Selector */}
												<div className="flex items-center justify-center">
													<input
														type="radio"
														name="default-ica"
														className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
														checked={watch(`icas.${index}.isDefault`)}
														onChange={() => {
															// Set all to false, then this one to true
															fields.forEach((_, i) => {
																setValue(`icas.${i}.isDefault`, i === index);
															});
														}}
													/>
												</div>

												{/* ICA Input */}
												<div className="flex-1">
													<Input
														errors={errorsFormSubmit}
														label=""
														placeholder=""
														register={register as any}
														name={`icas.${index}.ica`}
														className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-2 px-3"
														labelClassName="hidden"
														isRequired={false}
													/>
													{(errorsFormSubmit as any)?.icas?.[index]?.ica
														?.message && (
														<p className="mt-1 text-sm text-red-600">
															{
																(errorsFormSubmit as any).icas[index].ica
																	.message
															}
														</p>
													)}
												</div>

												{/* Remove Button */}
												<div className="flex items-center">
													<button
														type="button"
														onClick={() => {
															const isRemovingDefault = watch(
																`icas.${index}.isDefault`,
															);
															if (isRemovingDefault && fields.length > 1) {
																const newDefaultIndex = index === 0 ? 1 : 0;
																setValue(
																	`icas.${newDefaultIndex}.isDefault`,
																	true,
																);
															}
															remove(index);
														}}
														disabled={fields.length === 1}
														className={`rounded-full p-1 ${
															fields.length === 1
																? "text-gray-300 cursor-not-allowed"
																: "text-red-500 hover:bg-red-50 hover:text-red-700"
														}`}
													>
														<XMarkIcon className="w-5 h-5" />
													</button>
												</div>
											</div>
										))}

										{/* Add Button */}
										{fields.length < 4 && (
											<div>
												<button
													type="button"
													onClick={() => {
														append({ ica: "", isDefault: false });
													}}
													className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium py-2 transition-colors"
												>
													<PlusIcon className="w-4 h-4" />
													Add another ICA
												</button>
											</div>
										)}

										{/* General Error Message for ICAs array */}
										{(errorsFormSubmit?.icas as any)?.root?.message && (
											<p className="text-sm text-red-600">
												{(errorsFormSubmit.icas as any).root.message}
											</p>
										)}
										{(errorsFormSubmit?.icas as any)?.message && (
											<p className="text-sm text-red-600">
												{(errorsFormSubmit.icas as any).message}
											</p>
										)}
									</div>
									<div className="flex flex-col w-full col-span-2">
										<label className="text-left text-xs font-medium text-gray-500 block leading-6">
											Certificate File (.p12 or .pem)
											<span className="text-red-500 align-top">*</span>
										</label>
										<div className="w-full relative">
											<input
												type="file"
												accept=".p12, .pem"
												onChange={(e) => {
													setValue("keyFile", e.target.files?.[0] ?? null);
												}}
												className="hidden"
												ref={fileInputRef}
												id="file-upload"
											/>
											<label
												htmlFor="file-upload"
												className="relative flex items-center justify-center rounded-md px-4 text-gray-900 border ring-inset border-[#DFDFDF] placeholder:text-gray-400 sm:text-sm sm:leading-6 w-full disabled:opacity-50 cursor-pointer"
											>
												{watch("keyFile") ? (
													<div className="flex items-center flex-col gap-1 py-4 space-x-2">
														<div className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
															<span className="text-sm text-gray-700">
																{watch("keyFile")?.name}
															</span>
															<svg
																className="w-5 h-5 text-green-500"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
																/>
															</svg>
														</div>
													</div>
												) : (
													<div className="flex items-center flex-col gap-1 py-4 space-x-2">
														<span className="text-sm text-gray-500">
															Upload file
														</span>
														<ArrowUpTrayIcon className="w-5 h-5 text-gray-500 shrink-0" />
													</div>
												)}
											</label>
											{watch("keyFile") ? (
												<XMarkIcon
													className="absolute right-2 top-1/2 -translate-y-1/2 focus:outline-hidden hover:text-blue-600 disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-gray-50 w-5 h-5 text-gray-700 cursor-pointer"
													onClick={resetFile}
												/>
											) : null}
										</div>
										{errorsFormSubmit
											? errorsFormSubmit.keyFile && (
													<p className="mt-2 text-sm text-red-600">
														{errorsFormSubmit.keyFile?.message as string}
													</p>
												)
											: null}
									</div>
									<ConnectionBox isLoading={isLoading} />
									<div className="w-full flex items-center justify-end col-span-2">
										<Button
											type="button"
											color="transparent"
											className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-md mr-2 min-w-[100px] hover:bg-gray-50"
											onClick={() => {
												reset();
											}}
										>
											Cancel
										</Button>
										<Button
											type="button"
											color="transparent"
											className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-md mr-2 min-w-[100px] hover:bg-gray-50"
											onClick={() => {
												handleSaveWithModal(false);
											}}
										>
											Save
										</Button>
										<Button
											type="button"
											color="dark"
											className="px-4 py-2 text-sm font-medium text-white border-none bg-blue-600 rounded-md min-w-[100px] hover:bg-blue-700"
											onClick={() => {
												handleSaveWithModal(true);
											}}
											isLoading={false}
										>
											Save & Test
										</Button>
									</div>
								</div>
							</form>
						</div>
					</div>
				</div>

				{/* Confirmation Modal */}
				<Modal isOpen={showConfirmModal} onClose={closeModal} type="Warning">
					<div className="sm:flex sm:items-start">
						<div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
							<ExclamationTriangleIcon
								className="h-6 w-6 text-yellow-600"
								aria-hidden="true"
							/>
						</div>
						<div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
							<h3 className="text-lg font-semibold leading-6 text-gray-900">
								Enable Match Pro Integration?
							</h3>
							<div className="mt-2">
								<p className="text-sm text-gray-500">
									You've filled in all the integration settings but Match Pro is
									currently disabled. Would you like to enable Match Pro to save
									these settings and activate the integration?
								</p>
							</div>
						</div>
					</div>
					<div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
						<Button
							type="button"
							color="dark"
							className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
							onClick={handleConfirmEnableSwitch}
						>
							Yes, enable Match Pro
						</Button>
						<Button
							type="button"
							color="transparent"
							className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
							onClick={handleDisableMatchPro}
						>
							Disable Match Pro
						</Button>
					</div>
				</Modal>
			</div>

			{isProcessorOrchestrationEnabled && <StripeIntegration />}
		</>
	);
};

export default Integrations;
