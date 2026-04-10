import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import type {
	AttributesCatalog,
	DecisionValue,
	RuleFormData,
	WorkflowWizardForm,
} from "@/types/workflows";
import { DEFAULT_DECISION } from "./constants";
import { DefaultActionCard } from "./DefaultActionCard";
import { ErrorSummary } from "./ErrorSummary";
import { RuleBuilderProvider } from "./RuleBuilderContext";
import { RuleCard } from "./RuleCard";
import type { RuleValidationError } from "./types";
import {
	createDefaultAction,
	createEmptyRule,
	generateNextRuleName,
} from "./utils";

interface RuleBuilderProps {
	form: UseFormReturn<WorkflowWizardForm>;
	catalog: AttributesCatalog;
	isLoading?: boolean;
	showValidationErrors?: boolean;
	validationErrors?: RuleValidationError[];
	onErrorClick?: (ruleIndex: number) => void;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
	form,
	catalog,
	isLoading = false,
	showValidationErrors = false,
	validationErrors = [],
	onErrorClick,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const { control, watch, setValue } = form;

	const { fields, append, remove, update } = useFieldArray({
		control,
		name: "rules",
	});

	const rules = fields;
	const defaultAction = watch("default_action");
	const [showDefaultAction, setShowDefaultAction] = useState(!!defaultAction);
	const [scrollToRuleIndex, setScrollToRuleIndex] = useState<number | null>(
		null,
	);
	const hasInitializedEmptyRule = useRef(false);

	// Sync showDefaultAction when defaultAction changes (e.g., from form.reset in edit mode)
	useEffect(() => {
		if (defaultAction) {
			setShowDefaultAction(true);
		}
	}, [defaultAction]);

	// Ensure at least one empty rule exists when not loading
	useEffect(() => {
		if (isLoading) return;

		if (rules.length === 0 && !hasInitializedEmptyRule.current) {
			hasInitializedEmptyRule.current = true;
			const emptyRule = createEmptyRule(0);
			append(emptyRule);
		} else if (rules.length > 0) {
			hasInitializedEmptyRule.current = false;
		}
	}, [isLoading, rules.length, append]);

	const ruleErrorMap = useMemo(() => {
		const map = new Map<number, boolean>();
		validationErrors.forEach((error) => {
			if (error.ruleIndex >= 0) {
				map.set(error.ruleIndex, true);
			}
		});
		return map;
	}, [validationErrors]);

	const handleErrorClick = useCallback(
		(ruleIndex: number) => {
			setScrollToRuleIndex(ruleIndex);
			onErrorClick?.(ruleIndex);
			requestAnimationFrame(() => {
				setScrollToRuleIndex(null);
			});
		},
		[onErrorClick],
	);

	const handleAddRule = useCallback(() => {
		const newRule = createEmptyRule(rules.length);
		newRule.name = generateNextRuleName(rules);
		append(newRule);
	}, [rules, append]);

	const handleUpdateRule = useCallback(
		(index: number, updates: Partial<RuleFormData>) => {
			const currentRule = rules[index];
			if (!currentRule) return;
			update(index, { ...currentRule, ...updates });
		},
		[rules, update],
	);

	const handleDeleteRule = useCallback(
		(index: number) => {
			if (rules.length <= 1) return;
			remove(index);
		},
		[rules.length, remove],
	);

	const handleDefaultActionChange = useCallback(
		(value: DecisionValue | "") => {
			if (!value) {
				setValue("default_action", undefined);
				return;
			}
			setValue("default_action", createDefaultAction(value));
		},
		[setValue],
	);

	const handleRemoveDefaultAction = useCallback(() => {
		setValue("default_action", undefined);
		setShowDefaultAction(false);
	}, [setValue]);

	const handleAddDefaultAction = useCallback(() => {
		setValue("default_action", createDefaultAction(DEFAULT_DECISION));
		setShowDefaultAction(true);
	}, [setValue]);

	const defaultActionValue =
		(defaultAction?.parameters?.value as DecisionValue) ?? "";

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse">
					<div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
					<div className="space-y-3">
						<div className="h-10 bg-gray-200 rounded" />
						<div className="h-10 bg-gray-200 rounded" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<RuleBuilderProvider catalog={catalog} isLoading={isLoading}>
			<div className="space-y-6">
				{rules.map((rule, index) => (
					<RuleCard
						key={rule.id}
						rule={rule}
						onUpdate={(updates) => {
							handleUpdateRule(index, updates);
						}}
						onDelete={() => {
							handleDeleteRule(index);
						}}
						canDelete={rules.length > 1}
						hasError={showValidationErrors && ruleErrorMap.has(index)}
						shouldScrollIntoView={scrollToRuleIndex === index}
					/>
				))}

				{!isReadOnly && (
					<button
						type="button"
						onClick={handleAddRule}
						className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
					>
						<PlusIcon className="h-5 w-5" />
						<span className="font-medium">Add Rule</span>
					</button>
				)}

				<DefaultActionCard
					value={defaultActionValue}
					onChange={handleDefaultActionChange}
					onRemove={handleRemoveDefaultAction}
					isVisible={showDefaultAction}
					onAdd={handleAddDefaultAction}
				/>

				{showValidationErrors && validationErrors.length > 0 && (
					<ErrorSummary
						errors={validationErrors}
						onErrorClick={handleErrorClick}
					/>
				)}
			</div>
		</RuleBuilderProvider>
	);
};
