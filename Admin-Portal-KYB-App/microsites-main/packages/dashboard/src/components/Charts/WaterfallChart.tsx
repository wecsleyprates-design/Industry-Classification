import React, { useState } from "react";
import { Bar } from "react-chartjs-2";
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	LineController,
	LineElement,
	type Plugin,
	PointElement,
	Title,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { type AnyObject } from "yup";
import LongTextWrapper from "../LongTextWrapper";
import TableLoader from "../Spinner/TableLoader";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	LineElement,
	PointElement,
	LineController,
);

type Props = {
	title?: React.ReactElement;
	isLoading?: boolean;
	tooltips?: Array<{
		title: string;
		factors: Array<{ title: string; value: number }>;
	}>;
	data?: {
		labels: string[];
		datasets: Array<{
			data: number[][] | Array<{ x: string; y: number }>;
			backgroundColor?: string[];
			categoryPercentage?: number;
			barPercentage?: number;
			borderWidth?: number;
			padding?: number;
			datalabels?: any;
			type?: "line" | "bar";
			borderSkipped?: boolean;
			borderColor?: string;
			pointBackgroundColor?: string;
			pointBorderColor?: string;
		}>;
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

const WaterfallChart: React.FC<Props> = ({
	title,
	chartOptions,
	isLoading,
	data,
	tooltips,
}) => {
	const [chartData] = useState<any>(data);

	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			tooltip: {
				filter: (tooltipItem: any) => {
					return tooltipItem.datasetIndex === 0;
				},
				displayColors: false,
				callbacks: {
					title: (context: any) => {
						if (tooltips) {
							return tooltips[context[0]?.dataIndex]?.title;
						} else return null;
					},
					label: (context: any) => {
						if (tooltips) {
							return tooltips[context?.dataIndex].factors.map(
								(val) =>
									`${val.title}  ${
										Number(val.value) > 0 ? `+${val.value}` : `${val.value}`
									}`,
							);
						} else {
							const array = JSON.parse(context.formattedValue);
							let renderValue;
							if (context?.dataset?.dataIndex !== 0) {
								if (context?.dataIndex === context?.dataset?.data?.length - 1)
									renderValue = array[0];
								else renderValue = array[1] - array[0];
							}
							return renderValue;
						}
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
				border: {
					display: false,
				},
				ticks: {
					callback: function (value: number) {
						return data?.labels[value].split(" ");
					},
				},
			},
			y: {
				offset: 4,
				min: chartOptions?.y?.min ?? 0.0,
				max: chartOptions?.y?.max ?? 100.0,
				ticks: {
					stepSize: chartOptions?.y?.stepSize ?? 20,
					callback: function (value: number) {
						return value; // to add %
					},
				},
			},
		},
	};
	const plugins = chartOptions?.labels
		? [ChartDataLabels as Plugin<"bar", AnyObject>]
		: [];

	return (
		<>
			{isLoading ? (
				<div className="flex justify-center w-full h-full p-4">
					<TableLoader />
				</div>
			) : chartOptions?.displayIfAllZeros ? (
				<div className="w-full mt-6 text-xs">
					{chartOptions.displayIfAllZeros}
				</div>
			) : (
				<div>
					<div className={chartOptions?.chartClass ?? ""}>
						<Bar
							height={300}
							data={data as any}
							options={options}
							plugins={plugins}
						/>
					</div>

					<div className="w-full mx-10 mt-2 text-sm">
						{!chartOptions?.hideLegends &&
							chartData.labels.map((val: any, index: number) => (
								<div className="flex" key={index}>
									<>
										<div
											className="w-4 h-4"
											style={{
												backgroundColor:
													chartData.datasets[0].backgroundColor[index],
											}}
										></div>
										<div className="ml-1 h-8 text-xs text-[#474747] ">
											{chartOptions?.isTooltipedLegend ? (
												<LongTextWrapper text={val} textVisibleLength={20} />
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
	);
};

export default WaterfallChart;
