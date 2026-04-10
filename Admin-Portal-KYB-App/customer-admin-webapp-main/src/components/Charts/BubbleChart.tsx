import React, { type FC, type ReactElement, useEffect, useState } from "react";
import { Bubble } from "react-chartjs-2";
import { Chart as ChartJS, LinearScale, PointElement, Tooltip } from "chart.js";
import Card from "../Card";

ChartJS.register(LinearScale, PointElement, Tooltip);

const colourArray = [
	"rgba(0, 7, 85, 0.8)",
	"rgba(85, 41, 168, 0.8)",
	"rgba(158, 41, 168, 0.8)",
	"rgba(41, 115, 168, 0.8)",
	"rgba(76, 200, 233, 0.8)",
	"rgba(0, 7, 85, 0.4)",
	"rgba(85, 41, 168, 0.4)",
	"rgba(158, 41, 168, 0.4)",
	"rgba(41, 115, 168, 0.4)",
	"rgba(76, 200, 233, 0.4)",
];

export const initialData: any = {
	datasets: [
		{
			label: "",
			data: [
				{
					x: 0,
					y: 0,
					r: 0,
				},
			],
			backgroundColor: "",
		},
	],
};

interface IndustryExposureDataObject {
	industry: string;
	count: string;
	average_score: string;
	min_score: string;
	max_score: string;
}

interface IndustryExposureResponse {
	status: string;
	message: string;
	data?: IndustryExposureDataObject[];
}

type Props = {
	title: ReactElement;
	chartData: IndustryExposureResponse["data"];
};

const BubbleChart: FC<Props> = ({ title, chartData }) => {
	const [bubbleChartData, setBubbleChartData] = useState<any>(initialData);
	const [maxValues, setMaxValues] = useState<{
		count: number;
		maxRadius: number;
	}>({ count: 0, maxRadius: 0 });

	const [bubbleChartTooltipData, setBubbleChartTooltipData] = useState<
		string[][]
	>([]);

	useEffect(() => {
		if (chartData && chartData.length > 0) {
			let maxCount = 0;
			let maxRadius = 0;

			chartData.forEach((data: IndustryExposureDataObject) => {
				const count = Number(data.count);
				const maxScoreValue = Number(data.max_score);
				const minScore = Number(data.min_score);
				const radius =
					maxScoreValue - minScore > 0
						? (((maxScoreValue - minScore) / 4) * 300) / 500
						: 1;

				if (count > maxCount) {
					maxCount = count;
				}
				if (radius > maxRadius) {
					maxRadius = radius;
				}
			});

			setMaxValues({ count: maxCount, maxRadius });

			const updatedData = {
				...bubbleChartData,
				datasets: chartData.map(
					(data: IndustryExposureDataObject, index: number) => {
						const count = Number(data.count);
						const maxScoreValue = Number(data.max_score);
						const minScore = Number(data.min_score);

						const radius =
							maxScoreValue - minScore > 0
								? (((maxScoreValue - minScore) / 4) * 300) / 600 > 10
									? (((maxScoreValue - minScore) / 4) * 300) / 600
									: 12
								: 10;

						return {
							label: data.industry,
							data: [
								{
									x: count,
									y: (maxScoreValue + minScore) / 2,
									r: radius,
								},
							],
							backgroundColor: colourArray[index % colourArray.length],
							dataLabels: {
								color: "#fff",
								formatter: function (value: number) {
									return value > 0 ? `${value}%` : "";
								},
							},
						};
					},
				),
			};

			// Check for duplicate count and radius values and adjust radius
			const seenCounts = new Map<number, number>();
			updatedData.datasets.forEach((dataset: any, index: number) => {
				const { x: count, r: radius } = dataset.data[0];
				if (seenCounts.has(count)) {
					const duplicateCount = seenCounts.get(count) as number;
					updatedData.datasets[index].data[0].r =
						Number(radius) + 3 * duplicateCount;
					seenCounts.set(count, duplicateCount + 1);
				} else {
					seenCounts.set(count, 1);
				}
			});

			// Extracting the count data for tooltips
			const tooltipData = chartData.map((data) => [
				`${data.industry}`,
				`Count: ${Number(data.count)}`,
				`Average score: ${Number(data.average_score)}`,
			]);
			setBubbleChartData(updatedData);
			setBubbleChartTooltipData(tooltipData);
		} else {
			setBubbleChartData(initialData);
			setMaxValues({ count: 0, maxRadius: 0 });
			setBubbleChartTooltipData([]);
		}
	}, [chartData]);

	return (
		<Card
			removeDivider
			headerComponent={title}
			contentComponent={
				<>
					<div className="md:flex lg:w-full lg:h-[300px]">
						<Bubble
							height={300}
							width={600}
							options={
								{
									clip: {
										right: false,
										bottom: false,
										top: false,
										left: false,
										height: false,
										width: false,
									},
									plugins: {
										tooltip: {
											callbacks: {
												title: (context: any) => {
													if (bubbleChartTooltipData) {
														return bubbleChartTooltipData[
															context[0]?.datasetIndex
														];
													} else return "";
												},
												label: (context: any) => {
													return "";
												},
											},
										},
									},
									scales: {
										y: {
											beginAtZero: true,
											min: 250,
											max: 850,
											ticks: {
												stepSize: 100,
											},
										},
										x: {
											beginAtZero: true,
											max: Math.round(maxValues.count),
											grid: {
												display: false,
											},
											ticks: {
												stepSize:
													maxValues.count < 5
														? 1
														: Math.ceil(maxValues.count / 5),
											},
										},
									},
								} as any
							}
							data={bubbleChartData}
						/>
					</div>
					<div className="grid grid-cols-3 mx-10 mt-2 text-sm gap-x-3">
						{bubbleChartData.datasets.map((dataset: any, datasetIndex: any) => (
							<div className="flex items-start mb-2" key={datasetIndex}>
								<div
									className="absolute w-4 h-4 mr-1"
									style={{
										backgroundColor: dataset.backgroundColor,
									}}
								/>
								<div className="text-xs text-[#474747] ml-6">
									{dataset.label}
								</div>
							</div>
						))}
					</div>
				</>
			}
		/>
	);
};
export default BubbleChart;
