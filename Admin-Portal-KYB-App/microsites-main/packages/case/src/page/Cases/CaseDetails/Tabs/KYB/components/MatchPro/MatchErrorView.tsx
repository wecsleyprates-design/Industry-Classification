import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { type MatchError } from "@/types/integrations";

interface MatchErrorViewProps {
	errors: MatchError[];
}

export const MatchErrorView: React.FC<MatchErrorViewProps> = ({ errors }) => {
	if (!errors || errors.length === 0) return null;

	return (
		<div className="space-y-3 mt-2">
			{errors.map((err, idx) => (
				<div
					key={err.ReasonCode ?? idx}
					className="flex items-start gap-1.5 text-xs text-red-700 pr-2.5 py-0.5 rounded"
				>
					<ExclamationTriangleIcon className="w-3.5 h-3.5 mt-1 shrink-0" />
					<div>
						<p className="text-red-500 mt-0.5">
							{err.Details || err.Description}
						</p>
						{err.ReasonCode ? (
							<p className="text-red-500 mt-0.5">
								Error Code: {err.ReasonCode}
							</p>
						) : null}
					</div>
				</div>
			))}
		</div>
	);
};
