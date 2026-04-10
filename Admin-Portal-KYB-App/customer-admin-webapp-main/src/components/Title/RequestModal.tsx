import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
	ArrowUpTrayIcon,
	DocumentTextIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { twMerge } from "tailwind-merge";
import useCustomToast from "@/hooks/useCustomToast";
import { getCurrentTimezone } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { RequestModalBodySchema } from "@/lib/validation";
import { useGetOwnerApplicant } from "@/services/queries/businesses.query";
import {
	useAdditionalInformationRequest,
	useGetCaseByIdQuery,
} from "@/services/queries/case.query";
import { useGetAllStagesForCustomer } from "@/services/queries/onboarding.query";
import { type StageName } from "@/types/onboarding";
import { type RequestModalBody } from "@/types/requestModal";
import Button from "../Button";
import { Input } from "../Input";
import Modal from "../Modal";
import TableLoader from "../Spinner/TableLoader";
import { TextArea } from "../TextArea";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	caseId: string;
};

type Choices = { val: any[] };
type SelectedChoices = Array<{ pageNumber: number; choice: Choices }>;

type Pages = {
	title: string;
	items: Array<{
		id: string;
		label: string;
		stage: string;
		priority_order: number;
	}>;
	code: string;
};

const RequestModal: React.FC<Props> = ({
	isOpen,
	onClose,
	onSuccess,
	caseId,
}) => {
	const customerId = getItem(LOCALSTORAGE.customerId) as string;
	// to stores the choices made by user in each page
	const [choice, setChoice] = useState<Choices>({
		val: [],
	});
	// to stores the selected choices for each page
	const [selectedChoices, setSelectedChoices] = useState<SelectedChoices>([]);
	const [pageNumber, setPageNumber] = useState<number>(1);
	const { handleSubmit, register, getValues, setValue, watch } =
		useForm<RequestModalBody>({
			defaultValues: {
				firstName: "",
				lastName: "",
				email: "",
				subjectLine: "",
				subjectBody: "",
				isOwnerApplicant: false,
			},
			resolver: yupResolver(RequestModalBodySchema) as any,
		});

	const {
		mutateAsync: callAdditionInformation,
		isPending: callAdditionInformationLoading,
	} = useAdditionalInformationRequest();

	const { data: getApplicantData, error: getApplicantError } =
		useGetCaseByIdQuery({
			customerId,
			caseId: caseId ?? "",
			params: { filter: { time_zone: getCurrentTimezone() } },
		});

	const { data: getOwnerApplicant } = useGetOwnerApplicant(
		getApplicantData?.data.business.id,
	);

	const { errorHandler } = useCustomToast();

	const { data: stages, isLoading: stagesLoading } =
		useGetAllStagesForCustomer(customerId);

	const [defaultPages, setDefaultPages] = useState<{
		title: string;
		code: string;
		items: StageName[];
	}>({
		title: "Your Default Application Pages",
		code: "default_pages",
		items: [],
	});
	const [additionalPages, setAdditionalPages] = useState<{
		title: string;
		code: string;
		items: StageName[];
	}>({
		title: "Additional Pages",
		code: "additional_pages",
		items: [],
	});

	const numberOfPages = useMemo(
		() =>
			Math.min(
				getOwnerApplicant?.data.business_has_owner_applicant ? 3 : 4,
				pageNumber + 1,
			),
		[pageNumber],
	);

	useEffect(() => {
		if (stages) {
			stages.data?.forEach((stage) => {
				if (stage.visibility && stage.visibility === "Hidden") {
					setAdditionalPages((prev) => ({
						...prev,
						items: prev.items.some((item) => item.id === stage.id)
							? prev.items
							: [...prev.items, stage],
					}));
				} else {
					setDefaultPages((prev) => ({
						...prev,
						items: prev.items.some((item) => item.id === stage.id)
							? prev.items
							: [...prev.items, stage],
					}));
				}
			});
		}
	}, [stages]);

	useEffect(() => {
		if (getOwnerApplicant?.data.business_has_owner_applicant) {
			setValue("isOwnerApplicant", true);
		}
	}, [getOwnerApplicant]);

	useEffect(() => {
		if (getApplicantError) errorHandler(getApplicantError);
	}, [getApplicantError]);

	// function to render the buttons for 2nd page
	const renderButtons = (pages: Pages) =>
		pages.items.map((page) => (
			<div
				key={page.id}
				className={`px-4 py-2 my-1 mr-2 text-sm h-[40px] rounded-full cursor-pointer ${
					choice?.val?.length &&
					choice?.val
						.find(
							(items: { code: string; list: any[] }) =>
								items.code === pages.code,
						)
						?.list.includes(page.label)
						? "border-blue-600 bg-blue-50 text-blue-600 border-2 "
						: "bg-white hover:bg-gray-50 text-black border-gray-200 border-[1px] "
				}`}
				onClick={() => {
					// to find the previous selected items from same page type
					const prevSelected = choice?.val?.find(
						(itemtype: { code: string; list: any[] }) =>
							itemtype?.code === pages.code,
					);
					// if not selected earlier other wise remove it
					let newItemType; // to store the new selected items and the previous selected items
					// if doest not include the page label then add it
					if (!prevSelected?.list.includes(page.label)) {
						newItemType = {
							code: pages.code,
							list: prevSelected?.list
								? [...prevSelected.list, page.label]
								: [page.label],
						};
					} else {
						// if includes the page label then remove it
						newItemType = {
							code: pages.code,
							list: prevSelected?.list
								? prevSelected.list.filter((ele: string) => ele !== page.label)
								: [],
						};
					}

					// if the newItemType has any items then add it to the choice
					if (newItemType.list.length)
						setChoice((prev) => {
							return {
								val: Object.keys(prev).length // is there any prev selected values from same page type
									? [
											...(prev?.val || []).filter(
												(prevType: any) => prevType.code !== pages.code,
											), // to exclude the previous selected items from same page type and to avoid duplicacies
											newItemType,
										]
									: [newItemType],
							};
						});
					// else empty newItemType
					else
						setChoice((prev) => {
							return {
								val: Object.keys(prev).length
									? (prev?.val || []).filter(
											(prevType: any) => prevType.code !== pages.code,
										)
									: [], // if there any prev selected values from same page type then exclude it and only include the items from other page types
							};
						});
				}}
			>
				<span className="text-sm font-medium text-[#212529]">{page.label}</span>
			</div>
		));

	const onSubmit = async (data: RequestModalBody) => {
		let selectedChoice: number[] = [];
		let stagesList: Array<{ code: string; list: string[] }> = [];

		selectedChoices.forEach((record) => {
			if (record.choice.val.length) {
				const { val } = record.choice;

				// Check if 'val' contains numerical values
				if (val.every((item) => typeof item === "number")) {
					selectedChoice = record.choice.val;
				}
				// Check if 'val' contains objects with a 'list' field
				else if (
					val.every((item) =>
						Object.prototype.hasOwnProperty.call(item, "list"),
					)
				) {
					stagesList = record.choice.val;
				}
			}
		});
		let documentsRequired = false;
		if (selectedChoice.includes(2)) {
			documentsRequired = true;
		}
		let mergedList: StageName[] = [];
		if (selectedChoice.includes(1)) {
			const stageNameList = stagesList.reduce<string[]>(
				(accumulator, stage) => {
					return accumulator.concat(stage.list); // Concatenate each list into the accumulator
				},
				[],
			);

			if (stages) {
				mergedList = stageNameList.map((record: string) => {
					const fullRecord = stages.data?.filter((item) => {
						return item.label === record;
					})?.[0];
					return {
						id: fullRecord.id,
						label: fullRecord.label,
						stage: fullRecord.stage,
						priority_order: fullRecord.priority_order,
					};
				});
			}
		}

		const payload: any = {
			stages: mergedList,
			documents_required: documentsRequired,
			subject: data.subjectLine,
			body: data.subjectBody,
		};

		if (!data.isOwnerApplicant) {
			payload.applicant = {
				first_name: data.firstName ?? "",
				last_name: data.lastName ?? "",
				email: data.email ?? "",
			};
		}

		void callAdditionInformation({
			customerId,
			caseId: caseId ?? "",
			payload,
		})
			.then(async () => {
				onSuccess();
			})
			.catch((error) => {
				errorHandler(error);
			});
	};

	// contains render components for each page
	const tabs = [
		{
			pageNumber: 1,
			render: (
				<div className="text-gray-800 border-b-2 border-gray-100">
					<div className="flex justify-start pt-5 ">
						<span className="px-6 text-base font-medium">
							What do you want the applicant to do ?
						</span>
					</div>
					<div className="grid grid-cols-1 px-6 pt-4 pb-6 text-sm gap-x-4 gap-y-3 md:gap-y-0 md:grid-cols-2 ">
						<div
							className={`h-[112px] flex flex-col items-center justify-between px-3 border-2 rounded-xl cursor-pointer ${
								choice.val.includes(1)
									? "border-blue-600 border-[4px] pt-[11px] pb-[10.5px]"
									: "border-gray-100 border-[1px] py-[14px]"
							}`}
							onClick={() => {
								setChoice((prev) => {
									const isPresent = prev.val.includes(1);
									return isPresent
										? {
												val: [],
											}
										: {
												val: [1],
											};
								});
								// Use below code for combined flow
								// setChoice((prev) => {
								// 	const isPresent = prev.val.includes(1);
								// 	return isPresent
								// 		? {
								// 				val: [
								// 					...prev.val.filter((val) => {
								// 						return val !== 1;
								// 					}),
								// 				],
								// 		  }
								// 		: {
								// 				val: [...prev.val, 1],
								// 		  };
								// });
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
								choice.val.includes(2)
									? "border-blue-600 border-[4px] pt-[11px] pb-[10.5px]"
									: "border-gray-100 border-[1px] py-[14px]"
							}`}
							onClick={() => {
								setChoice((prev) => {
									const isPresent = prev.val.includes(2);
									return isPresent
										? {
												val: [],
											}
										: {
												val: [2],
											};
								});
								// Use below code for combined flow
								// setChoice((prev) => {
								// 	const isPresent = prev.val.includes(2);
								// 	return isPresent
								// 		? {
								// 				val: [
								// 					...prev.val.filter((val) => {
								// 						return val !== 2;
								// 					}),
								// 				],
								// 		  }
								// 		: {
								// 				val: [...prev.val, 2],
								// 		  };
								// });
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
		},
		{
			pageNumber: 2,
			render: (
				<div className="text-gray-800 border-b-2 border-gray-100">
					{/* <div className="flex max-w-[612px] min-h-[72px] items-center justify-between px-2 py-4 mx-6 my-6 text-blue-600 border border-gray-200 rounded-xl">
						<div className="px-2">
							<ExclamationCircleIcon className="w-5 h-5 font-bold" />
						</div>
						<span className="flex-1 px-2 text-sm text-gray-800">
							You can review which questions and information is collected on
							each page by visiting your onboarding settings.
						</span>
						<span className="px-1 text-sm font-medium cursor-pointer whitespace-nowrap">
							View Setting
						</span>
					</div> */}
					<span className="flex justify-center px-2 m-4 font-medium sm:justify-start">
						What sections of the application would you like the applicant to
						fill out?
					</span>
					{stagesLoading ? (
						<div className="flex items-center justify-center h-20 ">
							<TableLoader />
						</div>
					) : (
						<>
							<div className="px-2 pb-2 m-4">
								<div className="pb-1">
									<h2 className="my-2 mb-2 text-xs font-medium text-gray-500 uppercase">
										Your Default Application Pages
									</h2>
									<div className="flex flex-wrap">
										{renderButtons(defaultPages)}
									</div>
								</div>
								<div className="pt-3">
									<h2 className="my-2 text-xs font-medium text-gray-500 uppercase">
										Additional Pages
									</h2>
									<div className="flex flex-wrap">
										{renderButtons(additionalPages)}
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			),
		},
		{
			pageNumber: 3,
			render: (
				<div className="mt-3 text-gray-800 border-b-2 border-gray-100">
					<div className="px-6 py-2 text-base font-medium ">
						Applicant Information
					</div>
					<div className="flex flex-col justify-center px-6 pt-2 pb-6">
						<div className="flex flex-row gap-6">
							<div className="w-full pb-4 ">
								<label className="text-xs font-normal text-gray-950">
									First Name
									<span className="text-red-500">*</span>
								</label>
								<Input
									label={""}
									type="text"
									placeholder={`Enter First Name`}
									register={register}
									name={"firstName"}
									className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
									labelClassName="text-xs font-normal text-gray-950"
								/>
							</div>
							<div className="w-full pb-4 ">
								<label className="text-xs font-normal text-gray-950">
									Last Name
									<span className="text-red-500">*</span>
								</label>
								<Input
									label={""}
									type="text"
									placeholder={`Enter Last Name`}
									register={register}
									name={"lastName"}
									className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
									labelClassName="text-xs font-normal text-gray-950"
								/>
							</div>
						</div>
						<div className="py-2 text-xs font-normal text-gray-950">
							Email
							<span className="text-red-500">*</span>
						</div>
						<div className="w-1/2 pr-3">
							<Input
								label={""}
								type="text"
								placeholder={`Enter Email`}
								register={register}
								name={"email"}
								className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
								labelClassName="text-xs font-normal text-gray-950"
							/>
						</div>
					</div>
				</div>
			),
		},
		{
			pageNumber: getOwnerApplicant?.data.business_has_owner_applicant ? 3 : 4,
			render: (
				<div className="mt-3 text-gray-800 border-b-2 border-gray-100">
					<div className="px-6 py-2 text-base font-medium ">
						Customize the request the applicant will receive.
					</div>
					<div className="px-6 text-sm text-gray-500">
						Being specific on what and why the applicant needs to provide more
						information will increase the speed and likelihood of the applicant
						completing the request.
					</div>
					<div className="flex flex-col justify-center px-6 pt-2 pb-6">
						<div className="w-full pb-4 ">
							<label className="text-xs font-normal text-gray-950">
								Subject Line
								<span className="text-red-500">*</span>
							</label>
							<Input
								label={""}
								type="text"
								placeholder={`Enter subject line`}
								register={register}
								name={"subjectLine"}
								className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
								labelClassName="text-xs font-normal text-gray-950"
							/>
						</div>
						<div className="py-2 text-xs font-normal text-gray-950">
							Email Body
							<span className="text-red-500">*</span>
						</div>
						<div className="w-full ">
							<TextArea
								type={"text"}
								placeholder={`Enter email body`}
								onChange={(e) => {
									setValue("subjectBody", e.target.value, {
										shouldValidate: true,
									});
								}}
								defaultValue={getValues("subjectBody")}
								name={"subjectBody"}
								id={"subjectBody"}
								className={
									"w-full rounded-md font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
								}
							/>
						</div>
					</div>
				</div>
			),
		},
	];

	if (getOwnerApplicant?.data.business_has_owner_applicant) {
		tabs.splice(2, 1);
	}
	// triggers when clicked next button
	const handleNext = async () => {
		if (pageNumber === 1 && !choice?.val.includes(1)) {
			setPageNumber(3);
		} else {
			setPageNumber(numberOfPages);
		}
		setSelectedChoices((prev) => {
			return [
				...prev.filter((page) => page.pageNumber !== pageNumber),
				{ pageNumber, choice },
			];
		});
	};

	// triggers when back button is presssed
	const handleBack = () => {
		// if back is pressed from page 3 and in page 1 "Upload Documents" is selected then skip back to page 1
		if (
			pageNumber === 3 &&
			!selectedChoices
				.find((pageChoice) => pageChoice.pageNumber === 1)
				?.choice?.val?.includes(1)
		) {
			setPageNumber(1);
		} else {
			setPageNumber(Math.max(1, pageNumber - 1));
		}
	};

	const handleDisabled: any = () => {
		if (pageNumber === 1 || pageNumber === 2) {
			return !choice?.val?.length;
		}

		if (pageNumber === 3) {
			if (getOwnerApplicant?.data.business_has_owner_applicant === false) {
				return !(
					!!watch("firstName") &&
					!!watch("lastName") &&
					!!watch("email")
				);
			} else {
				return !(!!watch("subjectBody") && !!watch("subjectLine"));
			}
		}

		if (pageNumber === 4) {
			return !(!!watch("subjectBody") && !!watch("subjectLine"));
		}

		return callAdditionInformationLoading;
	};

	// fetch the page filled data if filled earlier
	useEffect(() => {
		const existingChoices =
			selectedChoices.find((pages) => pages.pageNumber === pageNumber)?.choice
				?.val ?? [];
		setChoice({
			val: [...new Set(existingChoices)],
		});
	}, [pageNumber]);

	return (
		<>
			<form onSubmit={handleSubmit(onSubmit)}>
				<Modal
					isOpen={isOpen}
					onClose={() => {}}
					cardColorClass=""
					type="invite"
					customWidth="w-[692px] overflow-visible"
				>
					<div className="text-gray-800 bg-white sm:-my-8 rounded-2xl">
						<div className="flex justify-between items-center px-6 py-4 font-medium border-b-2 border-gray-100 h-[60px]">
							<span className="text-lg font-medium">Request More Info</span>
							<XMarkIcon className="w-6 h-6 cursor-pointer" onClick={onClose} />
						</div>
						{tabs.find((tab) => tab.pageNumber === pageNumber)?.render}
						<div className="flex justify-end py-4 px-6 pt-4 space-x-2 h-[76px] font-medium">
							<Button
								color="transparent"
								type="button"
								className={twMerge(
									`rounded-lg w-[80px] h-[44px] border border-gray-200 text-gray-500 text-sm font-medium`,
									pageNumber === 1 ? "bg-gray-100" : "bg-white",
								)}
								onClick={() => {
									if (pageNumber > 1) handleBack(); // this otherwise creates a unnoticable bug
								}}
								disabled={pageNumber === 1 || callAdditionInformationLoading}
								// disabled={activeTab === undefined}
							>
								Back
							</Button>
							<Button
								type="submit"
								color="dark"
								className={twMerge(
									`rounded-lg h-[44px] text-white text-sm gap-x-2 font-medium bg-gray-800 flex justify-center`,
									pageNumber ===
										(getOwnerApplicant?.data.business_has_owner_applicant
											? 3
											: 4)
										? "min-w-[130px]"
										: "min-w-[80px]",
								)}
								onClick={async () => {
									await handleNext();
									if (
										pageNumber ===
										(getOwnerApplicant?.data.business_has_owner_applicant
											? 3
											: 4)
									) {
										await handleSubmit(onSubmit)();
									}
								}}
								isLoading={callAdditionInformationLoading}
								disabled={handleDisabled()}
							>
								{pageNumber !==
								(getOwnerApplicant?.data.business_has_owner_applicant ? 3 : 4)
									? "Next"
									: "Send Request"}
							</Button>
						</div>
					</div>
				</Modal>
			</form>
		</>
	);
};

export default RequestModal;
