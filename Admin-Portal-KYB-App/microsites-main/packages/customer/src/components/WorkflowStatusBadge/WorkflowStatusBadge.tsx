import React from "react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Badge from "@/components/Badge";
import type { WorkflowStatus } from "@/types/workflows";

interface WorkflowStatusBadgeProps {
	status: WorkflowStatus;
}

/**
 * Status badge component for a workflow status
 */
export const WorkflowStatusBadge: React.FC<WorkflowStatusBadgeProps> = ({
	status,
}) => {
	switch (status) {
		case "active":
			return (
				<Badge
					color="green"
					isRemoveable={false}
					text="Active"
					icon={<CheckCircleIcon className="w-3 h-3" />}
					className="text-xs"
				/>
			);
		case "inactive":
			return (
				<Badge
					color="red"
					isRemoveable={false}
					text="Inactive"
					className="text-xs"
				/>
			);
		default: {
			return <>{status}</>;
		}
	}
};
