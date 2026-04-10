import React, { useCallback } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import type {
	ConditionFormData,
	ConditionGroupFormData,
} from "@/types/workflows";
import { ConditionConnector } from "./ConditionConnector";
import { ConditionRow } from "./ConditionRow";

interface ConditionGroupProps {
	group: ConditionGroupFormData;
	onUpdateCondition: (
		index: number,
		updates: Partial<ConditionFormData>,
	) => void;
	onDeleteCondition: (index: number) => void;
	onAddCondition: () => void;
	onDeleteGroup: () => void;
	showErrors?: boolean;
}

export const ConditionGroup: React.FC<ConditionGroupProps> = ({
	group,
	onUpdateCondition,
	onDeleteCondition,
	onAddCondition,
	onDeleteGroup,
	showErrors = false,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const handleConditionChange = useCallback(
		(index: number) => (updates: Partial<ConditionFormData>) => {
			onUpdateCondition(index, updates);
		},
		[onUpdateCondition],
	);

	const handleConditionDelete = useCallback(
		(index: number) => () => {
			if (group.conditions.length === 1) {
				onDeleteGroup();
				return;
			}
			onDeleteCondition(index);
		},
		[group.conditions.length, onDeleteCondition, onDeleteGroup],
	);

	return (
		<div className="bg-gray-50 rounded-lg border border-gray-200 p-3 xl:p-4 my-2">
			<div className="space-y-1">
				{group.conditions.map((condition, index) => (
					<div key={condition.id}>
						<ConditionRow
							condition={condition}
							onChange={handleConditionChange(index)}
							onDelete={handleConditionDelete(index)}
							showGroupButton={false}
							canDelete={true}
							isInsideGroup={true}
							showErrors={showErrors}
						/>

						{index < group.conditions.length - 1 && (
							<ConditionConnector type="OR" />
						)}
					</div>
				))}
			</div>

			{!isReadOnly && (
				<div className="flex items-center mt-3 xl:pl-4">
					<button
						type="button"
						onClick={onAddCondition}
						className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white hover:border-gray-400 transition-colors"
					>
						<PlusIcon className="h-4 w-4" />
						Add Condition
					</button>
				</div>
			)}
		</div>
	);
};
