import React from "react";
import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Button";

interface WorkflowsEmptyStateProps {
	onCreateWorkflow: () => void;
	isReadOnly?: boolean;
}

const WorkflowsEmptyState: React.FC<WorkflowsEmptyStateProps> = ({
	onCreateWorkflow,
	isReadOnly = false,
}) => {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4">
			<div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-blue-100">
				<DocumentArrowUpIcon className="w-8 h-8 text-blue-600" />
			</div>
			<h3 className="text-lg font-semibold text-[#1F2937] mb-2">
				No Workflows to Display
			</h3>
			<p className="text-sm text-[#6B7280] mb-6 text-center max-w-md">
				{isReadOnly
					? "There are no workflows configured for this customer yet."
					: "To begin viewing workflows, create a workflow."}
			</p>
			{!isReadOnly && (
				<Button
					type="button"
					color="blue"
					onClick={onCreateWorkflow}
					className="px-6 py-2"
				>
					Create a Workflow
				</Button>
			)}
		</div>
	);
};

export default WorkflowsEmptyState;
