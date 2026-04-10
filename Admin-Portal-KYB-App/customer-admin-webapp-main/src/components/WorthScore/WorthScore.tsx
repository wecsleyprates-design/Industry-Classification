import FullPageLoader from "@/components/Spinner/FullPageLoader";
import { convertToLocalDate } from "@/lib/helper";
import { type WorthScoreData } from "@/types/worthScore";
import WorthScoreBarChart from "./WorthScoreBarChart";
import WorthScoreWaterfallChart from "./WorthScoreWaterfallChart";

type Props = {
	worthScore: WorthScoreData;
	isLoading: boolean;
	showWorthScore?: boolean;
};

const WorthScore = ({
	worthScore,
	isLoading,
	showWorthScore = true,
}: Props) => {
	return (
		<>
			{isLoading ? (
				<FullPageLoader />
			) : (
				<div className="max-w-md mx-auto overflow-hidden bg-white rounded-xl">
					{showWorthScore ? (
						<div
							className={`text-gray-800 font-semibold mt-2 ml-5 w-full self-center ${
								worthScore?.weighted_score_850
									? ""
									: "flex flex-col items-center"
							}`}
						>
							Worth score
							{worthScore?.weighted_score_850 ? (
								` ${convertToLocalDate(
									worthScore?.created_at,
									"MMM’YY",
								)} (${worthScore?.weighted_score_850.toString()} / 850)`
							) : (
								<div className="font-medium text-[20px]">Pending</div>
							)}
						</div>
					) : (
						<>
							<div className={`text-gray-800 font-semibold mt-2 ml-5 w-full`}>
								Worth score
							</div>
							<span className="mt-2 ml-5 font-bold ">-</span>
						</>
					)}
					<div>
						{
							// for score generated using v1 modal barchart is present for newer versions waterfall chart
						}
						{worthScore?.version === "1.0" ? (
							<WorthScoreBarChart
								worthScore={worthScore}
								isLoading={isLoading}
								showWorthScore={showWorthScore}
							/>
						) : (
							<WorthScoreWaterfallChart
								worthScore={worthScore}
								isLoading={isLoading}
								showWorthScore={showWorthScore}
							/>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export default WorthScore;
