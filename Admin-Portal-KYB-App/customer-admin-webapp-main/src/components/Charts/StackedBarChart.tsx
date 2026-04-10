import React from "react";
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

type Props = {
	title?: React.ReactElement;
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
				label: string;
			},
		];
	};
	chartOptions?: {
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
	};
};
const StackedBarChart: React.FC<Props> = ({ title, data, chartOptions }) => {
	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {},
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
				stacked: true,
				min: chartOptions?.y?.min ?? 0.0,
				max: chartOptions?.y?.max ?? 100.0,
				ticks: {
					stepSize: chartOptions?.y?.stepSize ?? 20,
					callback: function (value: number) {
						return (chartOptions?.y?.prefix ?? chartOptions?.y?.suffix) // here  ?? acts as or as any of the prefix and suffix could be undefiend
							? `${chartOptions?.y.prefix ?? ""}${value}${
									chartOptions?.y.suffix ?? ""
								}  `
							: `${value.toFixed(1)}`; // to add %
					},
				},
			},
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
						<Bar height={300} data={data} options={options} plugins={plugins} />
					</div>
					<div className="w-full mx-10 mt-10 text-sm">
						{!chartOptions?.hideLegends &&
							data.datasets.map((dataset, datasetIndex) => (
								<div className="flex" key={datasetIndex}>
									<>
										<div
											className="w-4 h-4"
											style={{
												backgroundColor: dataset.backgroundColor[0], // Assuming all bars in a dataset have the same background color
											}}
										></div>
										<div className="ml-1 h-8 text-xs text-[#474747] ">
											{dataset.label}
										</div>
									</>
								</div>
							))}
					</div>
				</div>
			}
		/>
	);
};

export default StackedBarChart;
