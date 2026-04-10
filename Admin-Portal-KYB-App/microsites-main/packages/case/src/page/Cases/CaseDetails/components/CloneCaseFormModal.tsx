import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
	InformationCircleIcon,
	PencilSquareIcon,
	UsersIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { useFlags } from "launchdarkly-react-client-sdk";
import Spinner from "@/components/Spinner/Spinner";
import { useCustomToast } from "@/hooks/useCustomToast";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import { cloneBusinessDetailsSchema } from "@/lib/validation";
import {
	useCloneBusiness,
	useGetOnboardingSetup,
} from "@/services/queries/case.query";
import { useGetFactsKyb } from "@/services/queries/integration.query";
import { useGetCustomerOnboardingStages } from "@/services/queries/onboarding.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import type { CloneBusinessBody } from "@/types/case";
import {
	type GetOnboardingSetupResponseData,
	type Stage,
	type StageCode,
	type StageLabel,
	STAGES,
} from "@/types/onboarding";
import CountrySelectorDropdown from "./CountrySelectorDropdown";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { Button } from "@/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/ui/form";
import { Input } from "@/ui/input";
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
	caseId: string;
};

interface BusinessDetailsForm {
	businessName: string;
	dbaName?: string;
	tin: string;
	country: string;
	addressLine1: string;
	addressLine2?: string;
	city: string;
	state?: string;
	zip: string;
}

interface AdditionalSections {
	ownership: boolean;
	customFields: boolean;
}

