import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
	CategoryScale,
	Chart as ChartJS,
	LinearScale,
	LineElement,
	PointElement,
	Title,
	Tooltip,
} from "chart.js";
import { twMerge } from "tailwind-merge";
import Card from "../Card";
import TableLoader from "../Spinner/TableLoader";

ChartJS.register(
	PointElement,
	LineElement,
	CategoryScale,
	Title,
	Tooltip,
	LinearScale,
);

const labels = [
	"",
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const initialData = {
	labels,
	datasets: [
		{
			data: [4.1, 4.3, 4, 4.1, 4.3, 4.4, 4.5, 4.2, 4.2, 4.5, 4.6, 4.7],
			borderColor: "#000",
			backgroundColor: "#000",
		},
	],
};

type LineChartProps = {
	title: React.ReactElement;
	data: Array<{ data: number[]; borderColor: string; backgroundColor: string }>;
	isLoading?: boolean;
	chartOptions?: {
		y: {
			min: number;
			max: number;
			stepSize: number;
			prefix?: string;
			format?: string;
			suffix?: string;
			beginAtZero?: boolean;
		};
		chartClass?: string;
		componentClass?: string;
		labels?: boolean;
		legends?: Array<{ backgroundColor: string; text: string; dim?: string }>;
	};
	chartLabels?: string[];
};

const LineChart: React.FC<LineChartProps> = ({
	title,
	data,
	chartOptions,
	chartLabels,
	isLoading,
}) => {
	const [chartData, setChartData] = useState(initialData);
	useEffect(() => {
		if (data) {
			setChartData({
				labels: chartLabels ?? labels,
				datasets: data,
			});
		}
	}, [data]);

	const options: any = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			title: {
				display: false,
			},
			tooltip: {
				callbacks: {
					title: (context: any) => {
						return null;
					},
					label: (context: any) => {
						return context?.label === ""
							? ""
							: chartOptions?.y.format === "number"
								? Number(context.formattedValue).toFixed(1)
								: context.formattedValue;
					},
				},
			},
		},
		scales: {
			x: {
				beginAtZero: true,
				grid: {
					display: false,
				},
			},
			y: {
				beginAtZero: true,
				min: chartOptions?.y.min ?? 0.0,
				max: chartOptions?.y.max ?? 100.0,
				ticks: {
					stepSize: chartOptions?.y.stepSize ?? 20,
					callback: function (value: number) {
						return chartOptions?.y.format === "number"
							? value.toFixed(1)
							: value;
					},
				},
			},
		},
		legend: {
			display: false,
		},
	};
	return (
		<Card
			headerComponent={title}
			removeDivider
			contentComponent={
				<>
					{isLoading ? (
						<div
							className={twMerge(
								"flex justify-center content-center align-middle items-center place-content-center w-full h-full p-4",
								chartOptions?.componentClass ?? "",
							)}
						>
							<TableLoader />
						</div>
					) : (
						<div className={chartOptions?.componentClass ?? "h-full"}>
							<div className="flex justify-center w-full">
								<div
									className={`w-full ${
										chartOptions?.chartClass ?? "h-[250px]"
									}`}
								>
									<Line height={200} options={options} data={chartData} />
								</div>
							</div>
							<div className="flex justify-center w-full mt-8 gap-x-6">
								{chartOptions?.legends?.map((val: any, index: number) => (
									<div className="flex" key={index}>
										<>
											<div
												className={val.dim ?? "h-6 w-2 -translate-y-0.5"}
												style={{
													backgroundColor: val.backgroundColor,
												}}
											></div>
											<div className="ml-1 h-8 text-xs text-[#474747] ">
												{val.text}
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
export default LineChart;
