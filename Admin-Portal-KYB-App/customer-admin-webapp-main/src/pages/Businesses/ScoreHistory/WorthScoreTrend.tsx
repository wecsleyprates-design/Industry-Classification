import React from "react";
import LineChart from "@/components/Charts/LineChart";
import DateSelector from "@/components/MonthSelector/DateSelector";

interface Props {
	scoreTrendDate: Date;
	updateScoreTrendDate: (date: Date) => void;
	scoreTrendParsedData: any;
}

const WorthScoreTrend: React.FC<Props> = ({
	scoreTrendDate,
	scoreTrendParsedData,
	updateScoreTrendDate,
}) => {
	return (
		<div>
			<LineChart
				chartOptions={{
					y: { min: 350, max: 850, stepSize: 100, beginAtZero: true },
				}}
				title={
					<div className="flex justify-between">
						<div className="flex flex-col">
							<div className="text-base font-semibold">Worth Score</div>
						</div>
						<div className="flex flex-row items-center pr-5 text-xs gap-x-1">
							<DateSelector
								date={scoreTrendDate}
								updateDate={updateScoreTrendDate}
								type="year"
								width="80px"
							/>
						</div>
					</div>
				}
				data={[
					{
						data: scoreTrendParsedData,
						borderColor: "#000",
						backgroundColor: "#000",
					},
				]}
			/>
		</div>
	);
};

export default WorthScoreTrend;
