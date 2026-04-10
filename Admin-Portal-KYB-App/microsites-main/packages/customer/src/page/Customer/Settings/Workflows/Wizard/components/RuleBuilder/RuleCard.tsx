import React, { useCallback, useEffect, useRef } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { cn } from "@/lib/utils";
import type {
	ConditionFormData,
	DecisionValue,
	RuleConditionItem,
	RuleFormData,
} from "@/types/workflows";
import { ConditionConnector } from "./ConditionConnector";
import { ConditionGroup } from "./ConditionGroup";
import { ConditionRow } from "./ConditionRow";
import { DecisionSelect } from "./DecisionSelect";
import { RuleHeader } from "./RuleHeader";
import { isConditionGroup } from "./types";
import { createEmptyCondition, createEmptyConditionGroup } from "./utils";

interface RuleCardProps {
	rule: RuleFormData;
	onUpdate: (updates: Partial<RuleFormData>) => void;
	onDelete: () => void;
	canDelete?: boolean;
	hasError?: boolean;
	shouldScrollIntoView?: boolean;
}

export const RuleCard: React.FC<RuleCardProps> = ({
	rule,
	onUpdate,
	onDelete,
	canDelete = true,
	hasError = false,
	shouldScrollIntoView = false,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const cardRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (shouldScrollIntoView && cardRef.current) {
			cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}, [shouldScrollIntoView]);
	const handleNameChange = useCallback(
		(name: string) => {
			onUpdate({ name });
		},
		[onUpdate],
	);

	const handleDecisionChange = useCallback(
		(decision: DecisionValue | "") => {
			onUpdate({ decision });
		},
		[onUpdate],
	);

	const handleConditionChange = useCallback(
		(index: number, updates: Partial<ConditionFormData>) => {
			const newConditions = [...rule.conditions];
			const item = newConditions[index];

			if (isConditionGroup(item)) return;

			newConditions[index] = { ...item, ...updates };
			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const handleConditionDelete = useCallback(
		(index: number) => {
			if (rule.conditions.length <= 1) return;

			const newConditions = rule.conditions.filter((_, i) => i !== index);
			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const handleAddCondition = useCallback(() => {
		onUpdate({ conditions: [...rule.conditions, createEmptyCondition()] });
	}, [rule.conditions, onUpdate]);

	const handleCreateGroup = useCallback(
		(index: number) => {
			const item = rule.conditions[index];
			if (isConditionGroup(item)) return;

			const newGroup = createEmptyConditionGroup(item);
			newGroup.conditions.push(createEmptyCondition());

			const newConditions = [...rule.conditions];
			newConditions[index] = newGroup;
			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const handleGroupConditionUpdate = useCallback(
		(
			groupIndex: number,
			conditionIndex: number,
			updates: Partial<ConditionFormData>,
		) => {
			const newConditions = [...rule.conditions];
			const group = newConditions[groupIndex];

			if (!isConditionGroup(group)) return;

			const newGroupConditions = [...group.conditions];
			newGroupConditions[conditionIndex] = {
				...newGroupConditions[conditionIndex],
				...updates,
			};

			newConditions[groupIndex] = { ...group, conditions: newGroupConditions };
			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const handleGroupConditionDelete = useCallback(
		(groupIndex: number, conditionIndex: number) => {
			const newConditions = [...rule.conditions];
			const group = newConditions[groupIndex];

			if (!isConditionGroup(group)) return;

			const newGroupConditions = group.conditions.filter(
				(_, i) => i !== conditionIndex,
			);

			if (newGroupConditions.length <= 1) {
				newConditions[groupIndex] =
					newGroupConditions[0] ?? createEmptyCondition();
			} else {
				newConditions[groupIndex] = {
					...group,
					conditions: newGroupConditions,
				};
			}

			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const handleGroupAddCondition = useCallback(
		(groupIndex: number) => {
			const newConditions = [...rule.conditions];
			const group = newConditions[groupIndex];

			if (!isConditionGroup(group)) return;

			newConditions[groupIndex] = {
				...group,
				conditions: [...group.conditions, createEmptyCondition()],
			};
			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const handleGroupDelete = useCallback(
		(groupIndex: number) => {
			const newConditions = [...rule.conditions];
			const group = newConditions[groupIndex];

			if (!isConditionGroup(group)) return;

			if (group.conditions.length > 0) {
				newConditions[groupIndex] = group.conditions[0];
			} else {
				newConditions.splice(groupIndex, 1);
			}

			onUpdate({ conditions: newConditions });
		},
		[rule.conditions, onUpdate],
	);

	const renderConditionItem = (item: RuleConditionItem, index: number) => {
		if (isConditionGroup(item)) {
			return (
				<ConditionGroup
					key={item.id}
					group={item}
					onUpdateCondition={(condIndex, updates) => {
						handleGroupConditionUpdate(index, condIndex, updates);
					}}
					onDeleteCondition={(condIndex) => {
						handleGroupConditionDelete(index, condIndex);
					}}
					onAddCondition={() => {
						handleGroupAddCondition(index);
					}}
					onDeleteGroup={() => {
						handleGroupDelete(index);
					}}
					showErrors={hasError}
				/>
			);
		}

		return (
			<ConditionRow
				key={item.id}
				condition={item}
				onChange={(updates) => {
					handleConditionChange(index, updates);
				}}
				onDelete={() => {
					handleConditionDelete(index);
				}}
				onCreateGroup={() => {
					handleCreateGroup(index);
				}}
				canDelete={rule.conditions.length > 1}
				showErrors={hasError}
			/>
		);
	};

	return (
		<div
			ref={cardRef}
			className={cn(
				"bg-white rounded-lg border shadow-sm transition-colors",
				hasError ? "border-red-300 ring-1 ring-red-200" : "border-gray-200",
			)}
		>
			<RuleHeader
				name={rule.name}
				onNameChange={handleNameChange}
				onDelete={onDelete}
				canDelete={canDelete && !isReadOnly}
				hasError={hasError}
			/>

			<div className="p-4 xl:p-6">
				<div className="flex flex-col xl:flex-row gap-2 xl:gap-6">
					<div className="text-xs font-medium text-gray-400 uppercase tracking-wide xl:pt-3 w-8 flex-shrink-0">
						IF
					</div>

					<div className="flex-1 space-y-1 min-w-0">
						{rule.conditions.map((item, index) => (
							<React.Fragment key={item.id}>
								{renderConditionItem(item, index)}
								{index < rule.conditions.length - 1 && (
									<ConditionConnector type="AND" />
								)}
							</React.Fragment>
						))}

						{!isReadOnly && (
							<div className="flex justify-center pt-4">
								<button
									type="button"
									onClick={handleAddCondition}
									className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
								>
									<PlusIcon className="h-4 w-4" />
									Add Condition
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			<DecisionSelect
				value={rule.decision}
				onChange={handleDecisionChange}
				label="THEN"
				hasError={hasError && !rule.decision}
			/>
		</div>
	);
};
