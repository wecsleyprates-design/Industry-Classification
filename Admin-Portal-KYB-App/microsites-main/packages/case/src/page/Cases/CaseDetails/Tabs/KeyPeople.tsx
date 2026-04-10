import React, { useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useCustomToast, useGetCustomerUsers } from "@/hooks";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { usePermission } from "@/hooks/usePermission";
import { useSelectAssigneeUser } from "@/services/queries/case.query";
import { useAppContextStore } from "@/store/useAppContextStore";

import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { type KeyPeopleProps, type Person, PersonItem } from "@/ui/person-item";
import { Skeleton } from "@/ui/skeleton";

export const KeyPeople: React.FC<KeyPeopleProps> = ({ applicant, caseId }) => {
	const { customerId, moduleType } = useAppContextStore();
	const [searchTerm, setSearchTerm] = useState("");
	const { undoToast } = useCustomToast();

	const assigneeList = useGetCustomerUsers(customerId) ?? [];
	const canWriteAssignment = usePermission("case:write:assignment");

	const { caseData, refetchCaseData, caseIdQueryLoading } = useGetCaseDetails(
		{
			caseId,
			customerId,
		},
	);

	const {
		mutateAsync: patchSelectAssignedUser,
		isPending: updateAssigneeLoading,
	} = useSelectAssigneeUser();

	const assigneeId = caseData?.data?.assignee?.id ?? null;
	const filteredPeople = assigneeList.filter(
		(person) =>
			person.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
			person.id !== assigneeId,
	);

	const currentAssignee = assigneeList.find(
		(person) => person.id === assigneeId,
	);

	const undoChanges = async ({
		currentAssignee,
		updatedAssignee,
	}: {
		currentAssignee?: Person;
		updatedAssignee?: Person;
	}) => {
		toast.dismiss("undo-toast");
		let assignee;
		if (!currentAssignee && !updatedAssignee) assignee = null;
		else if (currentAssignee && updatedAssignee)
			assignee = currentAssignee?.id ?? null;
		else assignee = currentAssignee?.id ?? null;

		await patchSelectAssignedUser({
			caseId,
			customerId,
			body: { assignee },
		});

		await refetchCaseData();
	};

	const reAssignedMessage = (
		currentAssignee: Person,
		updatedAssignee: Person,
	) => (
		<div className="flex items-center justify-between w-full">
			<div className="min-w-60">
				<div className="pb-1 text-sm font-semibold text-gray-900">
					Case Re-Assigned
				</div>
				<div className="text-sm text-gray-500">
					The case has been re-assigned from
					<span className="font-semibold">
						{" "}
						{currentAssignee.name}
					</span>
					<span className="mx-1"> to </span>
					<span className="font-semibold">
						{updatedAssignee.name}
					</span>
					.
				</div>
			</div>
			<Button
				className="ml-4 text-white"
				onClick={async () => {
					await undoChanges({ currentAssignee, updatedAssignee });
				}}
			>
				Undo
			</Button>
		</div>
	);

	const assignedMessage = (updatedAssignee: Person) => (
		<div className="flex items-center justify-between w-full">
			<div className="min-w-60">
				<div className="pb-1 text-sm font-semibold text-gray-900">
					Case Assigned
				</div>
				<div className="text-sm text-gray-500">
					The case has been assigned to
					<span className="font-semibold">
						{" "}
						{updatedAssignee.name}
					</span>
				</div>
			</div>
			<Button
				className="ml-4 text-white"
				onClick={async () => {
					await undoChanges({});
				}}
			>
				Undo
			</Button>
		</div>
	);

	const unAssignedMessage = (currentAssignee: Person) => (
		<div className="flex items-center justify-between w-full">
			<div className="min-w-60">
				<div className="pb-1 text-sm font-semibold text-gray-900">
					Case Unassigned
				</div>
				<div className="text-sm text-gray-500">
					The case has been un-assigned
				</div>
			</div>
			<Button
				className="ml-4 text-white"
				onClick={async () => {
					await undoChanges({ currentAssignee });
				}}
			>
				Undo
			</Button>
		</div>
	);

	const patchAssignee = async (person: Person) => {
		const updatedAssignee = person; // store updatedAssignee

		await patchSelectAssignedUser({
			caseId,
			customerId,
			body: { assignee: person.id ?? null },
		});

		await refetchCaseData().then(() => {
			if (currentAssignee?.id) {
				if (updatedAssignee.id) {
					undoToast(
						reAssignedMessage(currentAssignee, updatedAssignee),
						{
							className: "w-30 h-10",
							toastId: "undo-toast",
						},
					);
				} else {
					undoToast(unAssignedMessage(currentAssignee), {
						className: "w-30 h-10",
						toastId: "undo-toast",
					});
				}
			} else {
				undoToast(assignedMessage(updatedAssignee), {
					className: "w-30 h-10",
					toastId: "undo-toast",
				});
			}
		});
	};
	return (
		<Card>
			<div className="px-6 py-4 space-y-4">
				<div className="flex flex-col md:flex-row md:divide-x md:divide-gray-200">
					<div className="w-full md:w-1/2">
						<p className="text-sm text-gray-500">Applicant(s)</p>
						<PersonItem person={applicant} role="Applicant" />
					</div>
					{moduleType !== "standalone_case" &&
						assigneeList.length > 0 && (
							<div className="w-full mt-4 md:px-6 md:w-1/2 md:mt-0">
								<p className="text-sm text-gray-500 ">
									Assigned to
								</p>
								<DropdownMenu.Root>
									{!updateAssigneeLoading &&
									!caseIdQueryLoading ? (
										<DropdownMenu.Trigger className="w-full">
											<div className="w-full space-y-2">
												{currentAssignee && (
													<PersonItem
														key={
															currentAssignee?.id
														}
														person={currentAssignee}
														role="Assigned to"
														showChevron={
															canWriteAssignment
														}
													/>
												)}
											</div>
										</DropdownMenu.Trigger>
									) : (
										<div className="flex flex-row items-start justify-between w-full mt-2 space-x-2">
											<Skeleton className="h-10 rounded-full min-w-10" />
											<Skeleton className="w-full h-10" />
										</div>
									)}
									{canWriteAssignment && (
										<DropdownMenu.Portal>
											<DropdownMenu.Content
												className="w-64 p-1 mt-1 bg-white border border-gray-300 shadow-lg rounded-xl"
												align="start"
												alignOffset={-25}
												avoidCollisions={false}
											>
												{filteredPeople.length > 0 ||
												!!searchTerm ? (
													<>
														{/* 🔍 Search bar */}
														<div className="relative px-4 py-2 mt-2">
															<span className="absolute inset-y-0 flex items-center pointer-events-none left-3">
																<MagnifyingGlassIcon className="px-4 ml-1 h-5 mt-0.5 text-black" />
															</span>
															<input
																type="text"
																placeholder="Search"
																value={
																	searchTerm
																}
																onChange={(
																	e,
																) => {
																	setSearchTerm(
																		e.target
																			.value,
																	);
																}}
																onKeyDown={(
																	e,
																) => {
																	e.stopPropagation();
																}}
																className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
															/>
														</div>
														{filteredPeople?.length >
														0 ? (
															<div className="overflow-auto max-h-60">
																{filteredPeople.map(
																	(
																		person,
																	) => (
																		<DropdownMenu.Item
																			key={
																				person.id
																			}
																			className="flex items-center px-4 py-2 rounded cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-0 focus:border-0"
																			onSelect={async () => {
																				await patchAssignee(
																					person,
																				);
																			}}
																		>
																			<PersonItem
																				person={
																					person
																				}
																				role="Assigned to"
																			/>
																		</DropdownMenu.Item>
																	),
																)}
															</div>
														) : (
															<div className="pt-3 pb-4 text-sm text-center text-gray-500">
																No assignee
																found
															</div>
														)}
													</>
												) : (
													<div className="px-3 py-4 text-sm text-center text-gray-500">
														No assignee found
													</div>
												)}
											</DropdownMenu.Content>
										</DropdownMenu.Portal>
									)}
								</DropdownMenu.Root>
							</div>
						)}
				</div>
			</div>
		</Card>
	);
};
