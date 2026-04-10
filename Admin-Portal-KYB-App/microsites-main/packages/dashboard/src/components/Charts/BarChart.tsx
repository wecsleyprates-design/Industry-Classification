import React, { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	type Plugin,
	Title,
	Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { twMerge } from "tailwind-merge";
import { type AnyObject } from "yup";
import { formatPriceWithSuffix } from "@/lib/helper";
import Card from "../Card";
import LongTextWrapper from "../LongTextWrapper";
import TableLoader from "../Spinner/TableLoader";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

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
	isLoading?: boolean;
	data: {
		labels: string[];
		datasets: [
			{
				data: number[];
				backgroundColor: string[];
				categoryPercentage?: number;
				barPercentage?: number;
				borderWidth?: number;
				datalabels?: any;
			},
		];
	};
	chartOptions?: {
		displayIfAllZeros?: string;
		y?: {
			min: number;
			max: number;
			stepSize: number;
			prefix?: string;
			suffix?: string;
		};
		labels?: boolean;
		hideLegends?: boolean;
		chartClass?: string;
		x?: {
			display: boolean;
		};
		isTooltipedLegend?: boolean;
	};
};

const BarChart: React.FC<Props> = ({
	title,
	data,
	chartOptions,
	isLoading,
}) => {
	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			tooltip: {
				callbacks: {
					title: (context: any) => {
						return null;
					},
					label: (context: any) => {
						return Number(context.formattedValue.replaceAll(",", ""));
					},
				},
			},
		},
		legend: {
			display: chartOptions?.hideLegends,
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
						return formatPriceWithSuffix(value); // to add %
					},
				},
			},
		},
	};
	const plugins = chartOptions?.labels
		? [ChartDataLabels as Plugin<"bar", AnyObject>]
		: [];

	const isAllZeros = useMemo(
		() => data.datasets[0].data.every((val) => val === 0),
		[data],
	);

	return (
		<Card
			headerComponent={title}
			contentComponent={
				<>
					{isLoading ? (
						<div
							className={twMerge(
								"flex justify-center content-center align-middle items-center place-content-center w-full h-full p-4",
								chartOptions?.chartClass ?? "",
							)}
						>
							<TableLoader />
						</div>
					) : chartOptions?.displayIfAllZeros && isAllZeros ? (
						<div className="w-full mt-6 text-xs">
							{chartOptions.displayIfAllZeros}
						</div>
					) : (
						<div>
							<div className={chartOptions?.chartClass ?? ""}>
								<Bar
									height={300}
									data={data}
									options={options}
									plugins={plugins}
								/>
							</div>

							<div className="w-full mx-10 mt-2 text-sm">
								{!chartOptions?.hideLegends &&
									data.labels.map((val: any, index: number) => (
										<div className="flex" key={index}>
											<>
												<div
													className="w-4 h-4"
													style={{
														backgroundColor:
															data.datasets[0].backgroundColor[index],
													}}
												></div>
												<div className="ml-1 h-8 text-xs text-[#474747] ">
													{chartOptions?.isTooltipedLegend ? (
														<LongTextWrapper
															text={val}
															textVisibleLength={20}
														/>
													) : (
														val
													)}
												</div>
											</>
										</div>
									))}
							</div>
						</div>
					)}
				</>
			}
		/>
	);
};

export default BarChart;
