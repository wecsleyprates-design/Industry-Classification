import React, { useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { type WorthScoreData } from "@/types/worthScore";
import DateSwitcherList from "../MonthSelector/DateSwitcherList";
import WorthScoreBarChart from "./WorthScoreBarChart";
import WorthScoreWaterfallChart from "./WorthScoreWaterfallChart";

type TooltipProps = {
	children: React.ReactNode;
	worthScore?: WorthScoreData;
	type: "month" | "year";
	date: Date;
	hasNext: boolean;
	hasPrevious: boolean;
	updateDate: (type: "month" | "year", value: 1 | -1) => void;
	scoreIds: Array<{
		date: Date;
		score_trigger_id: string;
	}>;
	updateScoreId?: (id?: string) => void;
	showTooltip: boolean;
	showWorthScore?: boolean;
};

const WorthScoreTooltip: React.FC<TooltipProps> = ({
	children,
	worthScore,
	type,
	date,
	hasNext,
	hasPrevious,
	updateDate,
	scoreIds,
	updateScoreId,
	showTooltip,
	showWorthScore = true,
}) => {
	// State to track the hover state
	const [isHovered, setIsHovered] = useState(false);
	const childrenRef = useRef(null);

	// Handler functions for hover events
	const handleMouseEnter = () => {
		setIsHovered(true);
	};
	const handleMouseLeave = () => {
		setIsHovered(false);
	};

	return (
		<div
			className="relative inline-block group"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<div ref={childrenRef}>{children}</div>
			<>
				{showTooltip ? (
					<div
						className={twMerge(
							`z-50 cursor-pointer absolute top-2 ml-auto mr-auto min-w-max scale-0 transform rounded-lg px-3 py-2 text-xs font-medium transition-all duration-500 group-hover:scale-100 translate-x-5`,
							isHovered ? "scale-100 translate-x-5" : "scale-0",
						)}
					>
						<div className="flex flex-col items-center rounded-lg shadow-md shadow-gray-700 -translate-x-44 md:-translate-x-80 sm:-translate-x-72">
							{" "}
							<div className="z-50 p-2 text-xs text-center text-white bg-white rounded">
								<div className="flex flex-row justify-around p-2 space-x-6">
									<p className="text-[#1F2A37] text-base tracking-tight font-semibold">
										Worth Score
									</p>
									<p className="text-[#1F2A37] text-base tracking-tight font-semibold">
										<div className="overflow-hidden tracking-tight break-words">
											<div className="flex flex-row">
												<span className="font-bold">
													{worthScore?.weighted_score_850 ?? 0}&nbsp;
												</span>
												/ 850
											</div>
										</div>
									</p>
									<p className="text-[#1F2A37] text-base font-semibold">
										<DateSwitcherList
											type="month"
											date={date}
											updateDate={updateDate}
											hasNext={hasNext}
											hasPrevious={hasPrevious}
											scoreIds={scoreIds}
											updateScoreId={updateScoreId}
										/>
									</p>
								</div>
								{worthScore?.version === "1.0" ? (
									<WorthScoreBarChart
										worthScore={worthScore}
										isLoading={false}
										showWorthScore={showWorthScore}
									/>
								) : (
									<WorthScoreWaterfallChart
										worthScore={worthScore}
										isLoading={false}
										showWorthScore={showWorthScore}
									/>
								)}
							</div>
						</div>
					</div>
				) : null}
			</>
		</div>
	);
};

export default WorthScoreTooltip;
