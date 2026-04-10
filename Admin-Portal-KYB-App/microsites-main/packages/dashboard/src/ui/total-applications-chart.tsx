import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import { convertToLocalDate } from "@/lib/helper";
import { cn } from "@/lib/utils";
import { useGetTotalApplicationStats } from "@/services/queries/dashboard.query";

import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/ui/chart";
import { EmptyResultsCircle } from "@/ui/empty-states";

interface TotalApplicationsProps {
	customerId: string;
	period: "DAY" | "WEEK" | "MONTH" | "YEAR";
	industries?: string[];
	assignees?: string[];
	isTeamPerformanceTab?: boolean;
}

const colors = [
	"#2563EB", // blue-600
	"#3B82F6", // blue-500
	"#60A5FA", // blue-400
	"#93C5FD", // blue-300
	"#BFDBFE", // blue-200
	"#DBEAFE", // blue-100
	"#EFF6FF", // blue-50
	"#172554", // blue-950
	"#1E3A8A", // blue-900
	"#1E40AF", // blue-800
	"#1D4ED8", // blue-700
	"#0B1228", // blue-alt-01
	"#294194", // blue-alt-02
	"#314FB4", // blue-alt-03
	"#4362CB", // blue-alt-04
	"#536FD0", // blue-alt-05
];

export function TotalApplications({
	customerId,
	period,
	industries,
	assignees,
	isTeamPerformanceTab,
}: TotalApplicationsProps) {
	const { data: response } = useGetTotalApplicationStats(customerId, {
		period,
		industries,
		assignees,
		teamPerformance: isTeamPerformanceTab,
	});

	const chartData = response?.data?.data?.chart_data ?? [];
	const percentageChange = response?.data?.data?.percentage_change ?? 0;

	const pieData = chartData
		.filter((item) => item.current.count)
		.filter((item) => !["RISK_ALERT", "ARCHIVED"].includes(item.label))
		.map((data, index) => {
			const status = data.label.toLowerCase();
			return {
				status,
				count: data.current.count,
				date: data.current.period,
				fill: colors[index % colors.length],
			};
		});

	const chartConfig = {
		count: { label: "Count" },
		current: { label: "Current Period" },
		previous: { label: `Previous ${period}` },
	} satisfies ChartConfig;

	const total = pieData.reduce(
		(acc, curr) => Number(acc) + Number(curr.count ?? 0),
		0,
	);

	const timeFilterLabel = {
		DAY: "24 hours",
		WEEK: "7 days",
		MONTH: "30 days",
		YEAR: "1 year",
	}[period];

	const isEmptyState = useMemo(
		() => pieData?.every((item) => item.count === 0),
		[chartData],
	);

	return (
		<Card className="h-full flex flex-col">
			<CardHeader>
				<CardTitle>Total Applications</CardTitle>
				<p className="text-sm text-gray-500">vs. {timeFilterLabel} ago</p>
			</CardHeader>
			{isEmptyState ? (
				<CardContent className="flex items-center justify-center">
					<EmptyResultsCircle />
				</CardContent>
			) : (
				<>
					<CardContent className="flex-1 pb-0 text-blue">
						<ChartContainer
							config={chartConfig}
							className="mx-auto aspect-square max-h-[250px]"
						>
							<PieChart>
								<ChartTooltip
									content={({ payload }) => {
										if (payload?.[0]) {
											const data = payload[0].payload;

											const statusData = chartData.find(
												(d) => d.label === data.status.toUpperCase(),
											);
											const previousCount = statusData?.previous.count ?? 0;
											const previousDate = statusData?.previous.period ?? "";
											const change = statusData?.percentage ?? 0;
											return (
												<div className="p-2 border rounded-lg shadow-sm bg-background">
													<table className="w-full border-separate border-spacing-x-2 border-spacing-y-1">
														<tbody>
															<tr>
																<td>
																	<div
																		className="w-3 h-3 rounded-sm"
																		style={{ backgroundColor: data.fill }}
																	/>
																</td>
																<td className="text-gray-500 capitalize whitespace-nowrap">
																	{data.status.replaceAll("_", " ")}{" "}
																	{convertToLocalDate(data.date, "MM-DD-YYYY")}
																</td>
																<td className="text-right">{data.count}</td>
																<td
																	className={cn(
																		"text-right whitespace-nowrap",
																		change >= 0
																			? "text-green-500"
																			: "text-red-500",
																	)}
																>
																	{change >= 0 ? "↑" : "↓"}{" "}
																	{Math.abs(change).toFixed(1)}%
																</td>
															</tr>
															<tr>
																<td>
																	<div
																		className="w-3 h-3 rounded-sm"
																		style={{ backgroundColor: data.fill }}
																	/>
																</td>
																<td className="text-gray-500 capitalize whitespace-nowrap">
																	{data.status.replaceAll("_", " ")}{" "}
																	{convertToLocalDate(
																		previousDate,
																		"MM-DD-YYYY",
																	)}
																</td>
																<td className="text-right">{previousCount}</td>
																<td></td>
															</tr>
														</tbody>
													</table>
												</div>
											);
										}
										return null;
									}}
								/>
								<Pie
									data={pieData}
									dataKey="count"
									nameKey="status"
									innerRadius={90}
									outerRadius={115}
									strokeWidth={0}
								>
									<Label
										content={({ viewBox }) => {
											if (viewBox && "cx" in viewBox && "cy" in viewBox) {
												return (
													<text
														x={viewBox.cx}
														y={viewBox.cy}
														textAnchor="middle"
														dominantBaseline="middle"
													>
														<tspan
															x={viewBox.cx}
															y={viewBox.cy}
															className="fill-foreground text-[24px] font-[500] leading-[30px]"
														>
															{total}
														</tspan>
														<tspan
															x={viewBox.cx}
															y={(viewBox.cy ?? 0) + 24}
															className={`text-[14px] leading-[20px] ${
																percentageChange >= 0
																	? "fill-green-500"
																	: "fill-red-500"
															}`}
														>
															{percentageChange >= 0 ? "↑" : "↓"}{" "}
															{Math.abs(percentageChange)}%
														</tspan>
													</text>
												);
											}
										}}
									/>
								</Pie>
							</PieChart>
						</ChartContainer>
					</CardContent>
					<CardFooter className="flex flex-wrap gap-4 pt-4">
						{pieData.map((data) => {
							return (
								<div
									key={data.status}
									className="flex items-center gap-2 min-w-[140px]"
								>
									<div
										className="w-3 h-3 rounded-full"
										style={{ backgroundColor: data.fill }}
									/>
									<span className="text-xs capitalize text-muted-foreground">
										{data.status.replaceAll("_", " ")} ({data.count})
									</span>
								</div>
							);
						})}
					</CardFooter>
				</>
			)}
		</Card>
	);
}
