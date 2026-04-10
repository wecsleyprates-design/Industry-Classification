import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	type Plugin,
	Title,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { type AnyObject } from "yup";
import Card from "../Card";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title);

// const data = {
// 	labels: [
// 		"Jan",
// 		"Feb",
// 		"Mar",
// 		"Apr",
// 		"May",
// 		"Jun",
// 		"Jul",
// 		"Aug",
// 		"Sep",
// 		"Oct",
// 		"Nov",
// 		"Dec",
// 	],
// 	datasets: [
// 		{
// 			data: [12, 15, 25, 10, 20, 18, 20, 22, 24, 30, 34],
// 			backgroundColor: [
// 				"#4CC8E91A",
// 				"#4CC8E933",
// 				"#4CC8E94D",
// 				"#4CC8E966",
// 				"#4CC8E980",
// 				"#4CC8E999",
// 				"#4CC8E9B2",
// 				"#4CC8E9BF",
// 				"#4CC8E9D1",
// 				"#4CC8E9E5",
// 				"#4CC8E9F2",
// 				"#4CC8E9",
// 			],
// 			borderWidth: 1,
// 		},
// 	],
// };

type Props = {
	title?: React.ReactElement;
	data?: any;
	chartOptions?: {
		y?: {
			min: number;
			max: number;
			stepSize: number;
			prefix?: string;
			suffix?: string;
			title?: string;
		};
		labels?: boolean;
		hideLegends?: boolean;
		chartClass?: string;
		x?: {
			display: boolean;
		};
	};
	tooltips?: string[];
};

const BarChart: React.FC<Props> = ({ title, data, chartOptions }) => {
	const [chartData, setChartData] = useState<any>({
		labels: ["N/A"],
		datasets: [
			{
				data: [0],
				backgroundColor: ["#D9D9D9"],
			},
		],
	});

	useEffect(() => {
		if (data) setChartData(data);
	}, [data]);

	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {},
		legend: {
			display: !chartOptions?.hideLegends,
		},
		scales: {
			x: {
				stacked: true,
				display: chartOptions?.x?.display ?? false,
				grid: {
					display: false,
				},
			},
			y: {
				min: chartOptions?.y?.min ?? 0.0,
				max: chartOptions?.y?.max ?? 100.0,
				ticks: {
					stepSize: chartOptions?.y?.stepSize ?? 20,
					callback: function (value: number) {
						return (chartOptions?.y?.prefix ?? chartOptions?.y?.suffix) // here  ?? acts as or as any of the prefix and suffix could be undefiend
							? `${chartOptions?.y.prefix ?? ""}${value}${
									chartOptions?.y.suffix ?? ""
								}  `
							: `${value.toFixed(0)}`; // to add %
					},
				},
				title: {
					display: !!chartOptions?.y?.title,
					text: chartOptions?.y?.title,
				},
				border: { dash: [6, 6], color: "#dfdfdf" },
			},
			xAxes: [
				{
					categoryPercentage: 1.0,
					barPercentage: 1.0,
				},
			],
		},
	};
	const plugins = chartOptions?.labels
		? [ChartDataLabels as Plugin<"bar", AnyObject>]
		: [];

	return (
		<Card
			removeDivider
			headerComponent={title}
			contentComponent={
				<div>
					<div className={chartOptions?.chartClass ?? ""}>
						<Bar
							height={300}
							data={chartData}
							options={options}
							plugins={plugins}
						/>
					</div>
					<div className="flex justify-center w-full">
						<div className="justify-center pt-6 w-[120]">
							{!chartOptions?.hideLegends &&
								chartData?.labels?.map((val: any, index: number) => (
									<div className="flex" key={index}>
										{val !== "N/A" ? (
											<>
												<div
													className="w-4 h-4"
													style={{
														backgroundColor:
															chartData.datasets[0].backgroundColor[index],
													}}
												></div>
												<div className="text-center ml-3 h-8 text-xs text-[#1E1E1E]">
													{val}
												</div>
											</>
										) : (
											<div className="w-full my-6">N/A</div>
										)}
									</div>
								))}
						</div>
					</div>
				</div>
			}
		/>
	);
};

export default BarChart;
