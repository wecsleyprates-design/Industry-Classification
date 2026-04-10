import React, { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import queryString from "query-string";
import AttachmentIcon from "@/assets/svg/AttachmentIcon";
import CloseIcon from "@/assets/svg/CloseICon";
import useCustomToast from "@/hooks/useCustomToast";
import { capitalize, concatenate } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { statusUpdateSchema } from "@/lib/validation";
import {
	useAddCaseAuditTrailComment,
	useGetCaseStatuses,
	useUpdateCaseByCaseIdQuery,
} from "@/services/queries/case.query";
import { useGetUsers } from "@/services/queries/user.query";
import { type IStatusUpdateForm } from "@/types/case";
import { type TOption } from "@/types/common";
import Button from "../Button";
import CommonSelect from "../Dropdown/SelectMenu";
import FullPageLoader from "../Spinner/FullPageLoader";
import { TextArea } from "../TextArea";
import Modal from "./Modal";
import "./TextAreaStyle.css";

import { CASE_STATUS_ENUM } from "@/constants/CaseStatus";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface IContentProps {
	open: boolean;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
	caseID: string;
	businessId: string;
	userID: string;
	assignee: string;
	caseStatus: string;
	refetchCaseDetailsAPI: () => void;
	refetchRiskAlertsAPI?: () => void;
	setResetAuditTrail?: (value: boolean) => void;
}

const ManualReviewModal: React.FC<IContentProps> = ({
	open,
	setOpen,
	caseID,
	businessId,
	assignee,
	refetchCaseDetailsAPI,
	refetchRiskAlertsAPI,
	caseStatus,
	setResetAuditTrail,
}) => {
	const userID: string = getItem(LOCALSTORAGE.userId) ?? "";
	const userDetails: any = getItem(LOCALSTORAGE.userDetails);

	const { successHandler, errorHandler } = useCustomToast();
	const { data: caseStatusesResponse, isLoading: caseStatusLoading } =
		useGetCaseStatuses();
	const [caseTypes, setCaseTypes] = useState<any[]>([]);
	const [customerId] = useState(getItem("customerId") ?? "");
	const [customerUsers, setCustomerUsers] = useState<TOption[]>([]);
	const [comment, setComment] = useState("");
	const [file, setFile] = useState<File>();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	// Fetch all customer users
	const { data: customerUsersDataResponse, isLoading: customerUsersLoading } =
		useGetUsers(
			customerId,
			queryString.stringify({
				"filter[status][0]": "ACTIVE",
				pagination: false,
			}),
		);
	const {
		reset,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<IStatusUpdateForm>({
		resolver: yupResolver(statusUpdateSchema) as any,
	});

	const {
		mutateAsync: addCaseAuditTrail,
		data: CaseAuditTrailCommentData,
		error: CaseAuditTrailCommentError,
		isPending: caseAuditTrailCommentLoading,
	} = useAddCaseAuditTrailComment();

	const {
		mutateAsync: updateCaseApi,
		data: updateCaseData,
		error: updateCaseError,
		isPending: updateCaseLoading,
	} = useUpdateCaseByCaseIdQuery();

	const closeHandler = () => {
		reset({
			status: "",
			assignee: "",
		});
		setFile(undefined);
		setComment("");
		setOpen(false);
	};

	// Handles conditions when file is uploaded
	const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const newFilesArray = e.target.files;

			setFile(newFilesArray[0]);
		}
	};

	const handleDivClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};
	// Handles conditions when file is removed
	const handleFileRemove = () => {
		setFile(undefined);
	};

	// onSubmit Call the api to update case status and assign an assignee
	const onSubmit = async (data: IStatusUpdateForm) => {
		const { status, assignee } = data;
		if (comment || file)
			await addCaseAuditTrail({
				caseId: caseID,
				businessId: businessId ?? "",
				comment,
				file,
			});
		await updateCaseApi({
			body: {
				status,
				assignee,
			},
			caseID,
			customerID: customerId,
			caseId: caseID,
			customerId,
		});

		closeHandler();
	};

	useEffect(() => {
		if (updateCaseData?.status === "success") {
			successHandler(updateCaseData, () => {
				refetchCaseDetailsAPI();
				refetchRiskAlertsAPI?.();
				setResetAuditTrail?.(true);
			});
		}
	}, [updateCaseData]);

	useEffect(() => {
		if (CaseAuditTrailCommentData?.status === "success") {
			successHandler({ message: CaseAuditTrailCommentData?.message });
			setResetAuditTrail?.(true);
		}
	}, [CaseAuditTrailCommentData]);

	useEffect(() => {
		if (
			CaseAuditTrailCommentData?.status === "success" &&
			updateCaseData?.status === "success"
		)
			setOpen(false);
	}, [CaseAuditTrailCommentData, updateCaseData]);

	useEffect(() => {
		if (updateCaseError) {
			errorHandler(updateCaseError);
		}
	}, [updateCaseError]);

	useEffect(() => {
		if (CaseAuditTrailCommentError) {
			errorHandler(CaseAuditTrailCommentError);
		}
	}, [CaseAuditTrailCommentError]);

	useEffect(() => {
		// Create an array of Allowed editable case statuss
		if (caseStatusesResponse) {
			let allowedStatusesToBeListed = [
				CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
				CASE_STATUS_ENUM.INFORMATION_REQUESTED,
				CASE_STATUS_ENUM.MANUALLY_APPROVED,
			];
			if (caseStatus === CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
					CASE_STATUS_ENUM.INFORMATION_REQUESTED,
					CASE_STATUS_ENUM.MANUALLY_APPROVED,
					CASE_STATUS_ENUM.MANUALLY_REJECTED,
				];
			} else if (caseStatus === CASE_STATUS_ENUM.INFORMATION_REQUESTED) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.MANUALLY_APPROVED,
					CASE_STATUS_ENUM.MANUALLY_REJECTED,
					CASE_STATUS_ENUM.INFORMATION_REQUESTED,
				];
			} else if (caseStatus === CASE_STATUS_ENUM.MANUALLY_APPROVED) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
					CASE_STATUS_ENUM.INFORMATION_REQUESTED,
					CASE_STATUS_ENUM.MANUALLY_APPROVED,
					CASE_STATUS_ENUM.MANUALLY_REJECTED,
				];
			} else if (caseStatus === CASE_STATUS_ENUM.MANUALLY_REJECTED) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
					CASE_STATUS_ENUM.INFORMATION_REQUESTED,
					CASE_STATUS_ENUM.MANUALLY_APPROVED,
					CASE_STATUS_ENUM.MANUALLY_REJECTED,
				];
			} else if (caseStatus === CASE_STATUS_ENUM.RISK_ALERT) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.INVESTIGATING,
					CASE_STATUS_ENUM.DISMISSED,
					CASE_STATUS_ENUM.ESCALATED,
				];
			} else if (caseStatus === CASE_STATUS_ENUM.INVESTIGATING) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.DISMISSED,
					CASE_STATUS_ENUM.ESCALATED,
				];
			} else if (caseStatus === CASE_STATUS_ENUM.ESCALATED) {
				allowedStatusesToBeListed = [
					CASE_STATUS_ENUM.INVESTIGATING,
					CASE_STATUS_ENUM.DISMISSED,
				];
			}

			const caseResponseData = caseStatusesResponse.data.reduce(
				(
					acc: any[],
					item: { id: number; label: string; code: CASE_STATUS_ENUM },
				) => {
					if (allowedStatusesToBeListed.includes(item.code)) {
						acc.push({
							label: capitalize(item.label),
							value: item.code,
						});
					}
					return acc;
				},
				[],
			);
			setCaseTypes(caseResponseData);
		}

		// If customer users exists then dynamically create array of customerUsers taht would later be used to fill up filter dropdown
		if (customerUsersDataResponse) {
			const customerUsersData = customerUsersDataResponse.data.records.reduce(
				(
					acc: TOption[],
					item: { id: string; first_name: string; last_name: string },
				) => {
					if (item.id !== userID) {
						acc.push({
							label: concatenate([item.first_name, item.last_name]) || "-",
							value: item.id,
						});
					}
					return acc;
				},
				[
					{
						label: "Me",
						value: userID,
					},
				],
			);

			setCustomerUsers(customerUsersData);
		}
	}, [customerUsersDataResponse, caseStatusesResponse]);

	useEffect(() => {
		if (updateCaseError) {
			errorHandler(updateCaseError);
		}
	}, [updateCaseError]);

	useEffect(() => {
		const name =
			String(userDetails.first_name) + " " + String(userDetails.last_name);
		let assigneeId: string = customerUsers.find(
			(item) => item.label === assignee,
		)?.value as string;
		if (!assigneeId) {
			if (assignee === name) assigneeId = userID;
		}
		reset({
			status: caseStatus,
			assignee: assigneeId,
		});
	}, [userID, caseStatus, assignee]);

	return (
		<>
			{caseStatusLoading || customerUsersLoading ? (
				<FullPageLoader />
			) : (
				<>
					<Modal isOpen={open} onClose={closeHandler} cardColorClass="bg-white">
						<div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
							<button
								type="button"
								className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
								onClick={() => {
									setOpen(false);
								}}
							>
								<span className="sr-only">Close</span>
								<XMarkIcon className="w-6 h-6" aria-hidden="true" />
							</button>
						</div>
						<form
							className="px-4 py-2 space-y-2 sm:p-6"
							action="#"
							method="PATCH"
							onSubmit={handleSubmit(onSubmit)}
						>
							<div className="mt-2 text-2xl leading-9 tracking-tight text-gray-900">
								<p className="font-bold text-[24px] sm:text-[24px] text-[#333]">
									Edit status
								</p>
								<p className="mt-1 text-[15px] font-normal text-gray-400 tracking-wide">
									Please update status.
								</p>
							</div>

							<div className="mt-10">
								<CommonSelect
									label="Status"
									isRequired={true}
									options={caseTypes}
									uniqueId="status"
									placeholder={
										capitalize(caseStatus.replaceAll("_", " ")) ??
										"Select status..."
									}
									error={errors?.status?.message as string}
									shortHeight={caseTypes.length > 2}
									onChange={function (option: TOption): void {
										if (option.value) {
											setValue("status", option?.value as string);
										}
									}}
								/>
							</div>

							{
								// For previous cases where UMR and IR were present
								[
									CASE_STATUS_ENUM.UNDER_MANUAL_REVIEW,
									CASE_STATUS_ENUM.INFORMATION_REQUESTED,
								].find((item) => item === caseStatus) ? (
									<div className="mt-10">
										<CommonSelect
											label="Assignee"
											options={customerUsers}
											uniqueId="assignee"
											placeholder={assignee.length ? assignee : "Assign to..."}
											error={errors?.assignee?.message as string}
											onChange={function (option: TOption): void {
												if (option.value) {
													setValue("assignee", option?.value as string);
												}
											}}
											shortHeight={customerUsers.length > 3}
										/>
									</div>
								) : [
										CASE_STATUS_ENUM.RISK_ALERT,
										CASE_STATUS_ENUM.INVESTIGATING,
										CASE_STATUS_ENUM.ESCALATED,
								  ].find((item) => item === caseStatus) &&
								  (watch("status") === CASE_STATUS_ENUM.ESCALATED ||
										watch("status") === CASE_STATUS_ENUM.INVESTIGATING) ? (
									<div className="mt-10">
										<CommonSelect
											label="Assignee"
											options={customerUsers}
											uniqueId="assignee"
											isRequired={
												watch("status") === CASE_STATUS_ENUM.ESCALATED ||
												watch("status") === CASE_STATUS_ENUM.INVESTIGATING
											}
											placeholder={assignee.length ? assignee : "Assign to..."}
											error={errors?.assignee?.message as string}
											onChange={function (option: TOption): void {
												if (option.value) {
													setValue("assignee", option?.value as string);
												}
											}}
											shortHeight={customerUsers.length > 3}
										/>
									</div>
								) : null
							}
							{/* Display text area to add comment and upload document */}
							<span className="relative flex flex-col w-full min-w-0 textarea">
								<TextArea
									id="about"
									name="about"
									rows={5}
									placeholder="Add your comment"
									icons={[]}
									className=" textarea focus-visible:none"
									defaultValue={""}
									footerText="0/500 characters"
									onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
										setComment(e.target.value);
									}}
									value={comment}
								/>
								<div
									className="absolute cursor-pointer bottom-10 left-4"
									onClick={handleDivClick}
								>
									<AttachmentIcon key={"attachmentIcon"} />
								</div>
								<input
									type="file"
									onChange={handleFileUpload}
									ref={fileInputRef}
									style={{ display: "none" }}
								/>
							</span>
							{/* Display uploaded files */}
							{file && (
								<ul className="mt-4 space-y-2">
									<li className="flex items-center">
										<div className="flex items-center p-2 space-x-2 bg-gray-200 border rounded-md">
											<a target="_blank" rel="noopener noreferrer" className="">
												{file?.name}
											</a>
											<Button
												color="transparent"
												outline
												onClick={() => {
													handleFileRemove();
												}}
												className="px-1 py-1 ml-2"
											>
												<CloseIcon />
											</Button>
										</div>
									</li>
								</ul>
							)}
							<div>
								<Button
									type="submit"
									className="mt-3 text-sm h-14 bg-black w-full font-bold p-1.5 text-white shadow-sm focus-visible:outline"
									isLoading={caseAuditTrailCommentLoading || updateCaseLoading}
								>
									Save
								</Button>
							</div>
						</form>
					</Modal>
				</>
			)}
		</>
	);
};

export default ManualReviewModal;
