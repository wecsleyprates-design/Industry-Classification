import React from "react";
import { ArrowRightIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { WorkflowAction, WorkflowRule } from "@/types/workflow-details";
import { ConditionGroup } from "./ConditionGroup";

// --- Action Renderer ---

const ActionRenderer = ({ actions }: { actions: WorkflowAction[] }) => {
	if (!actions || actions.length === 0) return null;

	const getActionStyle = (value: string | number | boolean | null) => {
		const v = String(value ?? "").toLowerCase();
		if (v.includes("approve") || v.includes("activate"))
			return "bg-green-50 border-green-100 text-green-700";
		if (v.includes("reject") || v.includes("decline"))
			return "bg-red-50 border-red-100 text-red-700";
		return "bg-yellow-50 border-yellow-100 text-yellow-700";
	};

	return (
		<div className="mt-6">
			{actions.map((action, idx) => (
				<div
					key={idx}
					className={cn(
						"rounded-lg border px-4 py-3 flex items-center gap-2 text-sm font-semibold shadow-sm",
						getActionStyle(action.parameters.value),
					)}
				>
					<ArrowRightIcon className="w-4 h-4" />
					<span>Action: {String(action.parameters.value ?? "")}</span>
				</div>
			))}
		</div>
	);
};

// --- Rule Card ---

interface RuleCardProps {
	rule: WorkflowRule | Partial<WorkflowRule>; // Partial to allow passing just name/actions for default rule
	isDefault?: boolean;
}

export const RuleCard: React.FC<RuleCardProps> = ({
	rule,
	isDefault = false,
}) => {
	return (
		<div
			className={cn(
				"bg-white border rounded-xl p-6 mb-6 shadow-sm transition-all hover:shadow-md",
				isDefault
					? "border-yellow-200 ring-1 ring-yellow-100"
					: "border-gray-200",
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between mb-6">
				<div className="flex items-center gap-3">
					{isDefault ? (
						<span className="bg-yellow-400 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold shadow-sm">
							!
						</span>
					) : (
						<span className="bg-blue-500 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold shadow-sm">
							{rule.priority}
						</span>
					)}
					<h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
				</div>
				<LockClosedIcon className="w-5 h-5 text-gray-400" />
			</div>

			{/* Conditions */}
			{rule.conditions && (
				<div className="mb-6">
					<ConditionGroup condition={rule.conditions} />
				</div>
			)}

			{/* Actions */}
			{rule.actions && <ActionRenderer actions={rule.actions} />}

			{/* Handle default action object structure if passed as rule property (for flexible usage) */}
			{(rule as any).default_action && (
				<ActionRenderer actions={[(rule as any).default_action]} />
			)}

			{/* Default Rule Helper Text */}
			{isDefault && (
				<p className="text-sm text-gray-500 italic mt-4">
					Applied when no other rules match
				</p>
			)}
		</div>
	);
};
