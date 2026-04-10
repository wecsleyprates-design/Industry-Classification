import React from "react";
import { cn } from "@/lib/utils";
import type { WorkflowCondition } from "@/types/workflow-details";
import { ConnectorBadge } from "./BadgeComponents";
import { ConditionRow } from "./ConditionRow";

interface ConditionGroupProps {
	condition: WorkflowCondition;
	isNested?: boolean;
}

export const ConditionGroup: React.FC<ConditionGroupProps> = ({
	condition,
	isNested = false,
}) => {
	const isGroup = condition.conditions && condition.conditions.length > 0;

	// If it's a leaf node (no sub-conditions), just render the row
	if (!isGroup) {
		return <ConditionRow condition={condition} />;
	}

	// If it is a group, we render the children with connectors
	// If it's nested (not the top-level group), we wrap it in the "box" style
	return (
		<div
			className={cn(
				"flex flex-col w-full",
				isNested &&
					"border-2 border-dotted border-gray-300/60 rounded-xl p-5 bg-gray-50/30 relative",
			)}
		>
			{condition.conditions?.map((subCondition, index) => (
				<React.Fragment key={index}>
					{/* Recursive call: subCondition might be another group or a leaf */}
					<ConditionGroup condition={subCondition} isNested={true} />

					{/* Render connector if not the last item */}
					{index < (condition.conditions?.length ?? 0) - 1 && (
						<ConnectorBadge operator={condition.operator} />
					)}
				</React.Fragment>
			))}
		</div>
	);
};
