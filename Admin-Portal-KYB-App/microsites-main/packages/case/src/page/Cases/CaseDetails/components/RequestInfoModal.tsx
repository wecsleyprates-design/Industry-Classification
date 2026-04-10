import React, { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowUpTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useCustomToast } from "@/hooks/useCustomToast";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetOwnerApplicant } from "@/services/queries/businesses.query";
import { useCreateAdditionalInformationRequest } from "@/services/queries/case.query";
import { useGetAllStagesForCustomer } from "@/services/queries/onboarding.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type StageName } from "@/types/onboarding";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import REGEX from "@/constants/Regex";
import { Button } from "@/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";
import { Textarea } from "@/ui/textarea";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	caseId: string;
};

type Step1Values = {
	updateInfo: boolean;
	uploadDocs: boolean;
};

type Step2Values = StageName[];

type SelectedValues = {
	1: Step1Values;
	2: Step2Values;
};

interface AdditionalInfoForm {
	subjectLine: string;
	subjectBody: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	mobile?: string;
}

const additionalInfoFormSchema = yup.object().shape({
	subjectLine: yup.string().required("Subject line is required"),
	subjectBody: yup.string().required("Subject body is required"),
});

export const RequestInfoModal: React.FC<Props> = ({
	isOpen,
	onClose,
	onSuccess,
	caseId,
}) => {
	const { errorToast, successToast } = useCustomToast();

	const { customerId } = useAppContextStore();

	const defaultValues: SelectedValues = {
		1: {
			updateInfo: false,
			uploadDocs: false,
		},
		2: [],
	};

	const [selectedValues, setSelectedValues] =
		useState<SelectedValues>(defaultValues);
	const [currentStepNumber, setCurrentStepNumber] = useState<number>(1);

	const form = useForm<AdditionalInfoForm>({
		defaultValues: {
			subjectLine: "",
			subjectBody: "",
			firstName: "",
			lastName: "",
			email: "",
			mobile: "",
		},
		resolver: yupResolver(additionalInfoFormSchema),
	});

	const { isValid: isFormValid } = form.formState;

	const {
		mutateAsync: createAdditionalInformationRequest,
		isPending: isAdditionInformationRequestLoading,
	} = useCreateAdditionalInformationRequest();

	const { data: stages, isLoading: stagesLoading } =
		useGetAllStagesForCustomer(customerId);

	const { caseData } = useGetCaseDetails({
		customerId,
		caseId: caseId ?? "",
	});
	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;
	const { data: ownerApplicant } = useGetOwnerApplicant(businessId);
	const needsApplicant =
		ownerApplicant?.data?.business_has_owner_applicant === false;

	const renderStagesOptions = useMemo(
		() => (stages: StageName[]) =>
			stages.map((stage) => {
				const selectedStages = selectedValues[2];
				const isSelected = selectedStages?.some(
					(selectedStage: StageName) => selectedStage.id === stage.id,
				);
				return (
					<div
						key={stage.id}
						className={`px-4 py-2 my-1 mr-2 text-sm h-[40px] rounded-full cursor-pointer ${
							isSelected
								? "border-blue-600 bg-blue-50 text-blue-600 border-2 "
								: "bg-white hover:bg-gray-50 text-black border-gray-200 border-[1px] "
						}`}
						onClick={() => {
							if (isSelected) {
								const newValues = selectedStages?.filter(
									(selectedStage: StageName) =>
										selectedStage.id !== stage.id,
								);
								setSelectedValues((prev) => ({
									...prev,
									2: newValues,
								}));
							} else {
								const newValues = [...selectedStages, stage];
								setSelectedValues((prev) => ({
									...prev,
									2: newValues,
								}));
							}
						}}
					>
						<span className="text-sm font-medium text-[#212529]">
							{stage.label}
						</span>
					</div>
				);
			}),
		[selectedValues],
	);

	const handleFormSubmit = async (data: AdditionalInfoForm) => {
		const { subjectLine, subjectBody, firstName, lastName, email, mobile } =
			data;
		const updateApplication = selectedValues[1].updateInfo;
		const documentsRequired = selectedValues[1].uploadDocs;
		const selectedStages = selectedValues[2];

		const formattedStages = selectedStages?.map((stage: StageName) => {
			return {
				id: stage.id,
				label: stage.label,
				stage: stage.stage,
				priority_order: stage.priority_order,
			};
		});

		try {
			await createAdditionalInformationRequest({
				customerId,
				caseId: caseId ?? "",
				body: {
					stages: updateApplication ? formattedStages : [],
					documents_required: documentsRequired,
					subject: subjectLine,
					body: subjectBody,
					...(needsApplicant
						? {
								applicant: {
									first_name: firstName ?? "",
									last_name: lastName ?? "",
									email: email ?? "",
									mobile: mobile ?? "",
								},
							}
						: {}),
				},
			});
			successToast("Additional information requested successfully");
			onSuccess();
		} catch (error) {
			errorToast(error);
		}
	};

	const stepsContent = {
		1: (
			<div className="text-gray-800">
				<div className="flex justify-start pt-5 ">
					<span className="px-6 text-base font-medium">
						What would you like the applicant to do?
					</span>
				</div>
				<div className="grid grid-cols-1 px-6 pt-4 pb-6 text-sm gap-x-4 gap-y-3 md:gap-y-0 md:grid-cols-2 ">
					<div
						className={`h-[112px] flex flex-col items-center justify-between px-3 border-2 rounded-xl cursor-pointer ${
							selectedValues[1].updateInfo
								? "border-blue-600 border-[4px] pt-[11px] pb-[10.5px]"
								: "border-gray-200 border-[1px] py-[14px]"
						}`}
						onClick={() => {
							setSelectedValues((prev) => ({
								...prev,
								1: {
									uploadDocs: false,
									updateInfo: !prev[1].updateInfo,
								},
							}));
						}}
					>
						<div
							className={`flex items-center justify-center w-[52px] h-[52px] bg-blue-100 rounded-full`}
						>
							<DocumentTextIcon className="w-6 h-6 text-blue-600" />
						</div>
						<span className="text-gray-950">
							Revise or Update Application
						</span>
					</div>
					<div
						className={`h-[112px] flex flex-col items-center justify-between px-3 border-2 rounded-xl cursor-pointer ${
							selectedValues[1].uploadDocs
								? "border-blue-600 border-[4px] pt-[11px] pb-[10.5px]"
								: "border-gray-200 border-[1px] py-[14px]"
						}`}
						onClick={() => {
							setSelectedValues((prev) => ({
								...prev,
								1: {
									updateInfo: false,
									uploadDocs: !prev[1].uploadDocs,
								},
							}));
						}}
					>
						<div
							className={`flex items-center justify-center w-[52px] h-[52px] bg-blue-100 rounded-full  `}
						>
							<ArrowUpTrayIcon className="w-6 h-6 text-blue-600" />
						</div>
						<span className="text-gray-950">Upload Documents</span>
					</div>
				</div>
			</div>
		),
		2: (
			<div className="text-gray-800">
				<span className="flex justify-center px-2 m-4 font-medium sm:justify-start">
					What sections of the application would you like the
					applicant to fill out?
				</span>
				{!stagesLoading && stages && (
					<>
						<div className="px-2 pb-2 m-4">
							<div className="pb-1">
								<h2 className="my-2 mb-2 text-xs font-medium text-gray-500 uppercase">
									Your Default Application Pages
								</h2>
								<div className="flex flex-wrap">
									{renderStagesOptions(
										stages?.data?.filter(
											(stage: StageName) =>
												stage.visibility === "Default",
										),
									)}
								</div>
							</div>
							<div className="pt-3">
								<h2 className="my-2 text-xs font-medium text-gray-500 uppercase">
									Additional Pages
								</h2>
								<div className="flex flex-wrap">
									{renderStagesOptions(
										stages?.data?.filter(
											(stage: StageName) =>
												stage.visibility === "Hidden",
										),
									)}
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		),
		3: (
			<div className="mt-3 text-gray-800">
				<div className="px-6 py-2 text-base font-medium">
					Applicant Information
				</div>
				<div className="flex flex-col justify-center px-6 pt-2 pb-6">
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FormField
							name="firstName"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											{...field}
											placeholder="Enter First Name"
											label="First Name"
											required
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							name="lastName"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											{...field}
											placeholder="Enter Last Name"
											label="Last Name"
											required
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<div className="mt-3">
						<FormField
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											{...field}
											placeholder="Enter Email"
											label="Email"
											required
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
			</div>
		),
		4: (
			<div className="mt-3 text-gray-800">
				<div className="px-6 py-2 text-base font-medium">
					Customize the request the applicant will receive.
				</div>
				<div className="px-6 pb-4 text-sm text-gray-500">
					Being specific on what and why the applicant needs to
					provide more information will increase the speed and
					likelihood of the applicant completing the request.
				</div>
				<div className="flex flex-col justify-center px-6 pt-2 pb-6">
					<div className="w-full pb-4">
						<FormField
							name="subjectLine"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Input
											{...field}
											type="text"
											placeholder="Enter subject line"
											className="w-full"
											label="Subject Line"
											required
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
					<div className="w-full">
						<FormField
							name="subjectBody"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<Textarea
											{...field}
											maxLength={500}
											placeholder="Enter email body"
											className="h-[100px] resize-none"
											label="Email Body"
											required
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</div>
			</div>
		),
	};

	const handleNext = () => {
		if (currentStepNumber === 1 && !selectedValues[1].updateInfo) {
			setCurrentStepNumber(3);
		} else {
			setCurrentStepNumber(Math.min(4, currentStepNumber + 1));
		}
	};

	const handleBack = () => {
		if (currentStepNumber === 3 && !selectedValues[1].updateInfo) {
			setCurrentStepNumber(1);
		} else {
			setCurrentStepNumber(Math.max(1, currentStepNumber - 1));
		}
	};

	const handleClose = () => {
		form.reset();
		setSelectedValues(defaultValues);
		setCurrentStepNumber(1);
		onClose();
	};

	const applicantValid = React.useMemo(() => {
		if (!needsApplicant) return true;
		const { firstName, lastName, email } = form.getValues();
		const okEmail = !!email && REGEX.EMAIL.test(email);
		return !!firstName && !!lastName && okEmail;
	}, [
		needsApplicant,
		form.watch("firstName"),
		form.watch("lastName"),
		form.watch("email"),
	]);

	const renderStep = () => {
		if (needsApplicant) {
			return stepsContent[currentStepNumber as keyof typeof stepsContent];
		}
		const key = (
			currentStepNumber === 3 ? 4 : currentStepNumber
		) as keyof typeof stepsContent;
		return stepsContent[key];
	};

	const isNextButtonDisabled = useMemo(() => {
		switch (currentStepNumber) {
			case 1:
				return (
					!selectedValues[1].updateInfo &&
					!selectedValues[1].uploadDocs
				);
			case 2:
				return !selectedValues[2].length;
			case 3:
				return needsApplicant && !applicantValid;
			default:
				return false;
		}
	}, [
		currentStepNumber,
		isFormValid,
		selectedValues,
		needsApplicant,
		applicantValid,
	]);

	return (
		<Modal open={isOpen} onOpenChange={handleClose}>
			<ModalContent className="p-0 min-w-[692px] gap-0">
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleFormSubmit)}>
						<ModalHeader
							onClose={onClose}
							className="border-b border-gray-200"
							description="Request additional information or documents from the applicant"
							title="Request More Information"
						/>
						<ModalBody>{renderStep()}</ModalBody>
						<ModalFooter className="flex flex-row items-center justify-end p-4 border-t border-gray-200">
							<Button
								variant="secondary"
								size="lg"
								type="button"
								className="bg-white border border-gray-200"
								onClick={handleBack}
								disabled={
									currentStepNumber === 1 ||
									isAdditionInformationRequestLoading
								}
							>
								Back
							</Button>
							{currentStepNumber === 4 ? (
								<Button
									variant="default"
									size="lg"
									className="bg-blue-600 rounded-lg h-11"
									type="submit"
									disabled={
										!isFormValid ||
										!applicantValid ||
										isAdditionInformationRequestLoading
									}
								>
									Send Request
								</Button>
							) : (
								<Button
									variant="default"
									size="lg"
									type="button"
									className="bg-blue-600 rounded-lg h-11"
									onClick={handleNext}
									disabled={isNextButtonDisabled}
								>
									Next
								</Button>
							)}
						</ModalFooter>
					</form>
				</Form>
			</ModalContent>
		</Modal>
	);
};
