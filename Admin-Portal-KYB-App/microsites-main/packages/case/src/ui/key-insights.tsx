import React from "react";
import {
	ArrowTrendingUpIcon,
	BuildingLibraryIcon,
	ChartBarIcon,
	IdentificationIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";

import { Skeleton } from "@/ui/skeleton";

interface ReportBreakDown {
	impactOfCompanyProfileScore: string;
	impactOfFinancialTrendsScore: string;
	impactOfPublicRecordsScore: string;
	impactOfWorthScore: string;
}

export interface KeyInsightsProps {
	summary: string;
	reportBreakDown: ReportBreakDown;
	isLoading: boolean;
}

export const KeyInsightsSummary: React.FC<{
	summary: string;
	isLoading: boolean;
}> = ({ summary, isLoading }) => (
	<div className="flex flex-col bg-blue-50 p-4 rounded-lg gap-2">
		<div className="flex items-start">
			<span className="mr-2">
				<SparklesIcon className="h-6 w-6 text-blue-600" />
			</span>
			<h2 className="text-md text-blue-600 font-medium flex items-center mb-2">
				Key Insights
			</h2>
		</div>
		{isLoading ? (
			<div className="space-y-2">
				<Skeleton className="h-4 w-full bg-blue-200/50" />
				<Skeleton className="h-4 w-11/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-11/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-11/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-full bg-blue-200/50" />
				<Skeleton className="h-4 w-10/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-9/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-9/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-10/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-10/12 bg-blue-200/50" />
				<Skeleton className="h-4 w-9/12 bg-blue-200/50" />
			</div>
		) : (
			<p className="text-blue-500 mb-2 text-sm leading-relaxed">
				{summary}
			</p>
		)}
	</div>
);

export const KeyInsights: React.FC<KeyInsightsProps> = ({
	summary,
	reportBreakDown,
	isLoading,
}) => {
	return (
		<div className="bg-white rounded-lg flex flex-col gap-4">
			<KeyInsightsSummary summary={summary} isLoading={isLoading} />
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
							{reportBreakDown.impactOfWorthScore}
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
		</div>
	);
};