export const CloneCaseFormModal: React.FC<Props> = ({
	isOpen,
	onClose,
	caseId,
}) => {
	const navigate = useNavigate();

	const { errorToast, successToast } = useCustomToast();

	const [additionalSectionsToClone, setAdditionalSectionsToClone] =
		useState<AdditionalSections>({
			ownership: true,
			customFields: true,
		});

	const { customerId } = useAppContextStore();

	const { mutateAsync: cloneBusiness, isPending: isLoadingCloneBusiness } =
		useCloneBusiness();

	const { caseData } = useGetCaseDetails({
		customerId,
		caseId: caseId ?? "",
	});

	const flags = useFlags();
	const isProxyFlag = flags[FEATURE_FLAGS.BEST_65_PROXY_FACT];

	const { data: factsKybData, isLoading: isLoadingFactsKyb } = useGetFactsKyb(
		caseData?.data?.business.id ?? "",
		isProxyFlag,
	);

	const { data: onboardingSetupData, isLoading: isLoadingOnboardingSetup } =
		useGetOnboardingSetup(customerId ?? "");

	const isInternationalizationEnabled = useMemo(() => {
		return onboardingSetupData?.data?.find(
			(e: GetOnboardingSetupResponseData) =>
				e.code === "international_business_setup",
		)?.is_enabled;
	}, [onboardingSetupData]);

	// sections that are currently supported for cloning
	const CLONABLE_SECTIONS = [
		{
			key: "ownership",
			stageCode: STAGES.OWNERSHIP.code,
			label: STAGES.OWNERSHIP.label,
			icon: <UsersIcon className="size-6 text-blue-600" />,
		},
		{
			key: "customFields",
			stageCode: STAGES.CUSTOM_FIELDS.code,
			label: STAGES.CUSTOM_FIELDS.label,
			icon: <PencilSquareIcon className="size-6 text-blue-600" />,
		},
	] as const;

	const { data: onboardingStagesData } = useGetCustomerOnboardingStages(
		customerId ?? "",
		{ setupType: "modify_pages_fields_setup" },
	);

	// sections that are enabled in the onboarding stages
	const enabledSections = useMemo(() => {
		const allowedSections: StageCode[] = [
			STAGES.OWNERSHIP.code,
			STAGES.CUSTOM_FIELDS.code,
			STAGES.BANKING.code,
			STAGES.ACCOUNTING.code,
			STAGES.PROCESSING_HISTORY.code,
			STAGES.BUSINESS_TAXES.code,
		] as const;
		const sections: StageLabel[] = [];
		onboardingStagesData?.data?.forEach((stage: Stage) => {
			if (
				allowedSections.includes(stage.stage_code) &&
				stage.is_enabled
			) {
				sections.push(stage.stage);
			}
		});
		return sections;
	}, [onboardingStagesData]);

	// clonable sections to display in the form toggle buttons
	const displayableCloneableSections = CLONABLE_SECTIONS.filter((section) =>
		enabledSections.includes(section.label),
	);

	// list of sections not cloned for the info banner message
	const sectionsNotClonedList = useMemo(() => {
		const cloneableSections: StageLabel[] = [
			STAGES.OWNERSHIP.label,
			STAGES.CUSTOM_FIELDS.label,
		];
		const sections = enabledSections.filter(
			(section) => !cloneableSections.includes(section),
		);

		if (!sections?.length) return null;
		if (sections.length === 1) {
			return <span className="font-semibold">{sections[0]}</span>;
		}
		if (sections.length === 2) {
			return (
				<>
					<span className="font-semibold">{sections[0]}</span> and{" "}
					<span className="font-semibold">{sections[1]}</span>
				</>
			);
		}
		return (
			<>
				{sections.slice(0, -1).map((item, idx) => (
					<React.Fragment key={item}>
						<span className="font-semibold">{item}</span>
						{idx < sections.length - 2 ? ", " : ", and "}
					</React.Fragment>
				))}
				<span className="font-semibold">
					{sections[sections.length - 1]}
				</span>
			</>
		);
	}, [enabledSections]);

	const form = useForm<BusinessDetailsForm>({
		defaultValues: {
			businessName: "",
			dbaName: "",
			tin: "",
			country: "",
			addressLine1: "",
			addressLine2: "",
			city: "",
			state: "",
			zip: "",
		},
		resolver: yupResolver(cloneBusinessDetailsSchema) as any,
		mode: "onChange",
	});

	const { isValid: isFormValid, isSubmitting } = form.formState;

	// Prefill the form with the case data and facts KYB data once the data is available
	useEffect(() => {
		if (caseData?.data && factsKybData?.data) {
			const dba =
				caseData.data.business_names?.find((name) => !name.is_primary)
					?.name ?? "";

			form.reset({
				businessName: caseData.data.business.name ?? "",
				dbaName: dba,
				tin: factsKybData.data.tin?.value ?? "",
				country: caseData.data.business.address_country ?? "",
				addressLine1: caseData.data.business.address_line_1 ?? "",
				addressLine2: caseData.data.business.address_line_2 ?? "",
				city: caseData.data.business.address_city ?? "",
				state: caseData.data.business.address_state ?? "",
				zip: caseData.data.business.address_postal_code ?? "",
			});
		}
	}, [caseData, factsKybData, form]);

	const handleFormSubmit = async (formData: BusinessDetailsForm) => {
		const businessId = caseData?.data?.business.id ?? "";
		if (!businessId) {
			errorToast("Business ID not found");
			return;
		}
		const {
			businessName,
			dbaName,
			tin,
			country,
			addressLine1,
			addressLine2,
			city,
			state,
			zip,
		} = formData;

		const businessDetailsPayload = {
			name: businessName,
			dba_name: dbaName,
			tin,
			address_line_1: addressLine1,
			address_line_2: addressLine2,
			address_city: city,
			address_state: state,
			address_postal_code: zip,
			address_country: country,
		};

		const finalPayload: CloneBusinessBody = {
			businessDetails: {
				...businessDetailsPayload,
			},
			sectionsToClone: {
				ownership: additionalSectionsToClone.ownership,
				customFields: additionalSectionsToClone.customFields,
			},
		};

		try {
			const response = await cloneBusiness({
				customerId,
				businessId,
				caseId,
				body: {
					...finalPayload,
				},
			});

			let newCaseId;
			if (response.status === "success") {
				newCaseId = response.data.caseId;
			}

			if (newCaseId) {
				navigate(`/cases/${newCaseId}/overview`);
				successToast("Business cloned successfully");
				onClose();
			}
		} catch {
			errorToast("Failed to clone business");
		}
	};

	const handleClose = () => {
		form.reset();
		onClose();
	};

	const isLoading =
		isLoadingFactsKyb ||
		isLoadingOnboardingSetup ||
		!caseData?.data ||
		!factsKybData?.data;

	if (isLoading) {
		return (
			<Modal open={isOpen} onOpenChange={handleClose}>
				<ModalContent className="p-0 w-full max-w-[660px] min-w-[660px] h-[610px] overflow-auto">
					<div className="flex justify-center items-center h-full">
						<Spinner type="lg" />
					</div>
				</ModalContent>
			</Modal>
		);
	}

	return (
		<Modal open={isOpen} onOpenChange={handleClose}>
			<ModalContent className="p-0 w-full max-w-[660px] min-w-[660px] h-[610px] overflow-auto">
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleFormSubmit)}>
						<ModalHeader
							onClose={onClose}
							className="border-b border-gray-200"
							description="Clone the case and business details to a new case"
							title="Clone Case to New Business"
						/>
						<ModalBody className="min-h-0 overflow-y-auto">
							<div className="mt-3 text-gray-800">
								<div className="px-6 py-2 text-base font-medium">
									Business Details
								</div>
								<div className="flex flex-col justify-center px-6 pt-2 pb-6">
									<div className="grid grid-cols-1 gap-4 md:grid-cols-1">
										<FormField
											control={form.control}
											name="businessName"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="Legal Business Name"
															required
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="dbaName"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="DBA"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="tin"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label={getTaxIdLabel(
																form.watch(
																	"country",
																),
																"formLabel",
															)}
															required
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
								</div>
								<div className="px-6 py-2 text-base font-medium">
									Location Address
								</div>
								<div className="flex flex-col justify-center px-6 pt-2 pb-6 space-y-4">
									<FormField
										control={form.control}
										name="country"
										render={() => (
											<FormItem>
												<FormLabel className="text-sm font-normal">
													Country{" "}
													<span className="text-red-500">
														*
													</span>
												</FormLabel>
												<CountrySelectorDropdown
													value={form.watch(
														"country",
													)}
													onSelect={(code) => {
														form.setValue(
															"country",
															code,
															{
																shouldDirty: true,
																shouldValidate: true,
																shouldTouch: true,
															},
														);
													}}
													disabled={
														!isInternationalizationEnabled
													}
												/>
												<FormMessage />
											</FormItem>
										)}
									/>
									<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
										<FormField
											control={form.control}
											name="addressLine1"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="Street Address"
															required
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="addressLine2"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="Apt/Suite/PO Box"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="city"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="City"
															required
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="state"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="State"
															required
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="zip"
											render={({ field }) => (
												<FormItem>
													<FormControl>
														<Input
															{...field}
															label="Zip"
															required
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
								</div>
								<div className="px-6 py-2 text-base font-medium">
									Other Sections
								</div>
								<div className="mx-6 mt-2 mb-6 space-y-4">
									<div className="p-3 border border-gray-200 rounded-lg space-y-2">
										{displayableCloneableSections.map(
											({ key, icon, label }) => (
												<div
													key={key}
													className="flex flex-row items-center justify-between"
												>
													<div className="flex items-center gap-2">
														<div className="flex flex-row items-center rounded-[8px] bg-blue-50 p-2">
															{icon}
														</div>
														<span className="text-sm font-medium">
															{label}
														</span>
													</div>
													<Toggle
														value={
															additionalSectionsToClone[
																key
															]
														}
														onChange={() => {
															setAdditionalSectionsToClone(
																(prev) => {
																	const currentValue =
																		prev[
																			key
																		];
																	return {
																		...prev,
																		[key]: !currentValue,
																	};
																},
															);
														}}
													/>
												</div>
											),
										)}
									</div>
									{sectionsNotClonedList && (
										<div className="flex flex-col bg-gray-100 p-4 rounded-lg gap-2">
											<div className="flex items-start">
												<span className="mr-2">
													<InformationCircleIcon className="size-6 text-gray-500" />
												</span>
												<div className="text-gray-500 text-xs flex items-center mb-2">
													<span>
														{sectionsNotClonedList}{" "}
														will not be cloned. All
														other fields not
														outlined above will be
														cloned to a new case and
														business and can be
														edited after the cloning
														process.
													</span>
												</div>
											</div>
										</div>
									)}
								</div>
							</div>
						</ModalBody>
						<ModalFooter className="flex flex-row items-center justify-end p-4 border-t border-gray-200">
							<Button
								variant="secondary"
								size="lg"
								type="button"
								className="bg-white border border-gray-200"
								onClick={handleClose}
							>
								Cancel
							</Button>
							<Button
								variant="default"
								size="lg"
								className="bg-blue-600 rounded-lg h-11 w-[120px]"
								type="submit"
								disabled={
									!isFormValid ||
									isLoadingCloneBusiness ||
									isSubmitting
								}
							>
								{isLoadingCloneBusiness || isSubmitting ? (
									<Spinner type="sm" />
								) : (
									"Clone Case"
								)}
							</Button>
						</ModalFooter>
					</form>
				</Form>
			</ModalContent>
		</Modal>
	);
};
