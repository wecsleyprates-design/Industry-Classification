import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useCustomToast } from "@/hooks/useCustomToast";
import { usePermission } from "@/hooks/usePermission";
import {
	useCreateCaseAuditTrailComment,
	useSelectAssigneeUser,
	useUpdateCaseByCaseIdQuery,
} from "@/services/queries/case.query";
import type { CaseData, CaseStatus } from "@/types/case";
import type { UserData } from "@/types/users";
import { UpdateStatusDropdown } from "./UpdateStatusDropdown";
import { UserDropdown, type UserOption } from "./UserDropdown";

import { Button } from "@/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/ui/form";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";
import { Textarea } from "@/ui/textarea";

type FormData = {
	/** Optional: user may have assignee/comment permission but not status */
	statusCode?: string;
	/** Optional: empty when case is unassigned; user may only have comment permission */
	assigneeId?: string;
	comment: string;
};

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	status?: CaseStatus;
	statusOptions: CaseStatus[];
	customerUsers: UserData[];
	caseData?: CaseData;
};

const updateStatusFormSchema: yup.ObjectSchema<FormData> = yup.object().shape({
	statusCode: yup.string(), // optional: user may only have assignee/comment permission
	assigneeId: yup.string(), // optional: unassigned case uses ""; user may only add comment
	comment: yup.string().required().trim().min(1, "Comment is required"),
});

const UpdateStatusModal: React.FC<Props> = ({
	isOpen,
	onClose,
	onSuccess,
	status,
	statusOptions,
	customerUsers,
	caseData,
}) => {
	const { errorToast, successToast } = useCustomToast();

	const canWriteAssignment = usePermission("case:write:assignment");
	const canWriteStatus = usePermission("case:write:status");

	const { mutateAsync: updateCase, isPending: updateCasePending } =
		useUpdateCaseByCaseIdQuery();
	const { mutateAsync: selectAssignee, isPending: selectAssigneePending } =
		useSelectAssigneeUser();

	const {
		mutateAsync: createCaseAuditTrailComment,
		isPending: createCaseAuditTrailCommentPending,
	} = useCreateCaseAuditTrailComment();

	const userOptions: UserOption[] = customerUsers.map((user) => ({
		id: user.id,
		first_name: user.first_name,
		last_name: user.last_name,
	}));

	const currentAssignee = caseData?.assignee as unknown as UserData;

	const form = useForm<FormData>({
		defaultValues: {
			statusCode: status?.code,
			assigneeId: (caseData?.assignee as unknown as UserData)?.id ?? "",
			comment: "",
		},
		resolver: yupResolver(updateStatusFormSchema),
	});

	// Reset form values when modal opens or status changes
	useEffect(() => {
		if (isOpen && status) {
			form.reset({
				statusCode: status.code,
				assigneeId:
					(caseData?.assignee as unknown as UserData)?.id ?? "",
				comment: "",
			});
		}
	}, [isOpen, status, caseData?.assignee, form]);

	const selectedStatus = form.watch("statusCode");
	const selectedAssigneeId = form.watch("assigneeId");

	const handleClose = () => {
		form.reset();
		onClose();
	};

	const onSubmit = async (data: FormData) => {
		const newAssigneeValue =
			!data.assigneeId || data.assigneeId === "Unassigned"
				? null
				: data.assigneeId;
		const currentAssigneeId = currentAssignee?.id ?? null;
		const assigneeChanged = newAssigneeValue !== currentAssigneeId;

		try {
			const promises: Array<Promise<unknown>> = [];

			// Use re-assign endpoint for assignee changes (checks case:write:assignment only).
			// The main case PATCH can require case:write:status, so we never use it for assignee-only.
			if (canWriteAssignment && assigneeChanged) {
				promises.push(
					selectAssignee({
						customerId: caseData?.customer_id ?? "",
						caseId: caseData?.id ?? "",
						body: { assignee: newAssigneeValue },
					}),
				);
			}

			// Use main case PATCH only for status changes (requires case:write:status).
			if (canWriteStatus && data.statusCode) {
				promises.push(
					updateCase({
						customerId: caseData?.customer_id ?? "",
						caseId: caseData?.id ?? "",
						body: { status: data.statusCode },
					}),
				);
			}

			if (data.comment?.trim()) {
				promises.push(
					createCaseAuditTrailComment({
						caseId: caseData?.id ?? "",
						businessId: caseData?.business_id ?? "",
						comment: data.comment,
					}),
				);
			}

			await Promise.all(promises);

			successToast("Case updated successfully");
			onSuccess();
			handleClose();
		} catch (error) {
			errorToast(error);
		}
	};

	if (!status || !caseData) return null;

	return (
		<Modal open={isOpen} onOpenChange={handleClose}>
			<ModalContent className="gap-0 p-0 w-full min-w-[500px]">
				<ModalHeader
					onClose={handleClose}
					description="Edit Status"
					className="border-b border-gray-200"
					title="Edit Status"
				/>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)}>
						<ModalBody className="flex flex-col items-center w-full gap-4 px-4 py-6">
							<FormField
								control={form.control}
								name="statusCode"
								render={() => (
									<FormItem className="w-[450px]">
										<FormLabel className="text-sm font-normal">
											Status{" "}
											<span className="text-red-500">
												*
											</span>
										</FormLabel>
										<UpdateStatusDropdown
											status={
												statusOptions.find(
													(s) =>
														s.code ===
														selectedStatus,
												) ?? status
											}
											onSelect={(code) => {
												form.setValue(
													"statusCode",
													code,
												);
											}}
											statusOptions={statusOptions}
										/>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="assigneeId"
								render={() => (
									<FormItem className="w-[450px]">
										<FormLabel className="text-sm font-normal">
											Assignee
										</FormLabel>
										<UserDropdown
											selectedUser={
												userOptions.find(
													(u) =>
														u.id ===
														selectedAssigneeId,
												) ?? {
													id: "Unassigned",
													first_name: "Unassigned",
													last_name: "",
												}
											}
											userOptions={userOptions}
											onSelect={(id) => {
												form.setValue("assigneeId", id);
											}}
											disabled={!canWriteAssignment}
										/>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="comment"
								render={({ field }) => (
									<FormItem className="w-[450px]">
										<FormControl>
											<Textarea
												placeholder="Enter a comment"
												{...field}
												label="Comment"
												required
												maxLength={500}
												showCharacterCount={true}
												className="h-[100px] resize-none mb-1"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</ModalBody>
						<ModalFooter className="flex flex-row items-center justify-end p-4 border-t border-gray-200">
							<Button
								type="button"
								variant="outline"
								size="lg"
								onClick={handleClose}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								size="lg"
								disabled={
									!form.formState.isValid ||
									updateCasePending ||
									selectAssigneePending ||
									createCaseAuditTrailCommentPending
								}
							>
								Apply
							</Button>
						</ModalFooter>
					</form>
				</Form>
			</ModalContent>
		</Modal>
	);
};

export default UpdateStatusModal;
