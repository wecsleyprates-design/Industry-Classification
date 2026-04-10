import { type ReactNode } from "react";

import { Card, CardContent } from "@/ui/card";

interface WorthScorePendingStateProps {
	workflowDecision?: string;
	workflowDecisionColor?: string;
	children?: ReactNode;
}

const WorthScorePendingState = ({
	workflowDecision,
	workflowDecisionColor,
	children,
}: WorthScorePendingStateProps) => {
	return (
		<Card>
			<CardContent className="pt-6">
				<h2 className="mb-2 text-xs font-semibold text-gray-500">
					CASE RESULTS
				</h2>
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<span className="text-xl font-semibold text-gray-800">
							Pending
						</span>
					</div>
					<div className="text-sm font-normal text-gray-500">
						Worth Score: -
					</div>
					{workflowDecision && (
						<div className="text-sm font-normal text-gray-500">
							Decision:
							<span
								className={`text-xs font-semibold capitalize ${workflowDecisionColor}`}
							>
								{` ${workflowDecision
									.toLowerCase()
									.replaceAll("_", " ")}.`}
							</span>
						</div>
					)}
					<div className="relative h-2 my-2 rounded-full">
						<div className="absolute top-0 left-0 h-full w-full flex gap-1.5">
							<div className="h-3.5 rounded-full bg-gray-100 w-[32%]" />
							<div className="h-3.5 rounded-full bg-gray-100 w-[32%]" />
							<div className="h-3.5 rounded-full bg-gray-100 w-[32%]" />
						</div>
					</div>
				</div>
				{children}
			</CardContent>
		</Card>
	);
};
export default WorthScorePendingState;
