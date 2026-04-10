import React, { useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
	ArcElement,
	Chart as ChartJS,
	type Plugin,
	Title,
	Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { type AnyObject } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Card } from "@/ui/card-old";

ChartJS.register(ArcElement, Title, Tooltip);

type Props = {
	title: React.ReactElement;
	centerComponent?: React.ReactElement;
	data?: {
		labels: string[];
		datasets: Array<{
			data: number[];
			backgroundColor: string[];
			datalabels?: any;
			borderWidth?: number;
			borderRadius: {
				topRight: number;
				bottomRight: number;
				bottomLeft: number;
				topLeft: number;
			};
			borderSkipped: boolean;
		}>;
	};
	chartOptions?: {
		tooltip?: {
			isVisible?: boolean;
			prefix?: string;
			suffix?: string;
		};
		labels?: boolean;
		cutout?: string;
		legend?: {
			layout?: "row" | "col";
			position?: "left" | "center";
		};
		chartClass?: string;
	};
	tooltips?: string[];
};

const DonutChart: React.FC<Props> = ({
	title,
	data,
	centerComponent,
	chartOptions,
	tooltips,
}) => {
	const [chartData, setChartData] = useState<any>({
		labels: ["N/A"],
		hideLegend: false,
		datasets: [
			{
				data: [100],
				backgroundColor: ["#D9D9D9"],
			},
		],
	});
	const donutChartOptions: any = {
		type: "doughnut",
		responsive: true,
		cutout: chartOptions?.cutout,
		maintainAspectRatio: false,
		plugins: {
			tooltip: chartOptions?.tooltip?.isVisible
				? {
						displayColors: false,
						callbacks: {
							title: (context: any) => {
								if (tooltips) {
									return tooltips[context[0]?.dataIndex];
								} else return null;
							},
							label: () => {
								return null;
							},
						},
					}
				: false,
		},
		layout: {
			padding: 30,
		},
	};

	useEffect(() => {
		if (data) setChartData(data);
	}, [data]);

	return (
		<>
			<Card
				removeDivider
				headerComponent={title}
				contentComponent={
					<div className="relative mt-4 overflow-visible">
						<div className="relative overflow-visible">
							<div className="absolute left-0 right-0 m-auto top-[40%]">
								{centerComponent}
							</div>
							<div className="flex justify-center w-full overflow-visible">
								<div className={chartOptions?.chartClass}>
									<Doughnut
										data={chartData}
										options={donutChartOptions}
										plugins={[ChartDataLabels as Plugin<"doughnut", AnyObject>]}
									/>
								</div>
							</div>
						</div>
						<div className="flex justify-center w-full">
							<div
								className={cn(
									chartOptions?.legend?.layout === "col"
										? "mx-5 grid grid-cols-2 justify-center text-center self-center w-full py-5 "
										: "justify-center pt-6 w-[100px]",
								)}
							>
								{chartData?.hideLegend &&
									chartData.labels.map((val: any, index: number) => (
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
													<div className="text-center ml-3 h-8 text-xs text-[#1E1E1E] whitespace-nowrap">
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
		</>
	);
};

export default DonutChart;
