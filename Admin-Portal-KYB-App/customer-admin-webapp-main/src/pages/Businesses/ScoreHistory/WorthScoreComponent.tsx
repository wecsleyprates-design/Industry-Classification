import React, { type FC } from "react";
import { InformationCircleIcon } from "@heroicons/react/20/solid";
import DateSwitcherList from "@/components/MonthSelector/DateSwitcherList";
import TableLoader from "@/components/Spinner/TableLoader";
import WorthInfoTooltip from "@/components/Tooltip/WorthInfoTooltip";
import WorthScoreBarChart from "@/components/WorthScore/WorthScoreBarChart";
import WorthScoreWaterfallChart from "@/components/WorthScore/WorthScoreWaterfallChart";
import { convertToLocalDate } from "@/lib/helper";
import { type WorthScoreWaterfallResponse } from "@/types/worthScore";

interface Props {
	wortScoreData?: WorthScoreWaterfallResponse;
	isLoading: boolean;
	type: "month" | "year";
	date: Date;
	hasNext: boolean;
	hasPrevious: boolean;
	updateDate: (type: "month" | "year", value: 1 | -1) => void;
	scoreIds: Array<{
		date: Date;
		score_trigger_id: string;
	}>;
	updateScoreId: (id?: string) => void;
}

const WorthScoreComponent: FC<Props> = ({
	wortScoreData,
	isLoading,
	date,
	hasNext,
	hasPrevious,
	updateDate,
	scoreIds,
	updateScoreId,
}) => {
	return (
		<div className="p-4 my-4 border rounded-lg">
			{wortScoreData?.data?.is_score_calculated ? (
				<div className="flex font-semibold text-[#1F2A37]">
					My Worth Score
					<div className="self-center pl-1 text-xs text-gray-400">
						on{" "}
						{wortScoreData?.data?.weighted_score_850 &&
							` ${convertToLocalDate(
								wortScoreData?.data.created_at,
								"MMM DD, YYYY",
							)}`}
					</div>
				</div>
			) : (
				<div className="flex justify-start">
					My Worth Score
					{/* <div className="text-[#266EF1] text-xs py-1 cursor-pointer">
									Download Report
								</div> */}
				</div>
			)}

			<div className="flex justify-between">
				<div>
					<span className="flex gap-1 text-[36px] ">
						{wortScoreData?.data?.weighted_score_850
							? wortScoreData?.data.weighted_score_850
							: "N/A"}{" "}
						<div className="w-5 h-5">
							<WorthInfoTooltip tooltip="The Worth score leverages real-time financial data from over 1000+ data points to generate a comprehensive business credit profile, providing you with visibility into the overall health of your business. The categories shown on hover indicate the areas that had the biggest impact on your score.">
								<InformationCircleIcon className="w-5 h-5 my-2 text-black" />
							</WorthInfoTooltip>
						</div>
						<div className="my-2">
							<div className="self-center text-sm text-gray-500 ">N/A</div>
							{/* <div className="flex self-center">
												<span className="h-full my-1 mr-1 align-middle">
													<UpIcon upsideDown={false} />
												</span>
												<div className="text-[#15803D] font-bold text-sm">
													8
												</div>
											</div> */}
							<div className="text-[10px] text-[#747B90] font-medium">
								Last month
							</div>
						</div>
					</span>
				</div>
				<div className="flex items-center ">
					<DateSwitcherList
						type="month"
						date={new Date(wortScoreData?.data.created_at ?? new Date())}
						updateDate={updateDate}
						hasNext={hasNext}
						hasPrevious={hasPrevious}
						scoreIds={scoreIds}
						updateScoreId={updateScoreId}
					/>
				</div>
			</div>
			{wortScoreData?.data ? (
				wortScoreData?.data?.version === "1.0" ? (
					<WorthScoreBarChart
						worthScore={wortScoreData.data}
						isLoading={isLoading}
					/>
				) : (
					<WorthScoreWaterfallChart
						worthScore={wortScoreData.data}
						isLoading={isLoading}
					/>
				)
			) : (
				<div className="h-[450px] flex justify-center w-full content-center align-middle text-center items-center">
					<TableLoader />
				</div>
			)}
		</div>
	);
};

export default WorthScoreComponent;
