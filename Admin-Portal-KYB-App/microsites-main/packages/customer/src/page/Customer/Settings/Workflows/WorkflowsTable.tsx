import React, { useCallback, useMemo, useState } from "react";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import TableLoader from "@/components/Spinner/TableLoader";
import TableHeader from "@/components/Table/TableHeader";
import type { column } from "@/components/Table/types";
import { WorkflowStatusBadge } from "@/components/WorkflowStatusBadge";
import { useCustomToast } from "@/hooks";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { useUpdateWorkflowPriority } from "@/services/queries/workflows.query";
import type { Workflow } from "@/types/workflows";
import WorkflowActionsMenu from "./WorkflowActionsMenu";

import {
	formatVersionDisplay,
	getWorkflowCreatorDisplayName,
} from "@/helpers/workflows";

interface WorkflowsTableProps {
	workflows: Workflow[];
	customerId: string;
	isLoading: boolean;
	onEditWorkflow: (workflowId: string) => void;
	onToggleStatus: (workflowId: string, status: boolean) => void;
	onDeleteWorkflow: (workflow: Workflow) => void;
}

const WorkflowsTable: React.FC<WorkflowsTableProps> = ({
	workflows,
	customerId,
	isLoading,
	onEditWorkflow,
	onToggleStatus,
	onDeleteWorkflow,
}) => {
	const [draggedWorkflowId, setDraggedWorkflowId] = useState<string | null>(
		null,
	);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const { mutateAsync: updatePriority } = useUpdateWorkflowPriority();
	const { successToast, errorToast } = useCustomToast();
	const { canWrite } = useWorkflowPermissions();

	const columns: column[] = useMemo(
		() => [
			{
				title: "Workflows",
				path: "name",
				// Content will be rendered manually in the table body for drag & drop support
				content: undefined,
			},
			{
				title: "Priority",
				path: "priority",
				content: (item: Workflow) => (
					<span className="text-sm text-[#1F2937]">{item.priority}</span>
				),
			},
			{
				title: "Cases",
				path: "cases",
				content: (item: Workflow) => (
					<span className="text-sm text-[#1F2937]">{item.cases}</span>
				),
			},
			{
				title: "Version",
				path: "version",
				content: (item: Workflow) => {
					const versionDisplay = formatVersionDisplay(
						item.published_version,
						item.draft_version,
					);
					const isEditingVersion = !!versionDisplay.editing;

					return (
						<div className="flex flex-col">
							<span className="text-sm text-[#1F2937]">
								{versionDisplay.current}
								{isEditingVersion && <> → {versionDisplay.editing}</>}
							</span>
							{isEditingVersion && (
								<a
									href="#"
									onClick={(e) => {
										e.preventDefault();
										onEditWorkflow(item.id);
									}}
									className={
										canWrite
											? "text-xs text-blue-600 hover:text-blue-700 hover:underline"
											: "text-xs text-gray-500 hover:text-gray-600 hover:underline"
									}
								>
									{canWrite ? "(Editing)" : "(View Draft)"}
								</a>
							)}
						</div>
					);
				},
			},
			{
				title: "Status",
				path: "status",
				content: (item: Workflow) => (
					<WorkflowStatusBadge status={item.status} />
				),
			},
			{
				title: "Created by",
				path: "created_by",
				content: (item: Workflow) => {
					const displayName = getWorkflowCreatorDisplayName(item);
					return (
						<span className="text-sm text-[#1F2937]" title={item.created_by}>
							{displayName}
						</span>
					);
				},
			},
			{
				title: "Actions",
				path: "actions",
				content: (item: Workflow) => (
					<WorkflowActionsMenu
						workflow={item}
						customerId={customerId}
						onEditWorkflow={onEditWorkflow}
						onToggleStatus={onToggleStatus}
						onDeleteWorkflow={onDeleteWorkflow}
					/>
				),
			},
		],
		[customerId, onEditWorkflow, onToggleStatus, onDeleteWorkflow],
	);

	// Check if an element is part of the actions dropdown
	const isActionsElement = useCallback(
		(element: HTMLElement | null): boolean => {
			if (!element) return false;
			// Check for actions button, dropdown menu, or actions cell
			const actionsButton = element.closest('button[aria-label*="Actions"]');
			const dropdownMenu = element.closest('[role="menu"]');
			const menuItem = element.closest('[role="menuitem"]');
			const actionsCell = element.closest("td[data-actions-cell]");

			return (
				actionsButton !== null ||
				dropdownMenu !== null ||
				menuItem !== null ||
				actionsCell !== null
			);
		},
		[],
	);

	// Helper: Check if drag operation should be blocked
	const shouldBlockDrag = useCallback(
		(target: HTMLElement | null): boolean => {
			return !canWrite || isActionsElement(target);
		},
		[canWrite, isActionsElement],
	);

	// Helper: Check if drag over should be blocked
	const shouldBlockDragOver = useCallback(
		(target: HTMLElement | null, hasDraggedWorkflow: boolean): boolean => {
			return !canWrite || isActionsElement(target) || !hasDraggedWorkflow;
		},
		[canWrite, isActionsElement],
	);

	const handleDragStart = useCallback(
		(e: React.DragEvent, workflowId: string) => {
			// Don't start drag if user can't write or clicking on actions button
			if (shouldBlockDrag(e.target as HTMLElement)) {
				e.preventDefault();
				return;
			}
			setDraggedWorkflowId(workflowId);
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.dropEffect = "move";
			// Add visual feedback
			if (e.currentTarget instanceof HTMLElement) {
				e.currentTarget.style.opacity = "0.5";
			}
		},
		[shouldBlockDrag],
	);

	const handleDragEnd = useCallback((e: React.DragEvent) => {
		setDraggedWorkflowId(null);
		setDragOverIndex(null);
		// Reset visual feedback
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "1";
		}
	}, []);

	const handleDragOver = useCallback(
		(e: React.DragEvent, index: number) => {
			// Don't handle drag over if user can't write, on actions elements, or if no drag is in progress
			if (shouldBlockDragOver(e.target as HTMLElement, !!draggedWorkflowId)) {
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = "move";
			setDragOverIndex(index);
		},
		[shouldBlockDragOver, draggedWorkflowId],
	);

	const handleDrop = useCallback(
		async (e: React.DragEvent, targetIndex: number) => {
			// Don't handle drop if user can't write or on actions elements
			if (shouldBlockDrag(e.target as HTMLElement)) {
				return;
			}
			e.preventDefault();
			setDragOverIndex(null);

			if (!draggedWorkflowId) return;

			const draggedIndex = workflows.findIndex(
				(w) => w.id === draggedWorkflowId,
			);
			if (draggedIndex === -1 || draggedIndex === targetIndex) {
				setDraggedWorkflowId(null);
				return;
			}

			// Calculate new priority based on target position
			// Priority starts at 1, so targetIndex + 1 is the new priority
			// Backend will automatically reorder other workflows
			const newPriority = targetIndex + 1;

			try {
				await updatePriority({
					workflowId: draggedWorkflowId,
					priority: newPriority,
				});
				successToast("Workflow priority updated successfully");
			} catch (error) {
				errorToast(error);
			} finally {
				setDraggedWorkflowId(null);
			}
		},
		[
			draggedWorkflowId,
			workflows,
			updatePriority,
			successToast,
			errorToast,
			shouldBlockDrag,
		],
	);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		// Only clear drag over if we're actually leaving the row
		// This prevents flickering when moving between child elements
		const relatedTarget = e.relatedTarget as HTMLElement;
		if (!e.currentTarget.contains(relatedTarget)) {
			setDragOverIndex(null);
		}
	}, []);

	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-full text-left divide-y divide-gray-200">
				<TableHeader
					columns={columns}
					sortHandler={() => {}}
					payload={{}}
					tableHeaderClassname="text-gray-500 text-xs font-semibold"
				/>
				<tbody>
					{isLoading ? (
						<tr className="text-center">
							<td colSpan={columns.length} className="text-center">
								<h6
									className="my-2 text-base font-medium text-center text-red-500"
									style={{ display: "flex", justifyContent: "center" }}
								>
									<TableLoader />
								</h6>
							</td>
						</tr>
					) : workflows.length === 0 ? (
						<tr className="text-center">
							<td colSpan={columns.length} className="text-center">
								<h6 className="my-2 text-base font-medium text-center text-red-500">
									No records found!
								</h6>
							</td>
						</tr>
					) : (
						workflows.map((item, index) => {
							const isDragging = draggedWorkflowId === item.id;
							const isDragOver = dragOverIndex === index;
							return (
								<tr
									key={item.id}
									onDragOver={(e) => {
										handleDragOver(e, index);
									}}
									onDrop={async (e) => {
										await handleDrop(e, index);
									}}
									onDragLeave={handleDragLeave}
									className={twMerge(
										"transition-colors",
										isDragging && "opacity-50",
										isDragOver && "bg-blue-50 border-t-2 border-blue-500",
									)}
								>
									{columns.map((column, colIndex) => {
										// First column (Workflows) - render with draggable icon
										if (colIndex === 0 && column.path === "name") {
											return (
												<td
													key={colIndex}
													className="relative px-3 py-4 text-xs text-gray-500 sm:table-cell align-middle"
												>
													<div className="flex items-center gap-3">
														<div
															className={`flex items-center justify-center w-6 h-6 transition-colors ${
																canWrite
																	? "text-gray-400 cursor-move hover:text-gray-600"
																	: "text-gray-300 cursor-not-allowed"
															}`}
															draggable={canWrite}
															onDragStart={(e) => {
																handleDragStart(e, item.id);
															}}
															onDragEnd={handleDragEnd}
															aria-label={
																canWrite
																	? "Drag to reorder"
																	: "Reorder disabled"
															}
														>
															<Bars3Icon className="w-4 h-4" />
														</div>
														<div className="flex flex-col">
															<span className="text-sm font-medium text-[#1F2937]">
																{item.name}
															</span>
															<span className="text-xs text-[#6B7280] line-clamp-1">
																{item.description}
															</span>
														</div>
													</div>
												</td>
											);
										}
										// Actions column
										if (column.path === "actions") {
											return (
												<td
													key={colIndex}
													data-actions-cell
													className="relative px-3 py-4 text-xs text-gray-500 sm:table-cell align-middle"
												>
													{column.content
														? column.content(item)
														: item[column.path as keyof Workflow]}
												</td>
											);
										}
										// Other columns
										return (
											<td
												key={colIndex}
												className="relative px-3 py-4 text-xs text-gray-500 sm:table-cell align-middle"
											>
												{column.content
													? column.content(item)
													: item[column.path as keyof Workflow]}
											</td>
										);
									})}
								</tr>
							);
						})
					)}
				</tbody>
			</table>
		</div>
	);
};

export default WorkflowsTable;
