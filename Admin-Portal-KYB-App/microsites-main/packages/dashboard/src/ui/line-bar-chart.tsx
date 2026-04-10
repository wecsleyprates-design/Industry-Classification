import React from "react";
import { Bar } from "react-chartjs-2";
import {
	BarElement,
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	LineElement,
	type Plugin,
	PointElement,
	Title,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { type AnyObject } from "@/lib/types";

import { Card } from "@/ui/card-old";

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	PointElement,
	LineElement,
);

type Props = {
	title: React.ReactElement;
	data: any; // cannot add custom type as bar chart here merged with line chart as well therefore type any
	legends?: Array<{
		type: "bar" | "line";
		text: string;
		color: string;
	}>;
	chartOptions?: {
		displayIfAllZeros?: string;
		x?: {
			stacked?: boolean;
		};
		y?: {
			beginAtZero?: boolean;
			min?: number;
			max?: number;
			stepSize?: number;
			prefix?: string;
			suffix?: string;
			stacked?: boolean;
			precision?: number;
			maxTicksLimit?: number;
			grace?: string | number;
		};
		y1?: {
			min?: number;
			max?: number;
			stepSize?: number;
		};
		labels?: boolean;
		hideLegends?: boolean;
		chartClass?: string;
	};
};

export const LineBarChart: React.FC<Props> = ({
	data,
	chartOptions,
	legends,
	title,
}) => {
	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {},
		scales: {
			x: {
				stacked: chartOptions?.x?.stacked ?? true,
				grid: {
					display: false,
				},
			},
			y: {
				stacked: chartOptions?.y?.stacked ?? true,
				min:
					typeof chartOptions?.y?.min === "number"
						? Number(chartOptions?.y?.min?.toFixed(2))
						: (chartOptions?.y?.min ?? 0.0),
				max:
					typeof chartOptions?.y?.max === "number"
						? Number(chartOptions?.y?.max?.toFixed(2))
						: (chartOptions?.y?.max ?? 100.0),
				ticks: {
					stepSize: chartOptions?.y?.stepSize ?? 20,
					callback: function (value: number) {
						return value.toFixed(2);
					},
				},
			},
			y1: {
				type: "linear",
				position: "right",
				min:
					typeof chartOptions?.y1?.min === "number"
						? Number(chartOptions?.y1?.min.toFixed(2))
						: (chartOptions?.y1?.min ?? 0.0),
				max:
					typeof chartOptions?.y1?.max === "number"
						? Number(chartOptions?.y1?.max.toFixed(2))
						: (chartOptions?.y1?.max ?? 100.0),
				ticks: {
					stepSize: chartOptions?.y1?.stepSize ?? 20,
					callback: function (value: number) {
						return value.toFixed(2);
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
				<>
					<div>
						<Bar height={250} data={data} options={options} plugins={plugins} />
					</div>
					<div className="flex justify-center my-2">
						{legends?.map((legend, index) => {
							return (
								<div key={index} className="flex gap-1">
									<div
										className={`${
											legend.type === "line" ? "h-8 w-1" : "h-8 w-3"
										} my-1`}
										style={{
											backgroundColor: legend.color,
										}}
									>
										{" "}
									</div>
									<div className="text-center my-auto mx-1 text-xs text-[#474747] ">
										{legend.text}
									</div>
								</div>
							);
						})}
					</div>
				</>
			}
		/>
	);
};
