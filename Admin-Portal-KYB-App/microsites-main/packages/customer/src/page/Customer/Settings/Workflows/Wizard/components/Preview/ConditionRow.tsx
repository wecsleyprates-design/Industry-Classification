import React from "react";
import type { WorkflowCondition } from "@/types/workflow-details";
import { FieldBadge, OperatorBadge, ValueBadge } from "./BadgeComponents";

interface ConditionRowProps {
	condition: WorkflowCondition;
}

export const ConditionRow: React.FC<ConditionRowProps> = ({ condition }) => {
	const displayField = condition.display_label ?? condition.field;

	return (
		<div className="bg-slate-50 border border-slate-100 rounded-md p-4 flex items-center gap-3 shadow-sm hover:bg-slate-100/50 transition-colors">
			{displayField && <FieldBadge field={displayField} />}
			<OperatorBadge operator={condition.operator} />
			{condition.value !== undefined && (
				<ValueBadge value={condition.value} operator={condition.operator} />
			)}
		</div>
	);
};
