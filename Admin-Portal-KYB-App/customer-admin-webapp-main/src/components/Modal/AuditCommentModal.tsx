import React, { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import useCustomToast from "@/hooks/useCustomToast";
import { useUpdateCaseAuditTrailComment } from "@/services/queries/notification.query";
import Button from "../Button";
import FullPageLoader from "../Spinner/FullPageLoader";
import { TextArea } from "../TextArea";
import Modal from "./Modal";

interface IContentProps {
	open: boolean;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
	caseId: string;
	commentId: string;
	setCommentId: React.Dispatch<React.SetStateAction<string>>;
	resetData: () => void;
}

const AuditCommentModal: React.FC<IContentProps> = ({
	open,
	setOpen,
	caseId,
	commentId,
	setCommentId,
	resetData,
}) => {
	const { successHandler, errorHandler } = useCustomToast();
	const [comment, setComment] = useState("");
	const commentHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setComment(e.target.value);
	};
	const {
		mutateAsync: addCaseAuditTrailComment,
		data: CaseAuditTrailCommentData,
		error: CaseAuditTrailCommentError,
		isPending: caseAuditTrailCommentLoading,
	} = useUpdateCaseAuditTrailComment();

	const closeHandler = () => {
		setComment("");
		setCommentId("");
		resetData();
		setOpen(false);
	};

	// onSubmit Call the api to update case status and assign an assignee
	const onSubmit = async (comment: string) => {
		void addCaseAuditTrailComment({
			caseId,
			commentId,
			body: { comment },
		});
		closeHandler();
	};

	useEffect(() => {
		if (CaseAuditTrailCommentData)
			successHandler({ message: CaseAuditTrailCommentData.message });
	}, [CaseAuditTrailCommentData]);

	useEffect(() => {
		if (CaseAuditTrailCommentError) errorHandler(CaseAuditTrailCommentError);
	}, [CaseAuditTrailCommentError]);

	return (
		<>
			{!open ? (
				<FullPageLoader />
			) : (
				<>
					<Modal isOpen={open} onClose={closeHandler} cardColorClass="bg-white">
						<div className="p-4">
							Edit comment
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
							<TextArea
								id="about"
								name="about"
								rows={5}
								placeholder="Add your comment"
								icons={[]}
								className="textarea focus-visible:none"
								defaultValue={""}
								footerText="0/500 characters"
								onChange={commentHandler}
								value={comment}
							/>
						</div>
						<Button
							isLoading={caseAuditTrailCommentLoading}
							className="mt-3 text-sm h-14 bg-black w-full font-bold p-1.5 text-white shadow-sm focus-visible:outline"
							type="submit"
							onClick={() => {
								void onSubmit(comment ?? "");
							}}
						>
							Save
						</Button>
					</Modal>
				</>
			)}
		</>
	);
};

export default AuditCommentModal;
