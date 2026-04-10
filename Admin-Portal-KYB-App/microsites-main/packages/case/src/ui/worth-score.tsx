import {
	CheckCircleIcon,
	ExclamationCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { Card, CardContent } from "./card";

import { Skeleton } from "@/ui/skeleton";

export interface WorthScoreProps {
	score: number;
	maxScore?: number;
	generatedDate?: string;
	modelVersion?: string;
	isLoading?: boolean;
	riskLevel?: "HIGH" | "MODERATE" | "LOW";
	children?: React.ReactNode;
	workflowDecision?: string;
	workflowDecisionColor?: string;
}

export function WorthScore({
	score,
	maxScore = 850,
	generatedDate,
	modelVersion = "2.1",
	isLoading = false,
	riskLevel,
	children,
	workflowDecision,
	workflowDecisionColor,
}: WorthScoreProps) {
	const getRiskLevel = (riskLevel?: "HIGH" | "MODERATE" | "LOW") => {
		if (riskLevel === "LOW") return "Low Risk";
		if (riskLevel === "HIGH") return "High Risk";
		return "Moderate Risk";
	};

	const getRiskIcon = (riskLevel?: "HIGH" | "MODERATE" | "LOW") => {
		if (riskLevel === "LOW")
			return <CheckCircleIcon className="w-6 h-6 text-green-600" />;
		if (riskLevel === "HIGH")
			return <ExclamationCircleIcon className="w-6 h-6 text-red-600" />;
		return <ExclamationTriangleIcon className="w-6 h-6 text-yellow-400" />;
	};

	const getCarrotPosition = (riskLevel?: "HIGH" | "MODERATE" | "LOW") => {
		let adjustedPosition;
		if (riskLevel === "LOW") {
			// Low risk section
			adjustedPosition = 80;
		} else if (riskLevel === "HIGH") {
			// High risk section
			adjustedPosition = 15;
		} else {
			// Moderate risk section
			adjustedPosition = 48;
		}
		return `${adjustedPosition}%`;
	};

	const getBarColors = (riskLevel?: "HIGH" | "MODERATE" | "LOW") => {
		if (riskLevel === "LOW") {
			return {
				red: "bg-red-200",
				yellow: "bg-yellow-100",
				green: "bg-green-600",
			};
		} else if (riskLevel === "HIGH") {
			return {
				red: "bg-red-600",
				yellow: "bg-yellow-100",
				green: "bg-green-200",
			};
		} else {
			return {
				red: "bg-red-200",
				yellow: "bg-yellow-400",
				green: "bg-green-200",
			};
		}
	};

	const carrotPosition = getCarrotPosition(riskLevel);
	const barColors = getBarColors(riskLevel);

	const formattedDate = generatedDate
		? dayjs(generatedDate).format("MM/DD/YY")
		: null;

	if (isLoading) {
		return (
			<Card>
				<CardContent className="pt-6">
					<Skeleton className="w-24 h-4 mb-4" />

					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-2">
							<Skeleton className="w-24 h-8" />
							<Skeleton className="w-6 h-6 rounded-full" />
						</div>

						<Skeleton className="h-4 w-36" />

						<div className="relative h-2 my-2 rounded-full">
							<div className="absolute top-0 left-0 h-full w-full flex gap-1.5">
								<Skeleton className="h-3.5 rounded-full w-[32%]" />
								<Skeleton className="h-3.5 rounded-full w-[32%]" />
								<Skeleton className="h-3.5 rounded-full w-[32%]" />
							</div>
						</div>

						<Skeleton className="w-48 h-3 mt-2" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardContent className="pt-6">
				<h2 className="mb-2 text-xs font-semibold text-gray-500">
					CASE RESULTS
				</h2>

				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<span className="text-2xl font-medium">
							{getRiskLevel(riskLevel)}
						</span>
						{getRiskIcon(riskLevel)}
					</div>

					<div className="text-sm font-normal text-gray-500">
						Worth Score: {score}/{maxScore}*
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
						<div className="mt-2 text-xs text-gray-500">
							* Generated on {formattedDate} using Model{" "}
							{modelVersion}
						</div>
					)}
				</div>
				{children}
			</CardContent>
		</Card>
	);
}
