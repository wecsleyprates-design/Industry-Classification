import React, { useState } from "react";
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	EllipsisHorizontalIcon,
	EyeIcon,
	PencilIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useCustomToast } from "@/hooks";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { downloadBlobAsFile, extractFilenameFromHeader } from "@/lib/utils";
import { useExportExecutionLogs } from "@/services/queries/workflows.query";
import type { Workflow } from "@/types/workflows";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface WorkflowActionsMenuProps {
	workflow: Workflow;
	customerId: string;
	onEditWorkflow: (workflowId: string) => void;
	onToggleStatus: (workflowId: string, status: boolean) => void;
	onDeleteWorkflow: (workflow: Workflow) => void;
}

const WorkflowActionsMenu: React.FC<WorkflowActionsMenuProps> = ({
	workflow,
	customerId,
	onEditWorkflow,
	onToggleStatus,
	onDeleteWorkflow,
}) => {
	const [open, setOpen] = useState(false);
	const { canWrite } = useWorkflowPermissions();
	const { successToast, errorToast } = useCustomToast();
	const { mutateAsync: exportLogs, isPending: isExporting } =
		useExportExecutionLogs();

	const handleExportLogs = async () => {
		try {
			const response = await exportLogs({
				customerId,
				workflowId: workflow.id,
			});
			const filename = extractFilenameFromHeader(
				response.filename,
				"execution_logs",
			);
			downloadBlobAsFile(response.data, filename);
			successToast("Execution logs exported successfully");
		} catch (error) {
			errorToast(error);
		} finally {
			setOpen(false);
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
					aria-label={`Actions for workflow ${workflow.name}`}
					draggable={false}
				>
					<EllipsisHorizontalIcon className="w-5 h-5" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-48 bg-gray-800 text-white border-gray-700"
			>
				<DropdownMenuItem
					onClick={handleExportLogs}
					disabled={isExporting}
					className="cursor-pointer focus:bg-gray-700 focus:text-white"
				>
					<ArrowDownTrayIcon className="w-4 h-4 mr-2" />
					{isExporting ? "Exporting..." : "Export Logs"}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						if (!canWrite) return;
						onToggleStatus(workflow.id, workflow.status === "inactive");
						setOpen(false);
					}}
					disabled={!canWrite}
					className={
						canWrite
							? "cursor-pointer focus:bg-gray-700 focus:text-white"
							: "cursor-not-allowed opacity-50 text-gray-400"
					}
				>
					<ArrowPathIcon className="w-4 h-4 mr-2" />
					{workflow.status === "inactive" ? "Set to Active" : "Set to Inactive"}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						onEditWorkflow(workflow.id);
						setOpen(false);
					}}
					className="cursor-pointer focus:bg-gray-700 focus:text-white"
				>
					{canWrite ? (
						<>
							<PencilIcon className="w-4 h-4 mr-2" />
							Edit Workflow
						</>
					) : (
						<>
							<EyeIcon className="w-4 h-4 mr-2" />
							View Workflow
						</>
					)}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => {
						if (!canWrite) return;
						onDeleteWorkflow(workflow);
						setOpen(false);
					}}
					disabled={!canWrite}
					className={
						canWrite
							? "cursor-pointer focus:bg-gray-700 text-red-400 focus:text-red-300"
							: "cursor-not-allowed opacity-50 text-gray-400"
					}
				>
					<TrashIcon className="w-4 h-4 mr-2" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default WorkflowActionsMenu;
