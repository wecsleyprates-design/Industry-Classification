import { useRef, useState } from "react";
import {
	ArrowUpTrayIcon,
	ExclamationTriangleIcon,
	EyeIcon,
	EyeSlashIcon,
	InformationCircleIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import Input from "@/components/Input/Input";
import Modal from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import ReactCustomTooltip from "@/components/Tooltip/ReactCustomTooltip";
import { useIntegrationSettings } from "@/hooks/useIntegrationSettings";
import ConnectionBox from "./ConnectionBox";

const Match = () => {
	const [showKeyPassword, setShowKeyPassword] = useState(false);
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [pendingFormData, setPendingFormData] = useState<any>(null);

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
	} = useIntegrationSettings();

	const resetFile = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
			setValue("keyFile", null);
		}
	};

	// Modal handling functions
	const closeModal = () => {
		setShowConfirmModal(false);
		setPendingFormData(null);
	};

	const handleConfirmEnableSwitch = () => {
		if (pendingFormData) {
			const updatedFormData = { ...pendingFormData, isActive: true };
			setValue("isActive", true);

			if (pendingFormData.needsTest) {
				// This was from "Save & Test" button
				onSubmit(updatedFormData);
			} else {
				// This was from "Save" button
				onSubmit(updatedFormData);
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
			setPendingFormData(formData);
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
		<div className="bg-white w-full px-4 ml-4">
			<div className="flex items-start">
				<div className="flex flex-grow ml-4 flex-col">
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
										label="Key Password (Optional)"
										id="keyPassword"
										name="keyPassword"
										placeholder="Enter key password"
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
												<InformationCircleIcon className="w-4 black" />
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
												<EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
											)}
										</div>
									</Input>
								</div>
								<div className="w-full flex flex-col">
									<Input
										errors={errorsFormSubmit}
										label="ICA ID"
										id="acquirerId"
										name="acquirerId"
										placeholder="Enter acquirer id"
										register={register}
										className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
										labelClassName="text-xs font-medium text-gray-500"
										isRequired
									/>
								</div>
								<div className="flex flex-col w-full col-span-1">
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
											className="relative flex items-center justify-start rounded-md min-h-[46px] px-4 text-gray-900 border ring-inset border-[#DFDFDF] placeholder:text-gray-400 sm:text-sm sm:leading-6 w-full disabled:opacity-50 cursor-pointer"
										>
											{watch("keyFile") ? (
												<div className="flex items-center justify-between space-x-2 w-full">
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
												<div className="w-full flex justify-between space-x-2">
													<span className="text-sm text-gray-500">
														Upload file
													</span>
													<ArrowUpTrayIcon className="w-5 h-5 text-gray-500" />
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
	);
};

export default Match;
