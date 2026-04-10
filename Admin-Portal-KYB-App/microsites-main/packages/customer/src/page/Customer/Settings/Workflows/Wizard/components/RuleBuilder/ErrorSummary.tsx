import React, { useCallback } from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { RuleValidationError } from "./types";

interface ErrorSummaryProps {
	errors: RuleValidationError[];
	onErrorClick?: (ruleIndex: number) => void;
}

export const ErrorSummary: React.FC<ErrorSummaryProps> = ({
	errors,
	onErrorClick,
}) => {
	const handleClick = useCallback(
		(ruleIndex: number) => {
			onErrorClick?.(ruleIndex);
		},
		[onErrorClick],
	);

	if (errors.length === 0) return null;

	const totalErrors = errors.reduce((acc, e) => acc + e.errors.length, 0);

	return (
		<div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0">
					<ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-sm font-medium text-red-800">
						{totalErrors} {totalErrors === 1 ? "error" : "errors"} found
					</h3>
					<p className="text-sm text-red-600 mt-1">
						Please fix the following issues before continuing:
					</p>

					<div className="mt-3 space-y-3">
						{errors.map((ruleError) => (
							<div key={ruleError.ruleIndex} className="text-sm">
								<button
									type="button"
									onClick={() => {
										handleClick(ruleError.ruleIndex);
									}}
									className="font-medium text-red-800 hover:text-red-900 hover:underline focus:outline-none focus:underline"
								>
									{ruleError.ruleName}
								</button>
								<ul className="mt-1 ml-4 space-y-0.5">
									{ruleError.errors.map((error, idx) => (
										<li key={idx} className="text-red-600 list-disc">
											{error}
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};
