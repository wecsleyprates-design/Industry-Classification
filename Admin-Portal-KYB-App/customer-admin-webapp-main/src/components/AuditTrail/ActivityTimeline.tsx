import React, { type ChangeEvent, useEffect, useRef, useState } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import { CheckIcon } from "@heroicons/react/20/solid";
import { twMerge } from "tailwind-merge";
import AttachmentIcon from "@/assets/svg/AttachmentIcon";
import CloseIcon from "@/assets/svg/CloseICon";
import Button from "@/components/Button";
import { TextArea } from "@/components/TextArea";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate } from "@/lib/helper";
import { useAddCaseAuditTrailComment } from "@/services/queries/case.query";
import AuditCommentModal from "../Modal/AuditCommentModal";
import TableLoader from "../Spinner/TableLoader";
import HandlebarsComponent from "./HandlebarsComponent";
import "./AuditTrailTextArea.css";

interface Props {
	steps: Array<Record<string, any>>;
	inCase: boolean;
	fetchMoreData: () => void;
	pageEnd: boolean;
	title: string;
	caseId: string;
	businessId?: string;
	resetData: () => void;
}

const ActivityTimeline: React.FC<Props> = ({
	steps,
	fetchMoreData,
	inCase,
	pageEnd,
	title,
	caseId,
	businessId,
	resetData,
}) => {
	const [comment, setComment] = useState("");
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const { successHandler, errorHandler } = useCustomToast();
	const commentHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setComment(e.target.value);
	};
	const [open, setOpen] = useState(true);
	const [commentId, setCommentId] = useState("");
	const [file, setFile] = useState<File>();

	const {
		mutateAsync: addCaseAuditTrailComment,
		data: CaseAuditTrailCommentData,
		error: CaseAuditTrailCommentError,
		isPending: caseAuditTrailCommentLoading,
	} = useAddCaseAuditTrailComment();

	// Handles conditions when file is removed
	const handleFileRemove = () => {
		setFile(undefined);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleDivClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	// Handles conditions when file is uploaded
	const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const newFilesArray = e.target.files;
			setFile(newFilesArray[0]);
		}
	};

	useEffect(() => {
		if (CaseAuditTrailCommentData?.status === "success") {
			successHandler({ message: CaseAuditTrailCommentData?.message });
			setComment("");
			setFile(undefined);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			resetData();
		}
	}, [CaseAuditTrailCommentData]);

	useEffect(() => {
		if (CaseAuditTrailCommentError) {
			errorHandler(CaseAuditTrailCommentError);
			setComment("");
			setFile(undefined);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
			resetData();
		}
	}, [CaseAuditTrailCommentError]);

	return (
		<nav aria-label="Progress">
			<ol role="list" className="overflow-hidden">
				<InfiniteScroll
					dataLength={steps?.length}
					next={fetchMoreData}
					hasMore={!pageEnd}
					loader={
						<div className="flex justify-center py-2 tracking-tight">
							<TableLoader />
						</div>
					}
					height={steps.length ? 400 : 70}
				>
					{steps.map((step, stepIdx) => (
						<li
							key={step.id}
							className={twMerge(
								stepIdx !== steps.length - 1 ? "pb-10" : "",
								"relative",
							)}
						>
							{step.status === "complete" ? (
								<>
									{stepIdx !== steps.length - 1 ? (
										<div
											className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-1/4 bg-indigo-600"
											aria-hidden="true"
										/>
									) : null}
									<a className="relative flex items-start group">
										<span className="flex items-center h-2">
											<span className="relative z-10 flex items-center justify-center w-5 h-5 bg-indigo-600 rounded-full group-hover:bg-indigo-800">
												<CheckIcon
													className="w-5 h-5 text-white"
													aria-hidden="true"
												/>
											</span>
										</span>
										<span className="flex flex-col min-w-0 ml-4">
											<span className="text-sm text-gray-500">{step.time}</span>
										</span>
									</a>
								</>
							) : step.status === "commented" ? (
								<>
									{stepIdx !== steps.length - 1 ? (
										<div
											className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300"
											aria-hidden="true"
										/>
									) : null}
									<a className="relative flex items-start group">
										<span className="flex items-center h-9">
											<span className="relative z-10 flex items-center justify-center w-8 h-8 bg-indigo-600 rounded-full group-hover:bg-indigo-800">
												<img
													className="w-8 h-8 rounded-full bg-gray-50"
													src="/user.png"
													alt=""
												/>
											</span>
										</span>
										<div className="ml-3 py-2 px-0 mx-auto bg-gray-50 rounded-lg shadow-md border-2 border-[#CDD1E8]">
											<div className="md:flex">
												<span className="flex flex-col min-w-0 ml-3">
													<span className="mt-1 text-xs text-gray-500">
														{step.description}
													</span>
												</span>
											</div>
										</div>
									</a>
								</>
							) : step.status === "addComment" ? (
								<>
									{inCase && (
										<>
											{stepIdx !== steps.length - 1 ? (
												<div
													className="absolute left-4 top-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300"
													aria-hidden="true"
												/>
											) : null}
											<a className="relative flex items-start group">
												<span className="flex items-center h-9">
													<span className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full">
														<img
															className="w-8 h-8 rounded-full bg-gray-50"
															src="/user.png"
															alt=""
														/>
													</span>
												</span>
												<div className="relative flex flex-col w-full min-w-0 mt-1 ml-2 mr-3 textarea">
													<TextArea
														id="about"
														name="about"
														rows={5}
														placeholder="Add your comment..."
														icons={[]}
														className="textarea focus-visible:none"
														defaultValue={""}
														footerText="0/500 characters"
														onChange={commentHandler}
														value={comment}
													/>
													<div
														className="absolute z-10 cursor-pointer bottom-10 left-4"
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
													<Button
														disabled={caseAuditTrailCommentLoading}
														outline
														className="absolute z-10 h-10 shadow-sm right-2 bottom-8 focus-visible:outline"
														onClick={() => {
															if (comment || file)
																void addCaseAuditTrailComment({
																	caseId,
																	businessId: businessId ?? "",
																	comment,
																	file,
																});
														}}
													>
														Comment
													</Button>
												</div>
												{/* Display uploaded files */}
											</a>
											<ul className="mt-4 space-y-2 ml-7">
												{file && (
													<li className="flex items-center">
														<div className="flex items-center p-2 space-x-2 bg-gray-200 border rounded-md">
															<a
																target="_blank"
																rel="noopener noreferrer"
																className=""
															>
																{file.name}
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
												)}
											</ul>
										</>
									)}
								</>
							) : (
								step.status === "auditTrail" && (
									<>
										{stepIdx !== steps.length - 1 ? (
											<div
												className="absolute left-4 top-4 -ml-px mt-4 h-full w-0.5 bg-gray-300"
												aria-hidden="true"
											/>
										) : null}
										<div className="relative flex items-start">
											<span
												className="flex items-center h-9"
												aria-hidden="true"
											>
												<span className="rounded-full  items-center justify-center bg-white border-4 translate-x-[3px] border-white">
													<span className="relative z-10 flex items-center justify-center w-5 h-5 bg-white border-2 border-gray-300 rounded-full group-hover:border-gray-400">
														<span className="h-2.5 w-2.5 rounded-full bg-transparent bg-gray-300" />
													</span>
												</span>
											</span>
											<span className="flex flex-col min-w-0 mt-1 ml-4 text-sm">
												<span className="font-normal">
													<HandlebarsComponent
														templateStyle={step.description}
														templateVariables={step.templateVariables}
														hyperLinkVariable={step.toBeLinked}
														attachments={step.attachments}
													/>
												</span>

												<div className="flex flex-row justify-between text-xs text-gray-500">
													<p>
														{convertToLocalDate(
															step?.time,
															"MM-DD-YYYY - h:mmA",
														)}
													</p>
													{step.edit && inCase && (
														<div
															className="text-blue-600 cursor-pointer"
															onClick={() => {
																setCommentId(step.commentId);
																setOpen(true);
															}}
														>
															Edit
														</div>
													)}
												</div>
											</span>
										</div>
									</>
								)
							)}
						</li>
					))}
					{steps.length === 0 && (
						<div className="flex justify-center mt-8">No {title} found.</div>
					)}
				</InfiniteScroll>
			</ol>
			{open && commentId && (
				<AuditCommentModal
					open={open}
					setOpen={setOpen}
					caseId={caseId}
					commentId={commentId ?? ""}
					setCommentId={setCommentId}
					resetData={resetData}
				/>
			)}
		</nav>
	);
};

export default ActivityTimeline;
