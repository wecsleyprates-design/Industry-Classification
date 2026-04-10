import { type FC, useEffect } from "react";
import { useGetWorkflowConditions } from "@/services/queries/case.query";

import { WorkflowConditions } from "@/ui/workflow-conditions";

interface WorkflowWidgetProps {
	caseId: string;
	onActionAppliedChange?: (value: string) => void;
}

/**
 * WorkflowWidget component displays workflow conditions categorized as:
 * - Failed: Conditions that did not pass
 * - Passed: Conditions that successfully passed
 *
 * @param caseId - The ID of the case to fetch workflow conditions for
 */
const WorkflowWidget: FC<WorkflowWidgetProps> = ({
	caseId,
	onActionAppliedChange,
}) => {
	const { data: workflowData, isLoading } = useGetWorkflowConditions(caseId, {
		enabled: !!caseId,
	});
	const isSuccess = workflowData?.status === "success";
	const workflows = workflowData?.data?.workflows_evaluated ?? [];
	const actionApplied = workflowData?.data?.action_applied ?? "";
	const generatedDate = workflowData?.data?.generated_at ?? undefined;

	useEffect(() => {
		if (!actionApplied) return;
		onActionAppliedChange?.(actionApplied);
	}, [actionApplied, onActionAppliedChange]);

	if (!isSuccess) {
		return <></>;
	}

	return (
		<WorkflowConditions
			workflows={workflows}
			generatedDate={generatedDate}
			isLoading={isLoading}
		/>
	);
};

export default WorkflowWidget;
