import React from "react";
import {
	BuildingLibraryIcon,
	CheckCircleIcon,
	CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

import { CardContent, CardHeader, CardTitle } from "@/ui/card";
import { KeyInsightsSummary } from "@/ui/key-insights";

export interface ActionItemsRecommendationsProps {
	missingTIN: boolean;
	noBankingInfo: boolean;
	noAccountingInfo: boolean;
	keyInsightsSummary: string;
}

export const ActionItemsRecommendations: React.FC<
	ActionItemsRecommendationsProps
> = ({ missingTIN, noBankingInfo, noAccountingInfo, keyInsightsSummary }) => {
	const hasIssues = missingTIN || noBankingInfo || noAccountingInfo;

	return (
		<div className="flex flex-col rounded-lg overflow-hidden">
			<div className="flex flex-col bg-white">
				<div className="p-4">
					<KeyInsightsSummary summary={keyInsightsSummary} />
				</div>
				<CardHeader className="-mt-6">
					<CardTitle className="font-medium">
						Action Items & Recommendations
					</CardTitle>
				</CardHeader>
				<CardContent className="-mt-6">
					<div className="divide-y divide-gray-200">
						{!hasIssues ? (
							<div className="flex items-center py-4">
								<div className="bg-green-100 p-2 rounded-lg mr-4">
									<CheckCircleIcon className="h-6 w-6 text-green-600" />
								</div>
								<span className="text-gray-700 text-sm">
									All information is complete. No action items at this time.
								</span>
							</div>
						) : (
							<>
								{missingTIN && (
									<div className="flex items-center py-4">
										<div className="bg-red-100 p-2 rounded-lg mr-4">
											<span className="text-red-600 font-bold font-mono text-xs">
												123
											</span>
										</div>
										<span className="text-gray-700 text-sm">
											Missing TIN number.
										</span>
									</div>
								)}
								{noBankingInfo && (
									<div className="flex items-center py-4">
										<div className="bg-yellow-100 p-2 rounded-lg mr-4">
											<BuildingLibraryIcon className="h-6 w-6 text-yellow-600" />
										</div>
										<span className="text-gray-700 text-sm">
											No banking information found.
										</span>
									</div>
								)}
								{noAccountingInfo && (
									<div className="flex items-center py-4">
										<div className="bg-gray-100 p-2 rounded-lg mr-4">
											<CurrencyDollarIcon className="h-6 w-6 text-gray-600" />
										</div>
										<span className="text-gray-700 text-sm">
											No accounting information provided.
										</span>
									</div>
								)}
							</>
						)}
					</div>
				</CardContent>
			</div>
		</div>
	);
};
