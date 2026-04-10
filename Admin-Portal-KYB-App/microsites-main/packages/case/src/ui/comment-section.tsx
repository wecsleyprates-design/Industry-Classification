import React, { type ChangeEvent, useEffect, useRef, useState } from "react";
import {
	PaperAirplaneIcon,
	PhotoIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomToast } from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { getInitials } from "@/lib/utils";
import { useCreateCaseAuditTrailComment } from "@/services/queries/case.query";
import { type ILoginResponseUserDetails } from "@/types/common";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/textarea";

interface CommentSectionProps {
	caseId: string;
	businessId?: string;
	onCommentPosted: () => void;
}

const CommentSection = ({
	caseId,
	businessId,
	onCommentPosted,
}: CommentSectionProps) => {
	const [comment, setComment] = useState("");
	const [file, setFile] = useState<File>();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const queryClient = useQueryClient();

	const { successToast, errorToast } = useCustomToast();
	const {
		mutateAsync: createCaseAuditTrailComment,
		data: createCaseAuditTrailCommentData,
		error: createCaseAuditTrailCommentError,
		isPending: createCaseAuditTrailCommentLoading,
		reset,
	} = useCreateCaseAuditTrailComment();

	const handleFileRemove = () => {
		setFile(undefined);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleFileIconClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const newFilesArray = e.target.files;
			setFile(newFilesArray[0]);
		}
	};

	const handleSubmitComment = () => {
		queryClient.removeQueries({
			queryKey: ["getAuditTrail", { businessID: businessId }],
		});
		if (comment.trim()) {
			void createCaseAuditTrailComment({
				caseId,
				businessId: businessId ?? "",
				comment,
				file,
			});
		}
	};

	useEffect(() => {
		if (createCaseAuditTrailCommentData?.status === "success") {
			successToast(createCaseAuditTrailCommentData?.message);
			setComment("");
			setFile(undefined);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			onCommentPosted();
			reset();
		}
	}, [createCaseAuditTrailCommentData, onCommentPosted, reset, successToast]);

	useEffect(() => {
		if (createCaseAuditTrailCommentError) {
			errorToast(createCaseAuditTrailCommentError);
			reset();
		}
	}, [createCaseAuditTrailCommentError, errorToast, reset]);

	const maxLength = 500;
	const userDetails: ILoginResponseUserDetails | null = getItem(
		LOCALSTORAGE.userDetails,
	);
	const userName =
		userDetails?.first_name && userDetails?.last_name
			? `${userDetails.first_name} ${userDetails.last_name}`
			: "";

	return (
		<div className="flex items-center space-x-4">
			<Avatar initials={getInitials(userName)} size="md" />
			<div className="flex-1 bg-white rounded-lg border border-gray-200 pt-[14px] pb-[6px] px-4">
				<div className="relative">
					<Textarea
						id="comment-textarea"
						name="comment-textarea"
						value={comment}
						onChange={(e) => {
							setComment(e.target.value);
						}}
						placeholder="Add a Comment..."
						maxLength={maxLength}
						className="w-full focus:ring-0 resize-none p-0 focus-visible:ring-0 shadow-none !border-none"
						rows={3}
					/>
				</div>
				{file && (
					<div className="mt-2">
						<div className="flex items-center justify-between p-2 text-sm bg-gray-100 rounded-md">
							<span className="truncate">{file.name}</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-fit p-1 border border-gray-400 rounded-md hover:bg-gray-200"
								onClick={handleFileRemove}
							>
								<XMarkIcon className="w-4 h-4" />
							</Button>
						</div>
					</div>
				)}
				<div className="flex justify-between items-end my-2">
					<span className="text-xs text-gray-500 p-1">
						{comment.length}/{maxLength}
					</span>
					<div className="flex items-end">
						<input
							type="file"
							ref={fileInputRef}
							onChange={handleFileUpload}
							style={{ display: "none" }}
						/>
						<Button
							variant="ghost"
							size="icon"
							className="h-fit p-1"
							onClick={handleFileIconClick}
							aria-label="Upload file"
						>
							<PhotoIcon className="w-5 h-5 text-gray-500" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-fit p-1"
							onClick={handleSubmitComment}
							disabled={
								createCaseAuditTrailCommentLoading ||
								!comment.trim()
							}
							aria-label="Submit comment"
						>
							<PaperAirplaneIcon className="w-5 h-5 text-gray-500" />
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CommentSection;
