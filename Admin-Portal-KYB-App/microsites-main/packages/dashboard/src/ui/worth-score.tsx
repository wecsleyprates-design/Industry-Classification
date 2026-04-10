import {
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";

export interface WorthScoreProps {
	score: number;
	maxScore?: number;
	generatedDate?: string;
	modelVersion?: string;
}

export function WorthScore({
	score,
	maxScore = 850,
	generatedDate,
	modelVersion = "2.1",
}: WorthScoreProps) {
	const getRiskLevel = (score: number) => {
		if (score >= 700) return "Low Risk";
		if (score >= 500) return "Moderate Risk";
		return "High Risk";
	};

	const getRiskIcon = (score: number) => {
		if (score >= 700)
			return <CheckCircleIcon className="h-6 w-6 text-green-600" />;
		if (score >= 500)
			return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />;
		return <ExclamationCircleIcon className="h-6 w-6 text-red-600" />;
	};

	const getCarrotPosition = (score: number) => {
		const percentage = (score / maxScore) * 100;

		// Each section is 32% wide, with 1.5px gaps
		// Adjust percentage based on which third we're in
		let adjustedPosition;
		if (percentage <= 33.33) {
			// First third - scale within 0-32%
			adjustedPosition = (percentage * 32) / 33.33;
		} else if (percentage <= 66.66) {
			// Second third - scale within 33.5-65.5%
			adjustedPosition = 32 + 1.5 + ((percentage - 33.33) * 32) / 33.33;
		} else {
			// Final third - scale within 67-99%
			adjustedPosition = 64 + 3 + ((percentage - 66.66) * 32) / 33.33;
		}

		return `${adjustedPosition}%`;
	};

	const getBarColors = (score: number) => {
		if (score >= 700) {
			return {
				red: "bg-red-200",
				yellow: "bg-yellow-100",
				green: "bg-green-600",
			};
		} else if (score >= 500) {
			return {
				red: "bg-red-200",
				yellow: "bg-yellow-400",
				green: "bg-green-200",
			};
		}
		return {
			red: "bg-red-600",
			yellow: "bg-yellow-100",
			green: "bg-green-200",
		};
	};

	const carrotPosition = getCarrotPosition(score);
	const barColors = getBarColors(score);

	const formattedDate = generatedDate
		? dayjs(generatedDate).format("MM/DD/YY")
		: null;

	return (
		<div className="bg-white rounded-2xl px-4 py-6 shadow">
			<h2 className="text-sm font-normal text-gray-500 mb-2">CASE RESULTS</h2>

			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2">
					<span className="text-xl">{getRiskLevel(score)}</span>
					{getRiskIcon(score)}
				</div>

				<div className="text-sm font-normal text-gray-500">
					Worth Score: {score}/{maxScore}*
				</div>

				<div className="relative h-2 rounded-full my-2">
					<div
						className="absolute w-0 h-0 -top-3"
						style={{ left: carrotPosition }}
					>
						<div className="w-0 h-0 border-x-8 border-x-transparent border-t-[8px] border-gray-800"></div>
					</div>
					<div className="absolute top-0 left-0 h-full w-full flex gap-1.5">
						<div
							className={`h-3.5 rounded-full ${barColors.red} w-[32%]`}
						></div>
						<div
							className={`h-3.5 rounded-full ${barColors.yellow} w-[32%]`}
						></div>
						<div
							className={`h-3.5 rounded-full ${barColors.green} w-[32%]`}
						></div>
					</div>
				</div>

				{formattedDate && (
					<div className="text-xs text-gray-500 mt-2">
						* Generated on {formattedDate} using Model {modelVersion}
					</div>
				)}
			</div>
		</div>
	);
}
