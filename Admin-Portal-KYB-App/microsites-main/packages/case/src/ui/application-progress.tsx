import { Card, CardContent } from "./card";
import { Progress } from "./progress";

export interface ApplicationProgressProps {
	percentComplete: number;
	isSubmitted: boolean;
}

export function ApplicationProgress({
	percentComplete,
	isSubmitted,
}: ApplicationProgressProps) {
	const isReadyToSubmit = percentComplete === 100 && !isSubmitted;

	return (
		<Card>
			<CardContent className="pt-6 space-y-4">
				<h2 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
					Application Progress
				</h2>

				<p className="text-2xl font-semibold text-gray-800">
					{isReadyToSubmit ? "Ready to submit" : "In progress"}
				</p>

				<div className="space-y-2">
					<Progress value={percentComplete} />
					<p className="text-sm font-normal text-blue-700">
						{percentComplete}% Completed
						{isReadyToSubmit &&
							". Application is complete and all required fields have been provided. Review the information and submit if needed."}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
