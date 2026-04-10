import React from "react";
import { Bar } from "react-chartjs-2";
import { formatPriceWithSuffix } from "@/lib/helper";

type Props = {
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
		hideLegends?: boolean;
		chartClass?: string;
	};
};

const LineBarChart: React.FC<Props> = ({ data, chartOptions, legends }) => {
	const updatedData = data.datasets.map((value: any) => {
		if (
			Array.isArray(value.data) &&
			value.data.every((item: any) => typeof item === "number")
		)
			return value;
		else {
			return { ...value, data: value.data.map((item: any) => item.y ?? 0) };
		}
	});

	const isAllZeros = updatedData?.every((dataset: { data: unknown[] }) => {
		return dataset?.data?.every((d: unknown) => d === 0);
	});

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
				includeZero: true,
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
	return (
		<>
			{chartOptions?.displayIfAllZeros && isAllZeros ? (
				<div className="py-2 text-base font-normal tracking-tight text-center text-gray-500">
					{chartOptions.displayIfAllZeros}
				</div>
			) : (
				<>
					{" "}
					<div>
						<Bar height={250} data={data} options={options} />
					</div>
					<div className="flex justify-center gap-3 ">
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
			)}
		</>
	);
};

export default LineBarChart;
