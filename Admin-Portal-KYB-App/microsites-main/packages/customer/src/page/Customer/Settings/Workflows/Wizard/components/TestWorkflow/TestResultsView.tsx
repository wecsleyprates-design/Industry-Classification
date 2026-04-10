import React from "react";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import {
	CheckIcon,
	XMarkIcon as XMarkIconSolid,
} from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";
import type { WorkflowTestResult } from "@/types/test-workflow";

interface TestResultsViewProps {
	results: WorkflowTestResult[];
	currentIndex: number;
	onPrevious: () => void;
	onNext: () => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
	results,
	currentIndex,
	onPrevious,
	onNext,
}) => {
	const currentResult = results[currentIndex];
	const totalResults = results.length;
	const hasPrevious = currentIndex > 0;
	const hasNext = currentIndex < totalResults - 1;

	if (!currentResult) {
		return null;
	}

	// Display business name or fallback
	const displayBusinessName =
		currentResult.business_name || `Business ${currentIndex + 1}`;

	return (
		<div className="space-y-6">
			{/* Header with Business Name and Pagination */}
			<div className="flex items-center justify-between">
				<h3 className="text-2xl font-bold text-gray-900">
					{displayBusinessName}
				</h3>
				{totalResults > 1 && (
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={onPrevious}
							disabled={!hasPrevious}
							className={cn(
								"p-2 rounded-md border transition-colors",
								hasPrevious
									? "border-gray-300 text-gray-700 hover:bg-gray-50"
									: "border-gray-200 text-gray-300 cursor-not-allowed",
							)}
						>
							<ChevronLeftIcon className="w-4 h-4" />
						</button>
						<span className="text-sm text-gray-600 min-w-[50px] text-center px-2">
							{currentIndex + 1} / {totalResults}
						</span>
						<button
							type="button"
							onClick={onNext}
							disabled={!hasNext}
							className={cn(
								"p-2 rounded-md border transition-colors",
								hasNext
									? "border-gray-300 text-gray-700 hover:bg-gray-50"
									: "border-gray-200 text-gray-300 cursor-not-allowed",
							)}
						>
							<ChevronRightIcon className="w-4 h-4" />
						</button>
					</div>
				)}
			</div>

			{/* Case Results */}
			<div>
				<p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
					Case Results
				</p>
				<p className="text-lg font-semibold mt-1 text-yellow-700">
					Workflow: {currentResult.workflow_name}
				</p>
			</div>

			{/* Rules Passed */}
			{currentResult.rules_passed.length > 0 && (
				<div>
					<div className="flex items-start gap-3 mb-3">
						<div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
							<CheckIcon className="w-4 h-4 text-green-600" />
						</div>
						<div>
							<h4 className="text-base font-semibold text-gray-900">
								{currentResult.rules_passed.length} Rules Passed
							</h4>
							<p className="text-sm text-gray-500">
								These requirements have been successfully verified.
							</p>
						</div>
					</div>
					<div className="ml-9 space-y-3">
						{currentResult.rules_passed.map((rule) => (
							<div key={rule.name} className="flex items-start gap-2">
								<CheckIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{rule.name}
									</p>
									<p className="text-sm text-gray-500">{rule.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Rules Failed */}
			{currentResult.rules_failed.length > 0 && (
				<div>
					<div className="flex items-start gap-3 mb-3">
						<div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
							<ExclamationCircleIcon className="w-4 h-4 text-red-600" />
						</div>
						<div>
							<h4 className="text-base font-semibold text-gray-900">
								{currentResult.rules_failed.length} Rule
								{currentResult.rules_failed.length > 1 ? "s" : ""} Failed
							</h4>
							<p className="text-sm text-gray-500">
								Further investigation is required for the item below.
							</p>
						</div>
					</div>
					<div className="ml-9 space-y-3">
						{currentResult.rules_failed.map((rule) => (
							<div key={rule.name} className="flex items-start gap-2">
								<XMarkIconSolid className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{rule.name}
									</p>
									<p className="text-sm text-gray-500">{rule.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* No Rules Evaluated Message */}
			{currentResult.rules_passed.length === 0 &&
				currentResult.rules_failed.length === 0 && (
					<div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
						<p className="text-sm text-gray-500 text-center">
							No rules were evaluated for this business. The workflow trigger
							conditions may not have matched.
						</p>
					</div>
				)}
		</div>
	);
};
