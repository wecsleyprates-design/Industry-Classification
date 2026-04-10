import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import { ArcElement, Chart as ChartJS, type Plugin, Title } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { type AnyObject } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Card } from "@/ui/card-old";

ChartJS.register(ArcElement, Title);

type Props = {
	title: React.ReactElement;
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
		hideLegend?: boolean;
		legend?: {
			layout?: "row" | "col";
		};
	};
	tooltips?: string[];
};

export const PieChart: React.FC<Props> = ({
	title,
	data,
	chartOptions,
	tooltips,
}) => {
	const plugins = chartOptions?.labels
		? [ChartDataLabels as Plugin<"pie", AnyObject>]
		: [];

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
					<div className="">
						<div className="flex justify-center w-full">
							<div className="w-[300px] ">
								<Pie data={chartData} options={options} plugins={plugins} />
							</div>
						</div>
						<div className="flex justify-center w-full">
							<div
								className={cn(
									chartOptions?.legend?.layout === "col"
										? "mx-5 grid grid-cols-2 justify-center text-center self-center w-full py-5 "
										: "justify-center pt-6 w-[120]",
								)}
							>
								{chartOptions?.hideLegend &&
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
		</>
	);
};
