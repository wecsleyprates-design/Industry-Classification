import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { isNil } from "@austinburns/type-guards";
import {
	ExclamationCircleIcon,
	XCircleIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import {
	backgroundImage,
	buttonColor,
	buttonText,
	customDomain,
	inviteEmail,
	logo,
	ProgressionBarImage,
	supportEmail,
	thankYouBodyMessage,
	thankYouMessageTitle,
	userAggrement,
	welcomePageBackgroundColor,
	welcomePageBackgroundImage,
} from "@/assets/png/BrandSetting";
import Button from "@/components/Button";
import { TitleLeftDivider } from "@/components/Dividers";
import { Input } from "@/components/Input";
import Modal, { WarningModal } from "@/components/Modal";
import { HexColorPicketPopOver } from "@/components/PopUpColorPicker/HexColorPicketPopOver";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import TipTapEditor from "@/components/WYSIWYG/TipTapEditor";
import useCustomToast from "@/hooks/useCustomToast";
import { getImageTypeAndData } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { CustomerBrandingSettingSchema } from "@/lib/validation";
import {
	useDeleteCustomerSettingFile,
	useGetCustomerSettingsById,
	useUpdateCustomerSettingQuery,
	useUploadCustomerSettingFile,
} from "@/services/queries/customer.query";
import { type CustomerBrandingSettingRequestBody } from "@/types/customer";

import { STORAGE_SIZE_IN_MB } from "@/constants/ConstantValues";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

const INFOTEXT = {
	subDomainDescription:
		"Customize your subdomain for your onboarding experience. When a custom domain isn’t set, your onboarding experience will be hosted using Worth’s standard format.",
	logoDescription:
		"Your logo will appear on the onboarding welcome screen, in the header throughout onboarding, and in the invite email. JPG, SVG, or PNG allowed. 10MB max image size. When a logo is not provided, your business name is displayed.",
	buttonColorDescription:
		"The button color is used throughout the entire onboarding experience and in the onboarding email invitation. When a button color is not set, the button color is blue.",
	buttonTextColorDescription:
		"The button text color is used throughout the entire onboarding experience. When a button text color is not set, the button text color is white.",
	onboardingInviteEmailDescription:
		"Customize the message of invite that customers receive to begin onboarding.",
	lightningVerifyEmailDescription:
		"Customize the message of invite that customers receive to verify their business information.",
	welcomePageBackgroundColorDescription:
		"The area opposite of the background image. This is where customers view a welcome message and begin their onboarding. When a background color is not set, the background color is white.",
	progressBarColorDescription:
		"The progress bar is present throughout onboarding after the welcome page. When a progress bar color is not set, the progress bar color is blue.",
	supportEmailDescription:
		"Provide the best contact information that can be shared with applicants.",
	thankYouMessageTitleDescription:
		"Customize the title of the page customers see after they successfully complete their onboarding.",
	thankYouMessageDescription:
		"Customize the message of the page customers see after they successfully complete their onboarding. This is displayed below the thank you message title.",
};

const formatPhoneNumber = (value: string): string => {
	// Remove non-digit characters
	const digits = value.replace(/\D/g, "");

	if (digits.length === 0) {
		return "";
	}
	if (digits.length <= 3) return `(${digits}`;
	if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
	return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const DesignAndBranding: React.FC = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { errorHandler, successHandler } = useCustomToast();
	const [showDefaultImageModal, setShowDefaultImageModal] = useState(false);
	const [dataSet, setDataSet] = useState(false);
	const [buttonvisible, setButtonvisible] = useState(false);
	const [isPrimaryCompanyLogoSvg, setIsPrimaryCompanyLogoSvg] =
		useState<string>("");
	const [isWelcomeBackgroundImageSvg, setIsWelcomeBackgroundImageSvg] =
		useState<string>("");

	const fileInputRefs = useRef<Array<HTMLInputElement | null>>([]);
	const [colors, setColors] = useState<string[]>([
		"#3E96FF",
		"#FFFFFF",
		"#FFFFFF",
		"#2563EB",
	]);

	const {
		register,
		handleSubmit,
		getValues,
		watch,
		setValue,
		setError,
		clearErrors,
		reset,
		formState: { isDirty, errors },
	} = useForm<CustomerBrandingSettingRequestBody>({
		defaultValues: {
			onboardingEmailBody:
				"You’ve been invited to complete an application for your business. Click below to get started.",
			onboardingEmailButtonText: "Get Started",
			lightningVerifyEmailButtonText: "Get Started",
			lightningVerifyEmailBody:
				"You’ve been invited to complete an application for your business. Click below to get started.",
			lightningVerifyEmailSubject:
				"Invitation to Verify Your Business Information",
		},
		resolver: yupResolver(CustomerBrandingSettingSchema),
	});

	const {
		data: preFilledSettingData,
		error: preFilledSettingError,
		isLoading,
		refetch: refetchPreFilledSettingData,
	} = useGetCustomerSettingsById(customerId ?? "");

	const {
		mutateAsync: updateCustomerSettingAsync,
		data: updateCustomerSettingData,
		error: updateCustomerSettingError,
		isPending: updateCustomerSettingLoading,
	} = useUpdateCustomerSettingQuery();

	const {
		mutateAsync: uploadCustomerSettingFileAsync,
		error: uploadCustomerSettingFileError,
		isPending: uploadCustomerSettingFileLoading,
	} = useUploadCustomerSettingFile();

	const {
		mutateAsync: deleteCustomerSettingFileAsync,
		error: deleteCustomerSettingFileError,
		isPending: deleteCustomerSettingFileLoading,
	} = useDeleteCustomerSettingFile();

	// Resets form with pre-filled data
	const resetForm = async (preFilledSettingData: any) => {
		let primaryLogoUrl = null;
		if (preFilledSettingData?.data?.settings?.primaryCompanyLogo) {
			const logoImage = await getImageTypeAndData(
				preFilledSettingData?.data?.settings?.primaryCompanyLogo,
			);
			primaryLogoUrl = logoImage.objectUrl;
			if (logoImage.svg) {
				setIsPrimaryCompanyLogoSvg(primaryLogoUrl);
			}
		}

		let welcomeBackgroundUrl = null;
		if (preFilledSettingData?.data?.settings?.welcomeBackgroundImage) {
			const logoImage = await getImageTypeAndData(
				preFilledSettingData?.data?.settings?.welcomeBackgroundImage,
			);
			welcomeBackgroundUrl = logoImage.objectUrl;
			if (logoImage.svg) {
				setIsWelcomeBackgroundImageSvg(welcomeBackgroundUrl);
			}
		}

		reset({
			...(preFilledSettingData?.data?.settings?.domain && {
				domain: String(preFilledSettingData?.data?.settings?.domain).endsWith(
					".joinworth.com",
				)
					? String(preFilledSettingData?.data?.settings?.domain)
					: String(preFilledSettingData?.data?.settings?.domain) +
						".joinworth.com",
			}),
			primaryCompanyLogo: primaryLogoUrl,
			buttonColor: preFilledSettingData?.data?.settings?.buttonColor,
			buttonTextColor: preFilledSettingData?.data?.settings?.buttonTextColor,
			onboardingEmailBody:
				preFilledSettingData?.data?.settings?.onboardingEmailBody,
			// onboardingEmailSubject:
			// 	preFilledSettingData?.data?.settings?.onboardingEmailSubject,
			lightningVerifyEmailBody:
				preFilledSettingData?.data?.settings?.lightningVerifyEmailBody,
			lightningVerifyEmailSubject:
				preFilledSettingData?.data?.settings?.lightningVerifyEmailSubject,
			onboardingEmailButtonText:
				preFilledSettingData?.data?.settings?.onboardingEmailButtonText,
			lightningVerifyEmailButtonText:
				preFilledSettingData?.data?.settings?.lightningVerifyEmailButtonText,
			welcomeBackgroundImage: welcomeBackgroundUrl,
			primaryBackgroundColor:
				preFilledSettingData?.data?.settings?.primaryBackgroundColor,
			progressBarColor: preFilledSettingData?.data?.settings?.progressBarColor,
			termsAndConditions:
				preFilledSettingData?.data?.settings?.termsAndConditions,
			privacyPolicyLink:
				preFilledSettingData?.data?.settings?.privacyPolicyLink,
			companySupportEmailAddress:
				preFilledSettingData?.data?.settings?.companySupportEmailAddress,
			companySupportPhoneNumber:
				preFilledSettingData?.data?.settings?.companySupportPhoneNumber,
			thankYouMessageTitle:
				preFilledSettingData?.data?.settings?.thankYouMessageTitle ?? "",
			thankYouMessageBodyText:
				preFilledSettingData?.data?.settings?.thankYouMessageBodyText ?? "",
		});
		const settingsToColorsMap: Record<string, number> = {
			buttonColor: 0,
			buttonTextColor: 1,
			primaryBackgroundColor: 2,
			progressBarColor: 3,
		};

		if (preFilledSettingData?.data?.settings) {
			const newColors = [...colors];

			Object.entries(settingsToColorsMap).forEach(([settingKey, index]) => {
				if (preFilledSettingData.data.settings[settingKey]) {
					newColors[index] = preFilledSettingData.data.settings[settingKey];
				}
			});
			setColors(newColors);
		}
	};

	const onSubmit = async (data: CustomerBrandingSettingRequestBody) => {
		if (!preFilledSettingData?.data?.domain) {
			errorHandler({ message: "Cannot update settings without domain " });
		} else {
			// Upload primary company logo
			if (
				typeof data.primaryCompanyLogo !== "string" &&
				data.primaryCompanyLogo
			) {
				await uploadCustomerSettingFileAsync({
					customerId: customerId ?? "",
					body: {
						file: data.primaryCompanyLogo,
						domain: String(preFilledSettingData?.data?.domain),
						type: "primaryCompanyLogo",
					},
				}).catch((e) => {});
			} else if (
				!data.primaryCompanyLogo &&
				preFilledSettingData?.data?.settings?.primaryCompanyLogo
			) {
				await deleteCustomerSettingFileAsync({
					customerId: customerId ?? "",
					body: {
						file_names: ["primaryCompanyLogo"],
					},
				}).catch((e) => {});
			}
			// Upload welcome background image
			if (
				typeof data.welcomeBackgroundImage !== "string" &&
				data.welcomeBackgroundImage
			) {
				await uploadCustomerSettingFileAsync({
					customerId: customerId ?? "",
					body: {
						file: data.welcomeBackgroundImage,
						domain: String(preFilledSettingData?.data?.domain),
						type: "welcomeBackgroundImage",
					},
				}).catch((e) => {});
			} else if (
				!data.welcomeBackgroundImage &&
				preFilledSettingData?.data?.settings?.welcomeBackgroundImage
			) {
				await deleteCustomerSettingFileAsync({
					customerId: customerId ?? "",
					body: {
						file_names: ["welcomeBackgroundImage"],
					},
				}).catch((e) => {});
			}
			// Upload remaining settings
			await updateCustomerSettingAsync({
				customerId: customerId ?? "",
				body: {
					primaryBackgroundColor: data.primaryBackgroundColor,
					buttonColor: data.buttonColor,
					buttonTextColor: data.buttonTextColor,
					// onboardingEmailSubject: data.onboardingEmailSubject,
					onboardingEmailBody: data.onboardingEmailBody,
					onboardingEmailButtonText: data.onboardingEmailButtonText,
					lightningVerifyEmailSubject: data.lightningVerifyEmailSubject,
					lightningVerifyEmailBody: data.lightningVerifyEmailBody,
					lightningVerifyEmailButtonText: data.lightningVerifyEmailButtonText,
					progressBarColor: data.progressBarColor,
					termsAndConditions: data.termsAndConditions,
					privacyPolicyLink: data.privacyPolicyLink,
					companySupportEmailAddress: data.companySupportEmailAddress,
					thankYouMessageTitle: data.thankYouMessageTitle,
					thankYouMessageBodyText: data.thankYouMessageBodyText,
					companySupportPhoneNumber: data.companySupportPhoneNumber,
					domain: String(preFilledSettingData?.data?.domain),
					customURL: String(data.domain) + ".joinworth.com",
				},
			}).then(async (e) => {
				await refetchPreFilledSettingData().then(async () => {
					await resetForm(e);
				});
			});
		}
	};

	const setRef = (el: HTMLInputElement | null, index: number) => {
		fileInputRefs.current[index] = el;
	};

	// Handles conditions when file is removed
	const handleFileRemove = (
		index: number,
		fieldName: keyof CustomerBrandingSettingRequestBody,
	) => {
		setValue(fieldName, undefined, { shouldDirty: true });

		const fileInput = fileInputRefs.current[index];
		if (fileInput?.value) {
			fileInput.value = "";
		}
	};

	const handleDivClick = (index: number) => {
		const fileInput = fileInputRefs.current[index];
		if (fileInput) {
			fileInput.click();
		}
	};

	const handleFileUpload = async (
		e: File,
		fieldName: keyof CustomerBrandingSettingRequestBody,
	) => {
		const validFileTypes = ["image/jpeg", "image/png", "image/svg+xml"];
		const validFileTypesExtension = ["jpeg", "jpg", "png", "svg", "svg+xml"];
		const maxSizeInBytes = 10 * STORAGE_SIZE_IN_MB; // 10 MB
		const file = e;
		const fileExtension = file.name.split(".").at(-1)?.toLowerCase(); // Extract and normalize the file extension

		if (
			!validFileTypes.includes(file.type) ||
			!fileExtension ||
			!validFileTypesExtension.includes(fileExtension)
		) {
			setError(fieldName, {
				message: "Incorrect format. Please upload a JPG, SVG, or PNG.",
			});
			return;
		} else {
			clearErrors(fieldName);
		}

		if (Number(file?.size) > maxSizeInBytes) {
			setError(fieldName, {
				message:
					"Image too large. Please upload an image that is less than 10MB.",
			});
			return;
		} else {
			clearErrors(fieldName);
		}

		setValue(fieldName, file, { shouldDirty: true });
		if (["svg", "svg+xml"].includes(fileExtension)) {
			const logoImage = await getImageTypeAndData(URL.createObjectURL(file));
			if (fieldName === "primaryCompanyLogo") {
				setIsPrimaryCompanyLogoSvg(logoImage.objectUrl);
			} else if (fieldName === "welcomeBackgroundImage") {
				setIsWelcomeBackgroundImageSvg(logoImage.objectUrl);
			}
		} else {
			if (fieldName === "primaryCompanyLogo") {
				setIsPrimaryCompanyLogoSvg("");
			} else if (fieldName === "welcomeBackgroundImage") {
				setIsWelcomeBackgroundImageSvg("");
			}
		}
	};

	const handleSupportPhoneNumberChange = (e: any) => {
		const formatted = formatPhoneNumber(e.target.value);
		setValue("companySupportPhoneNumber", formatted, {
			shouldValidate: true,
			shouldDirty: true,
		});
	};

	useEffect(() => {
		if (isDirty) {
			setButtonvisible(true);
		} else {
			setButtonvisible(false);
		}
	}, [isDirty]);

	useEffect(() => {
		if (preFilledSettingData?.data?.settings && !dataSet) {
			void (async () => {
				await resetForm(preFilledSettingData);
			})();
			setDataSet(true);
		}
	}, [preFilledSettingData]);

	useEffect(() => {
		if (updateCustomerSettingData?.status === "success") {
			successHandler({
				message: updateCustomerSettingData?.message as string,
			});
			void refetchPreFilledSettingData();
		}
	}, [updateCustomerSettingData]);

	useEffect(() => {
		if (updateCustomerSettingError) {
			errorHandler(updateCustomerSettingError);
		}
	}, [updateCustomerSettingError]);

	useEffect(() => {
		if (preFilledSettingError) {
			errorHandler(preFilledSettingError);
		}
	}, [preFilledSettingError]);

	useEffect(() => {
		if (uploadCustomerSettingFileError) {
			errorHandler(uploadCustomerSettingFileError);
		}
	}, [uploadCustomerSettingFileError]);

	useEffect(() => {
		if (deleteCustomerSettingFileError) {
			errorHandler(deleteCustomerSettingFileError);
		}
	}, [deleteCustomerSettingFileError]);

	useEffect(() => {
		setValue("buttonColor", colors[0], { shouldDirty: true });
		setValue("buttonTextColor", colors[1], { shouldDirty: true });
		setValue("primaryBackgroundColor", colors[2], { shouldDirty: true });
		setValue("progressBarColor", colors[3], { shouldDirty: true });
	}, [colors]);

	return (
		<>
			<form onSubmit={handleSubmit(onSubmit)}>
				{isLoading ||
				updateCustomerSettingLoading ||
				uploadCustomerSettingFileLoading ||
				deleteCustomerSettingFileLoading ||
				false ? (
					<FullPageLoader />
				) : (
					<div className="pb-16 mr-2  bg-white space-y-5 px-6 border rounded-2xl mt-8 sm:mr-0">
						<div className="pb-6">
							<div className="flex text-sm font-semibold truncate mt-7 sm:text-lg">
								Design & Branding
							</div>
							<div className="text-sm mt-2 text-gray-500">
								Customize your onboarding experience to match your branding and
								voice.
							</div>
						</div>
						{/* Custom Subdomain */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Custom Subdomain</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.subDomainDescription}
								</div>
								<div className="pt-2 text-xs font-normal">
									Onboarding Subdomain
								</div>
								<div className="flex items-center justify-between w-full h-12 max-w-md border rounded-lg">
									<input
										{...register("domain")}
										disabled
										className={twMerge(
											"w-full h-12 pl-2 text-[#9CA3AF] rounded-l-lg",
										)}
										placeholder="app.joinworth.com"
									/>
								</div>
								<div className="text-xs font-normal text-[#6B7280]">
									To customize or update your subdomain, please{" "}
									<a
										className="text-blue-600"
										href="https://worthai.com/contact-us/"
										target="_blank"
										rel="noopener noreferrer"
									>
										contact Worth.
									</a>
								</div>
								{errors?.domain && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.domain?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={customDomain}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Logo */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Logo</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.logoDescription}
								</div>
								{!watch("primaryCompanyLogo") ? (
									<div>
										<Button
											type="button"
											color="dark"
											className="mt-4 h-10 text-sm w-[88px] rounded-lg"
											onClick={() => {
												handleDivClick(0);
											}}
										>
											Upload
										</Button>

										<input
											type="file"
											onChange={async (e) => {
												const files = e.target.files;
												const file = files?.[0];
												if (isNil(file)) return;
												await handleFileUpload(file, "primaryCompanyLogo");
											}}
											ref={(el) => {
												setRef(el, 0);
											}}
											accept=".jpg,.jpeg,.png,.svg"
											style={{ display: "none" }}
										/>
									</div>
								) : (
									<div className="relative pt-4 w-fit">
										{getValues("primaryCompanyLogo") &&
										typeof getValues("primaryCompanyLogo") === "string" ? (
											isPrimaryCompanyLogoSvg ? (
												<div
													className="svg-container"
													dangerouslySetInnerHTML={{
														__html: isPrimaryCompanyLogoSvg,
													}}
												/>
											) : (
												<img
													className="h-auto w-auto max-h-[100px] border rounded-lg z-10"
													src={
														getValues("primaryCompanyLogo") as unknown as string
													}
													alt=""
												/>
											)
										) : isPrimaryCompanyLogoSvg ? (
											<div
												className="svg-container"
												dangerouslySetInnerHTML={{
													__html: isPrimaryCompanyLogoSvg,
												}}
											/>
										) : (
											<>
												<img
													className="h-auto w-auto max-h-[100px] border rounded-lg z-10"
													src={URL.createObjectURL(
														getValues("primaryCompanyLogo") as Blob,
													)}
													alt=""
												/>
											</>
										)}
										<div className="absolute top-0 right-0 z-20 pt-4 -mt-3 -mr-2">
											<XCircleIcon
												height={22}
												className="text-[#6B7280] bg-white rounded-full cursor-pointer "
												onClick={() => {
													handleFileRemove(0, "primaryCompanyLogo");
												}}
											/>
										</div>
									</div>
								)}
								{errors?.primaryCompanyLogo && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.primaryCompanyLogo?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img className="w-full sm:w-[449px] h-fit" src={logo} alt="" />
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Button Color */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Button Color</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.buttonColorDescription}
								</div>
								<div>
									<div className="relative mt-5">
										<input
											type="text"
											className="p-3 pl-10 text-sm font-medium border border-gray-200 rounded-lg w-28"
											value={
												colors[0].startsWith("#") ? colors[0] : `#${colors[0]}`
											}
											maxLength={7}
											onChange={(e) => {
												const valueWithoutHash = e.target.value.replace(
													/#/g,
													"",
												);
												setColors((prevColors) => {
													const updatedColors = [...prevColors];
													updatedColors[0] = `#${valueWithoutHash.slice(0, 6)}`;
													return updatedColors;
												});
											}}
										/>

										<HexColorPicketPopOver
											color={colors[0]}
											onChange={(e) => {
												setColors((prevColors) => {
													const updatedColors = [...prevColors];
													updatedColors[0] = String(e).slice(0, 7);
													return updatedColors;
												});
											}}
										/>
									</div>
								</div>

								{errors?.buttonColor && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.buttonColor?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={buttonColor}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Button Text Color */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Button Text Color</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.buttonTextColorDescription}
								</div>
								<div>
									<div className="relative mt-5">
										<input
											type="text"
											className="p-3 pl-10 text-sm font-medium border border-gray-200 rounded-lg w-28"
											value={
												colors[1].startsWith("#") ? colors[1] : `#${colors[1]}`
											}
											maxLength={7}
											onChange={(e) => {
												const valueWithoutHash = e.target.value.replace(
													/#/g,
													"",
												);
												setColors((prevColors) => {
													const updatedColors = [...prevColors];
													updatedColors[1] = `#${valueWithoutHash.slice(0, 6)}`;
													return updatedColors;
												});
											}}
										/>

										<HexColorPicketPopOver
											color={colors[1]}
											onChange={(e) => {
												setColors((prevColors) => {
													const updatedColors = [...prevColors];
													updatedColors[1] = String(e).slice(0, 7);
													return updatedColors;
												});
											}}
										/>
									</div>
								</div>

								{errors?.buttonTextColor && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.buttonTextColor?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={buttonText}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Onboarding Invite Email */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">
									Onboarding Invite Email
								</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.onboardingInviteEmailDescription}
								</div>
								<div className="pt-2 text-xs font-normal">Email Body</div>
								<div className="w-full lg:w-11/12">
									<TipTapEditor
										content={getValues("onboardingEmailBody") ?? ""}
										title="onboardingEmailBody"
										setValue={setValue}
										showLinks={true}
										showOrderedList={true}
										showUnOrderedList={true}
										onlyTitle={false}
										showCopyHtml={false}
										personalizeBtnOrientation="left"
										personalizeOptionsData={[]}
										showMenuBar={true}
									/>
									{/* "You’ve been invited to complete an application for your business. Click below to get started." */}
									{!watch("onboardingEmailBody") &&
										errors?.onboardingEmailBody && (
											<div className="flex flex-row items-center pt-2 gap-x-2">
												<ExclamationCircleIcon height={18} color="#dc2626" />
												<p className="text-sm font-semibold text-red-600 ">
													{errors.onboardingEmailBody?.message as string}
												</p>
											</div>
										)}
								</div>
								<Input
									label="Button Text"
									labelClassName="mt-2 text-xs font-normal pb-0"
									id="onboardingEmailButtonText"
									name="onboardingEmailButtonText"
									isRequired={true}
									placeholder="Button Text"
									register={register}
									className="w-full lg:w-11/12 border-[#DFDFDF]  h-12 pl-2 border ring-0 rounded-lg  mt-2.5 text-base font-normal text-[#5E5E5E] py-2.5 px-4"
								/>
								{errors?.onboardingEmailButtonText && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.onboardingEmailButtonText?.message as string}
										</p>
									</div>
								)}
								{/* <div className="mt-2 text-sm">
									Want to preview what your customers will see? Send Yourself a
									Test Email
								</div> */}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={inviteEmail}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* LightNing Verify Invite Email */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">
									Lightning Verify Invite Email
								</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.lightningVerifyEmailDescription}
								</div>
								<div className="w-full pt-2 lg:w-11/12">
									<Input
										label="Subject Line"
										labelClassName="mt-2 text-xs font-normal pb-0"
										id="lightningVerifyEmailSubject"
										name="lightningVerifyEmailSubject"
										isRequired={true}
										register={register}
										className="w-full lg:w-11/12 border-[#DFDFDF] h-12 pl-2 border ring-0 rounded-lg  mt-0 text-base font-normal text-[#5E5E5E] py-2.5 px-4"
									/>

									<div className="pt-6 text-xs font-normal">Email Body</div>

									<div className="w-full pt-1 lg:w-11/12">
										<TipTapEditor
											content={getValues("lightningVerifyEmailBody") ?? ""}
											title="lightningVerifyEmailBody"
											setValue={setValue}
											showLinks={true}
											showOrderedList={true}
											showUnOrderedList={true}
											onlyTitle={false}
											showCopyHtml={false}
											personalizeBtnOrientation="left"
											personalizeOptionsData={[]}
											showMenuBar={true}
										/>
										{!watch("lightningVerifyEmailBody") &&
											errors?.lightningVerifyEmailBody && (
												<div className="flex flex-row items-center pt-2 gap-x-2">
													<ExclamationCircleIcon height={18} color="#dc2626" />
													<p className="text-sm font-semibold text-red-600 ">
														{errors.lightningVerifyEmailBody?.message as string}
													</p>
												</div>
											)}
									</div>
									<Input
										label="Button Text"
										labelClassName="mt-5 text-xs font-normal pb-0"
										id="lightningVerifyEmailButtonText"
										name="lightningVerifyEmailButtonText"
										isRequired={true}
										placeholder="Button Text"
										register={register}
										className="w-full lg:w-11/12 border-[#DFDFDF]  h-12 pl-2 border ring-0 rounded-lg  mt-0 text-base font-normal text-[#5E5E5E] py-2.5 px-4"
									/>
									{errors?.lightningVerifyEmailButtonText && (
										<div className="flex flex-row items-center pt-2 gap-x-2">
											<ExclamationCircleIcon height={18} color="#dc2626" />
											<p className="text-sm font-semibold text-red-600 ">
												{
													errors.lightningVerifyEmailButtonText
														?.message as string
												}
											</p>
										</div>
									)}
									{/* <div className="mt-2 text-sm">
									Want to preview what your customers will see? Send Yourself a
									Test Email
								</div> */}
								</div>
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={inviteEmail}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Welcome Page Background Image */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">
									Welcome Page Background Image
								</div>
								<div className="text-sm text-[#6B7280] pr-10">
									The background image appears on the welcome screen and fills
									in half of the page. JPG, SVG, or PNG accepted. 10MB max image
									size. When a background image is not provided, the
									<span
										className="text-blue-600 cursor-pointer"
										onClick={() => {
											setShowDefaultImageModal(true);
										}}
									>
										{" "}
										default Worth image
									</span>{" "}
									is displayed.
								</div>
								{!watch("welcomeBackgroundImage") ? (
									<div>
										<Button
											type="button"
											color="dark"
											className="mt-4 h-10 text-sm w-[88px] rounded-lg"
											onClick={() => {
												handleDivClick(1);
											}}
										>
											Upload
										</Button>

										<input
											type="file"
											onChange={async (e) => {
												const files = e.target.files;
												const file = files?.[0];
												if (isNil(file)) return;
												await handleFileUpload(file, "welcomeBackgroundImage");
											}}
											ref={(el) => {
												setRef(el, 1);
											}}
											accept=".jpg,.jpeg,.png,.svg"
											style={{ display: "none" }}
										/>
									</div>
								) : (
									<div className="relative pt-4 w-fit">
										{getValues("welcomeBackgroundImage") &&
										typeof getValues("welcomeBackgroundImage") === "string" ? (
											isWelcomeBackgroundImageSvg ? (
												<div
													className="h-auto w-52"
													dangerouslySetInnerHTML={{
														__html: isWelcomeBackgroundImageSvg,
													}}
												/>
											) : (
												<img
													className="h-auto w-auto max-h-[100px] border rounded-lg z-10"
													src={
														getValues(
															"welcomeBackgroundImage",
														) as unknown as string
													}
													alt=""
												/>
											)
										) : isWelcomeBackgroundImageSvg ? (
											<div
												className="svg-container"
												dangerouslySetInnerHTML={{
													__html: isWelcomeBackgroundImageSvg,
												}}
											/>
										) : (
											<>
												<img
													className="h-auto w-auto max-h-[100px] border rounded-lg z-10"
													src={URL.createObjectURL(
														getValues("welcomeBackgroundImage") as Blob,
													)}
													alt=""
												/>
											</>
										)}
										<div className="absolute top-0 right-0 z-20 pt-4 -mt-3 -mr-2">
											<XCircleIcon
												height={22}
												className="text-[#6B7280] bg-white rounded-full cursor-pointer "
												onClick={() => {
													handleFileRemove(1, "welcomeBackgroundImage");
												}}
											/>
										</div>
									</div>
								)}
								{errors?.welcomeBackgroundImage && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.welcomeBackgroundImage?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={welcomePageBackgroundImage}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Welcome Page Background Color */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">
									Welcome Page Background Color
								</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.welcomePageBackgroundColorDescription}
								</div>
								<div>
									<div className="relative mt-5">
										<input
											type="text"
											className="p-3 pl-10 text-sm font-medium border border-gray-200 rounded-lg w-28"
											value={
												colors[2].startsWith("#") ? colors[2] : `#${colors[2]}`
											}
											maxLength={7}
											onChange={(e) => {
												const valueWithoutHash = e.target.value.replace(
													/#/g,
													"",
												);
												setColors((prevColors) => {
													const updatedColors = [...prevColors];
													updatedColors[2] = `#${valueWithoutHash.slice(0, 6)}`;
													return updatedColors;
												});
											}}
										/>
										<HexColorPicketPopOver
											color={colors[2]}
											onChange={(e) => {
												setColors((prevColors) => {
													const updatedColors = [...prevColors];
													updatedColors[2] = String(e).slice(0, 7);
													return updatedColors;
												});
											}}
										/>
									</div>
								</div>

								{errors?.primaryBackgroundColor && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.primaryBackgroundColor?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={welcomePageBackgroundColor}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Progression Bar Color */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Progress Bar Color</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.progressBarColorDescription}
								</div>
								<div>
									<div className="relative mt-4">
										<div className="relative mt-5">
											<input
												type="text"
												className="p-3 pl-10 text-sm font-medium border border-gray-200 rounded-lg w-28"
												value={
													colors[3].startsWith("#")
														? colors[3]
														: `#${colors[3]}`
												}
												maxLength={7}
												onChange={(e) => {
													const valueWithoutHash = e.target.value.replace(
														/#/g,
														"",
													);
													setColors((prevColors) => {
														const updatedColors = [...prevColors];
														updatedColors[3] = `#${valueWithoutHash.slice(
															0,
															6,
														)}`;
														return updatedColors;
													});
												}}
											/>
											<HexColorPicketPopOver
												color={colors[3]}
												onChange={(e) => {
													setColors((prevColors) => {
														const updatedColors = [...prevColors];
														updatedColors[3] = String(e).slice(0, 7);
														return updatedColors;
													});
												}}
											/>
										</div>
									</div>{" "}
								</div>

								{errors?.progressBarColor && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.progressBarColor?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={ProgressionBarImage}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Usage Agreements */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Usage Agreements</div>
								<div className="text-sm text-[#6B7280] pr-10">
									The Terms and Conditions and Privacy Policy are displayed on
									the welcome page prior to a customer beginning onboarding.
									When these are not provided, the{" "}
									<a
										className="text-blue-600"
										href="https://worthai.com/terms-2/"
										target="_blank"
										rel="noopener noreferrer"
									>
										Worth Terms & Conditions
									</a>{" "}
									and{" "}
									<a
										className="text-blue-600"
										href="https://worthai.com/privacy/"
										target="_blank"
										rel="noopener noreferrer"
									>
										Privacy Policy
									</a>{" "}
									are used.
								</div>
								<div className="pt-2 text-xs font-normal">
									Terms & Conditions Link
								</div>

								<input
									{...register("termsAndConditions")}
									className="w-full h-12 pl-2 border rounded-lg lg:w-11/12"
									id="termsAndConditions"
									name="termsAndConditions"
									placeholder="https://worthai.com/terms-2/"
								/>
								{errors?.termsAndConditions && (
									<div className="flex flex-row items-center gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.termsAndConditions?.message as string}
										</p>
									</div>
								)}
								<div className="pt-3 text-xs font-normal">
									Privacy Policy Link
								</div>
								<input
									{...register("privacyPolicyLink")}
									className="w-full h-12 pl-2 border rounded-lg lg:w-11/12"
									id="privacyPolicyLink"
									name="privacyPolicyLink"
									placeholder="www.example.com/privacy policy"
								/>
								{errors?.privacyPolicyLink && (
									<div className="flex flex-row items-center gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.privacyPolicyLink?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={userAggrement}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Customer Support */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Customer Support</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.supportEmailDescription}
								</div>
								<div className="pt-2 text-xs font-normal">
									Support Email Address
								</div>

								<input
									{...register("companySupportEmailAddress")}
									className="w-full h-12 pl-2 border rounded-lg lg:w-11/12 "
									id="companySupportEmailAddress"
									name="companySupportEmailAddress"
									placeholder="support@joinworth.com"
								/>
								{errors?.companySupportEmailAddress && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.companySupportEmailAddress?.message as string}
										</p>
									</div>
								)}
								<div className="pt-2 text-xs font-normal">
									Support Phone Number
								</div>
								<input
									{...register("companySupportPhoneNumber")}
									className="w-full h-12 pl-2 border rounded-lg lg:w-11/12 "
									id="companySupportPhoneNumber"
									onChange={handleSupportPhoneNumberChange}
									name="companySupportPhoneNumber"
									placeholder="(555) 555-5555"
								/>
								{errors?.companySupportPhoneNumber && (
									<div className="flex flex-row items-center pt-2 gap-x-2">
										<ExclamationCircleIcon height={18} color="#dc2626" />
										<p className="text-sm font-semibold text-red-600 ">
											{errors.companySupportPhoneNumber?.message as string}
										</p>
									</div>
								)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={supportEmail}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Thank You Message Title */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">
									Thank You Message Title
								</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.thankYouMessageTitleDescription}
								</div>
								<div className="w-full pt-4 lg:w-11/12">
									<TipTapEditor
										content={getValues("thankYouMessageTitle") ?? ""}
										title="thankYouMessageTitle"
										setValue={setValue}
										showLinks={true}
										showOrderedList={true}
										showUnOrderedList={true}
										onlyTitle={true}
										showCopyHtml={false}
										personalizeBtnOrientation="left"
										personalizeOptionsData={[]}
										showMenuBar={true}
										placeholder="Application submitted"
									/>
								</div>
								{!watch("thankYouMessageTitle") &&
									errors?.thankYouMessageTitle && (
										<div className="flex flex-row items-center pt-2 gap-x-2">
											<ExclamationCircleIcon height={18} color="#dc2626" />
											<p className="text-sm font-semibold text-red-600 ">
												{errors.thankYouMessageTitle?.message as string}
											</p>
										</div>
									)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={thankYouMessageTitle}
									alt=""
								/>
							</div>
						</div>
						<TitleLeftDivider text="" />
						{/* Thank You Message */}
						<div className="flex flex-col-reverse m-2 ml-0 border rounded-2xl sm:m-0 sm:border-0 sm:flex-row gap-x-5 lg:gap-x-0">
							<div className="w-full p-6 space-y-2 sm:w-7/12 sm:p-0">
								<div className="text-sm font-semibold">Thank You Message</div>
								<div className="text-sm text-[#6B7280] pr-10">
									{INFOTEXT.thankYouMessageDescription}
								</div>
								<div className="w-full pt-4 lg:w-11/12">
									<TipTapEditor
										content={getValues("thankYouMessageBodyText") ?? ""}
										title="thankYouMessageBodyText"
										setValue={setValue}
										showLinks={true}
										showOrderedList={true}
										showUnOrderedList={true}
										onlyTitle={false}
										showCopyHtml={false}
										personalizeBtnOrientation="left"
										personalizeOptionsData={[]}
										showMenuBar={true}
										placeholder="Thank you for taking your time to complete the application. We'll be in touch shortly."
									/>
								</div>
								{!watch("thankYouMessageBodyText") &&
									errors?.thankYouMessageBodyText && (
										<div className="flex flex-row items-center pt-2 gap-x-2">
											<ExclamationCircleIcon height={18} color="#dc2626" />
											<p className="text-sm font-semibold text-red-600 ">
												{errors.thankYouMessageBodyText?.message as string}
											</p>
										</div>
									)}
							</div>
							<div className="flex justify-end w-full sm:w-5/12">
								<img
									className="w-full sm:w-[449px] h-fit"
									src={thankYouBodyMessage}
									alt=""
								/>
							</div>
						</div>
					</div>
				)}

				{/* Footer Buttons */}

				<motion.div
					initial={{ y: "100%", opacity: 0 }}
					animate={{
						y: buttonvisible ? "0%" : "100%",
						opacity: buttonvisible ? 1 : 0,
					}}
					transition={{ duration: 0.5 }}
					className="fixed bottom-0 z-50 flex items-center justify-between w-full h-[72px] -ml-4 bg-white border-t border-[#E5E7EB] shadow-sm sm:-ml-8 shrink-0"
				>
					{" "}
					{/* <Button
					onClick={handleSubmit(onSubmit)}
					className="ml-2 mr-2 sm:my-0 sm:ml-8 sm:mr-0"
				>
					Preview
				</Button> */}
					<div></div>
					<div className="mr-2 space-x-2 sm:mr-10 lg:mr-80">
						<Button
							color="transparent"
							type="button"
							className="rounded-lg"
							onClick={async () => {
								await resetForm(preFilledSettingData);
							}}
							outline
						>
							Discard Changes
						</Button>
						<Button
							type="submit"
							color="dark"
							className="rounded-lg"
							onClick={() => {
								handleSubmit(onSubmit);
							}}
						>
							Save Changes
						</Button>
					</div>
				</motion.div>

				{/* Warning Modal */}
				<WarningModal
					type={"dark"}
					isOpen={false}
					onClose={() => {}}
					onSucess={() => {}}
					title={"Unsaved Changes"}
					description={"Do you want to save your changes?"}
					buttonText={"Save Changes"}
				/>

				{/** Default worth Image Modal */}

				<Modal
					isOpen={showDefaultImageModal}
					onClose={() => {
						setShowDefaultImageModal(false);
					}}
					cardColorClass="bg-white p-3 sm:p-3"
				>
					<div className="relative z-50 flex flex-col items-center">
						<button
							type="button"
							onClick={() => {
								setShowDefaultImageModal(false);
							}}
							className="absolute text-gray-500 rounded right-2.5 mt-1 hover:text-gray-700"
						>
							<XMarkIcon className="w-6 h-6" aria-hidden="true" />
						</button>
						<img
							className="w-full max-w-[449px] object-contain h-full py-9"
							src={backgroundImage}
							alt="default Worth image"
						/>
					</div>
				</Modal>
			</form>
		</>
	);
};

export default DesignAndBranding;
