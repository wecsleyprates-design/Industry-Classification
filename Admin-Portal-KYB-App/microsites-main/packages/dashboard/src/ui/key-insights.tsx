import React, { useState } from "react";
import {
	ArrowTrendingUpIcon,
	BuildingLibraryIcon,
	ChartBarIcon,
	IdentificationIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/ui/button";

interface ReportBreakDown {
	impactOfCompanyProfileScore: string;
	impactOfFinancialTrendsScore: string;
	impactOfPublicRecordsScore: string;
}

export interface KeyInsightsProps {
	worthScore: number;
	summary: string;
	reportBreakDown: ReportBreakDown;
}

export const KeyInsightsSummary: React.FC<{ summary: string }> = ({
	summary,
}) => (
	<div className="flex flex-col bg-blue-50 p-4 rounded-lg gap-2">
		<div className="flex items-start">
			<span className="mr-2">
				<SparklesIcon className="w-8 h-8 text-blue-600" />
			</span>
			<h2 className="text-md text-blue-600 font-medium flex items-center mb-2">
				Key Insights
			</h2>
		</div>
		<p className="text-blue-500 mb-2 text-md leading-relaxed">{summary}</p>
	</div>
);

export const KeyInsights: React.FC<KeyInsightsProps> = ({
	worthScore,
	summary,
	reportBreakDown,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const toggleExpand = () => {
		setIsExpanded(!isExpanded);
	};

	return (
		<div className="bg-white rounded-lg flex flex-col gap-4">
			<KeyInsightsSummary summary={summary} />
			{isExpanded && (
				<div className="flex flex-col gap-6">
					<div className="flex items-start">
						<span className="mr-4 bg-pink-50 p-2 rounded-lg flex-shrink-0">
							<ChartBarIcon className="w-6 h-6 text-pink-500" />
						</span>
						<div className="flex flex-col">
							<h3 className="text-md font-semibold text-gray-800">
								Worth Score
							</h3>
							<p className="text-gray-500 text-sm leading-relaxed">
								The overall Worth Score is{" "}
								<span className="font-semibold text-gray-800">
									{worthScore}
								</span>
								, indicating a {worthScore > 500 ? "high" : "moderate"} level of
								business health.
							</p>
						</div>
					</div>

					<div className="flex items-start">
						<span className="mr-4 bg-yellow-50 p-2 rounded-lg flex-shrink-0">
							<IdentificationIcon className="w-6 h-6 text-yellow-500" />
						</span>
						<div className="flex flex-col">
							<h3 className="text-md font-semibold text-gray-800">
								Company Profile
							</h3>
							<p className="text-gray-500 text-sm leading-relaxed">
								{reportBreakDown.impactOfCompanyProfileScore}
							</p>
						</div>
					</div>

					<div className="flex items-start">
						<span className="mr-4 bg-green-50 p-2 rounded-lg flex-shrink-0">
							<ArrowTrendingUpIcon className="w-6 h-6 text-green-500" />
						</span>
						<div className="flex flex-col">
							<h3 className="text-md font-semibold text-gray-800">
								Financial Trends
							</h3>
							<p className="text-gray-500 text-sm leading-relaxed">
								{reportBreakDown.impactOfFinancialTrendsScore}
							</p>
						</div>
					</div>

					<div className="flex items-start">
						<span className="mr-4 bg-gray-50 p-2 rounded-lg flex-shrink-0">
							<BuildingLibraryIcon className="w-6 h-6 text-gray-500" />
						</span>
						<div className="flex flex-col">
							<h3 className="text-md font-semibold text-gray-800">
								Public Records
							</h3>
							<p className="text-gray-500 text-sm leading-relaxed">
								{reportBreakDown.impactOfPublicRecordsScore}
							</p>
						</div>
					</div>
				</div>
			)}
			<Button
				onClick={toggleExpand}
				variant="outline"
				className="w-auto mx-auto"
			>
				{isExpanded ? "Collapse" : "Expand"}
			</Button>
		</div>
	);
};
