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
import classNames from "classnames";
import { twMerge } from "tailwind-merge";
import { type AnyObject } from "yup";
import Card from "../Card";
import TableLoader from "../Spinner/TableLoader";

ChartJS.register(ArcElement, Title, Tooltip);

type Props = {
	title: React.ReactElement;
	centerComponent?: React.ReactElement;
	data?: {
		labels?: string[];
		datasets?: [
			{
				data: number[];
				backgroundColor: string[];
				datalabels?: any;
				borderWidth: number;
			},
		];
	} | null;
	isLoading?: boolean;
	chartOptions?: {
		tooltip?: {
			prefix?: string;
			suffix?: string;
		};
		cutout?: string;
		legend?: {
			layout?: "row" | "col";
		};
		componentClass?: string;
		chartClass?: string;
	};
	openIntegrationModal?: () => void;
	integrationStatus?: boolean;
};

const DonutChart: React.FC<Props> = ({
	title,
	data,
	centerComponent,
	chartOptions,
	integrationStatus,
	openIntegrationModal,
	isLoading,
}) => {
	const [chartData, setChartData] = useState<any>({
		labels: ["N/A"],
		datasets: [
			{
				data: [0],
				backgroundColor: ["#D9D9D9"],
				datalabels: {
					color: "#fff",
					formatter: function (value: number) {
						return "";
					},
				},
			},
		],
	});
	const donutChartOptions: any = {
		type: "doughnut",
		responsive: true,
		cutout: chartOptions?.cutout,
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
							<div className="h-[300px] relative">
								<div className="absolute inset-0 flex items-center justify-center">
									{centerComponent}
								</div>
								<div className="flex justify-center w-full">
									<div className={chartOptions?.chartClass}>
										<Doughnut
											data={chartData}
											options={donutChartOptions}
											plugins={[
												ChartDataLabels as Plugin<"doughnut", AnyObject>,
											]}
										/>
									</div>
								</div>

								{integrationStatus ? (
									<div
										className={classNames(
											chartOptions?.legend?.layout === "col"
												? "mx-5 grid grid-cols-2 justify-center text-center self-center  w-full py-5"
												: "flex justify-center gap-12 flex-grow-0 ",
										)}
									>
										{chartData?.labels?.map((val: any, index: number) => (
											<div className="flex" key={index}>
												<>
													<div
														className="w-3 h-8 my-1"
														style={{
															backgroundColor:
																chartData.datasets[0].backgroundColor[index],
														}}
													></div>
													<div className="text-left my-auto px-2  text-xs text-[#474747] ">
														{val}
													</div>
												</>
											</div>
										))}
									</div>
								) : (
									<div className="flex flex-col justify-center text-center justify-self-center">
										<p
											className="flex justify-center mt-5 text-[#266EF1] text-xs cursor-pointer z-50"
											onClick={() => {
												openIntegrationModal?.();
											}}
										>
											Connect your account(s)
										</p>
									</div>
								)}
							</div>
						)}
					</>
				}
			/>
		</>
	);
};

export default DonutChart;
