import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import { ArcElement, Chart as ChartJS, type Plugin, Title } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import classNames from "classnames";
import { type AnyObject } from "yup";
import Card from "../Card";

ChartJS.register(ArcElement, Title);

type Props = {
	title: React.ReactElement;
	data?: {
		labels: string[];
		datasets: [
			{
				data: number[];
				backgroundColor: string[];
				datalabels?: any;
				borderWidth?: number;
			},
		];
	};
	chartOptions?: {
		tooltip?: {
			prefix?: string;
			suffix?: string;
		};
		legend?: {
			layout?: "row" | "col";
		};
	};
};

const DonutChart: React.FC<Props> = ({ title, data, chartOptions }) => {
	const [chartData, setChartData] = useState<any>({
		labels: ["N/A"],
		datasets: [
			{
				data: [100],
				backgroundColor: ["#D9D9D9"],
			},
		],
	});
	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			tooltip: false,
		},
	};

	useEffect(() => {
		if (data) setChartData(data);
	}, [data]);

	return (
		<>
			<Card
				headerComponent={title}
				contentComponent={
					<div className="">
						<div className="w-full flex justify-center">
							<div className="w-[300px] ">
								<Pie
									data={chartData}
									options={options}
									plugins={[ChartDataLabels as Plugin<"pie", AnyObject>]}
								/>
							</div>
						</div>
						<div
							className={classNames(
								chartOptions?.legend?.layout === "col"
									? "py-6 grid grid-cols-2 justify-center text-center self-center ml-8 w-full "
									: "flex justify-center gap-12 flex-grow-0 ",
							)}
						>
							{chartData.labels.map((val: any, index: number) => (
								<div className="flex" key={index}>
									{val !== "N/A" ? (
										<>
											<div
												className="h-8 w-3 my-1"
												style={{
													backgroundColor:
														chartData.datasets[0].backgroundColor[index],
												}}
											></div>
											<div className="ml-1 mt-3 h-8 text-xs text-[#474747] ">
												{val}
											</div>
										</>
									) : (
										<div className="w-full my-6 text-[#266EF1]">
											Connect accounts
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				}
			/>
		</>
	);
};

export default DonutChart;
