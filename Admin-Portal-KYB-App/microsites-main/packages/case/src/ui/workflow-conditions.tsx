import { useMemo } from "react";
import {
	CheckCircleIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/solid";
import dayjs from "dayjs";
import { ExpandContent } from "@/components/ExpandContent";
import {
	type WorkflowCondition,
	type WorkflowEvaluated,
	type WorkflowRuleEvaluation,
} from "@/types/case";
import { Card, CardContent } from "./card";

import { URL } from "@/constants";
import { WORKFLOW_DECISION_ENUM } from "@/constants/Workflows";
import { useWorkflowDecision } from "@/contexts/WorkflowDecisionContext";
import { Skeleton } from "@/ui/skeleton";

interface WorkflowConditionsProps {
	workflows: WorkflowEvaluated[];
	generatedDate?: string;
	isLoading?: boolean;
}

interface ConditionCategoryProps {
	title: string;
	description: string;
	conditions: WorkflowCondition[];
	Icon: React.ComponentType<{ className?: string }>;
	iconColor: string;
	bgColor: string;
}

const WorkflowItem: React.FC<WorkflowEvaluated> = ({
	name,
	version,
	rules,
}) => {
	const existConditions = rules.some((rule) => rule.conditions);
	if (!existConditions) return null;

	return (
		<Card className="flex flex-col gap-2 border-y border-gray-100 p-4">
			<CardContent className="flex flex-col gap-3 p-0">
				<ExpandContent
					title={
						<div className="flex-1 text-xl font-semibold">
							{name}
							{version ? ` v${version}` : ""}
						</div>
					}
					initialIsExpanded={false}
				>
					{rules.map((rule, index) => (
						<RuleItem key={`${rule.name}-${index}`} {...rule} />
					))}
				</ExpandContent>
			</CardContent>
		</Card>
	);
};

const RuleItem: React.FC<WorkflowRuleEvaluation> = ({ name, conditions }) => {
	const workflowDecision = useWorkflowDecision();
	const conditionCategories = useMemo(() => {
		if (!conditions) return [];
		switch (workflowDecision) {
			case WORKFLOW_DECISION_ENUM.AUTO_REJECTED:
				return [
					{
						title: "Matched",
						description: "",
						conditions: conditions.failed,
						Icon: ExclamationCircleIcon,
						iconColor: "text-red-500",
						bgColor: "bg-red-100",
					},
					{
						title: "Did Not Match",
						description: "",
						conditions: conditions.passed,
						Icon: CheckCircleIcon,
						iconColor: "text-green-600",
						bgColor: "bg-green-100",
					},
				];
			default:
				return [
					{
						title: "Matched",
						description:
							"These requirements have been successfully verified.",
						conditions: conditions.passed,
						Icon: CheckCircleIcon,
						iconColor: "text-green-600",
						bgColor: "bg-green-100",
					},
					{
						title: "Did Not Match",
						description:
							"Further investigation is required for the items below.",
						conditions: conditions.failed,
						Icon: ExclamationCircleIcon,
						iconColor: "text-red-500",
						bgColor: "bg-red-100",
					},
				];
		}
	}, [workflowDecision]);

	if (!conditionCategories.length) return null;

	return (
		<div className="flex flex-col gap-2">
			<div className="flex-1 text-lg font-semibold">{name}</div>
			<div className="flex flex-col gap-6">
				{conditionCategories.map((category) => {
					if (category.conditions.length === 0) return null;
					return (
						<ConditionCategory key={category.title} {...category} />
					);
				})}
			</div>
		</div>
	);
};

const ConditionCategory: React.FC<ConditionCategoryProps> = ({
	title,
	description,
	conditions,
	Icon,
	iconColor,
	bgColor,
}) => {
	const count = conditions.length;
	if (count === 0) return null;

	return (
		<>
			<div className={`flex gap-4 flex-1`}>
				<div
					className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`}
				>
					<Icon className={`w-6 h-6 ${iconColor}`} />
				</div>
				<div className="flex flex-col flex-1 justify-center">
					<span className="text-base font-semibold">
						{count} {count === 1 ? "Condition" : "Conditions"}{" "}
						{title}
					</span>
					<span className="text-sm font-light text-gray-500">
						{description}
					</span>
				</div>
			</div>
			<div className="ml-4 border-t border-gray-200 pt-4 flex flex-col gap-3">
				{conditions.map((condition, index) => (
					<div
						className="flex gap-3"
						key={`${condition.name}-${index}`}
					>
						<div
							className={`w-5 h-5 rounded-full flex items-center justify-center ${bgColor}`}
						>
							<Icon className={`w-4 h-4 ${iconColor}`} />
						</div>
						<div className="flex flex-col">
							<div className={`text-sm font-medium capitalize`}>
								{condition.name
									.toLowerCase()
									.replaceAll("_", " ")}
							</div>
							<div className="text-sm font-light text-gray-500">
								{condition.description}
							</div>
						</div>
					</div>
				))}
			</div>
		</>
	);
};

export function WorkflowConditions({
	workflows,
	generatedDate,
	isLoading = false,
}: WorkflowConditionsProps) {
	if (isLoading) {
		return (
			<div className="mt-12 flex flex-col">
				<div className="flex items-center justify-between gap-2 mb-3">
					<Skeleton className="w-44 h-4" />
					<Skeleton className="w-24 h-4" />
				</div>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 border-y border-gray-100 p-4">
						<div className="flex items-center justify-between gap-2">
							<Skeleton className="w-56 h-7" />
							<Skeleton className="w-5 h-5" />
						</div>
						<div className="flex flex-col gap-6">
							<div className="flex gap-4">
								<Skeleton className="w-10 h-10 rounded-lg" />
								<div className="flex flex-col gap-2 flex-1">
									<Skeleton className="w-40 h-5" />
									<Skeleton className="w-72 h-4" />
								</div>
							</div>
							<div className="flex gap-4">
								<Skeleton className="w-10 h-10 rounded-lg" />
								<div className="flex flex-col gap-2 flex-1">
									<Skeleton className="w-40 h-5" />
									<Skeleton className="w-72 h-4" />
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="mt-4 pt-4 border-t border-gray-200">
					<Skeleton className="w-36 h-4" />
				</div>
			</div>
		);
	}

	const existConditions = workflows.some((workflow) =>
		workflow.rules.some((rule) => rule.conditions),
	);
	if (!existConditions) return null;

	const formattedDate = generatedDate
		? dayjs(generatedDate).format("MM/DD/YY")
		: null;

	return (
		<div className="mt-12 flex flex-col">
			<div className="flex items-center justify-between gap-2 mb-3">
				<h2 className="text-xs font-medium text-gray-500">
					Decisioning workflows applied:
				</h2>
				<a
					className="text-xs text-blue-600 underline cursor-pointer"
					href={URL.SETTINGS_WORKFLOWS}
				>
					View workflows →
				</a>
			</div>
			<div className="flex flex-col gap-4">
				{workflows.map((workflow) => (
					<WorkflowItem key={workflow.workflow_id} {...workflow} />
				))}
			</div>
			{formattedDate && (
				<div className="mt-4 pt-4 border-t border-gray-200 text-xs font-light text-gray-400 text-left align-left">
					* Generated on {formattedDate}
				</div>
			)}
		</div>
	);
}
