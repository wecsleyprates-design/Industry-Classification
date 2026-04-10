import { type FC, useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import { cn } from "@/lib/utils";
import { useGetAverageWorthScore } from "@/services/queries/dashboard.query";
import { EmptyResultsCircle } from "./empty-states";

import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/ui/chart";

const colors: Record<string, string> = {
	low: "#2563EB", // blue-600
	moderate: "#60A5FA", // blue-400
	high: "#BFDBFE", // blue-200
};

const chartConfig = {
	count: { label: "Count" },
	low: { label: "Low Risk", color: colors.low },
	moderate: { label: "Medium Risk", color: colors.moderate },
	high: { label: "High Risk", color: colors.high },
} satisfies ChartConfig;

export const AverageWorthScore: FC<{
	customerId: string;
}> = ({ customerId }) => {
	const { data: chartData } = useGetAverageWorthScore(customerId);

	const pieData = useMemo(() => {
		const riskLevels = chartData?.data?.risk_levels;
		return [
			{
				risk: "Low",
				count: Number(riskLevels?.low?.count) || 0,
				fill: colors.low,
			},
			{
				risk: "Moderate",
				count: Number(riskLevels?.moderate?.count) || 0,
				fill: colors.moderate,
			},
			{
				risk: "High",
				count: Number(riskLevels?.high?.count) || 0,
				fill: colors.high,
			},
		];
	}, [chartData]);

	const isEmpty = useMemo(
		() => pieData.every((item) => item.count === 0),
		[pieData],
	);

	return (
		<Card className="flex flex-col">
			<CardHeader className="items-start pb-0">
				<CardTitle className="text-[16px] text-gray-800">
					Average Worth Score
				</CardTitle>
				<div className="text-[14px] text-muted-foreground">Whole Portfolio</div>
			</CardHeader>
			<CardContent
				className={cn(
					"flex-1 pb-0",
					isEmpty && "flex items-center justify-center",
				)}
			>
				{isEmpty ? (
					<EmptyResultsCircle />
				) : (
					<ChartContainer
						config={chartConfig}
						className="mx-auto aspect-square max-h-[270px] mt-4"
					>
						<PieChart>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Pie
								data={pieData}
								dataKey="count"
								nameKey="risk"
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
														y={(viewBox.cy ?? 0) - 10}
														className="fill-foreground text-[24px] font-[500] leading-[30px]"
													>
														{chartData?.data.total?.average
															? Number(chartData.data.total.average).toFixed(0)
															: "N/A"}
													</tspan>
													<tspan
														x={viewBox.cx}
														y={(viewBox.cy ?? 0) + 14}
														className="text-sm leading-[20px] fill-gray-500"
													>
														Avg. Score
													</tspan>
												</text>
											);
										}
									}}
								/>
							</Pie>
						</PieChart>
					</ChartContainer>
				)}
			</CardContent>
			<CardFooter className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-2">
				{pieData.map((data) => (
					<div key={data.risk} className="flex items-center gap-2">
						<div
							className="w-3 h-3 rounded-full"
							style={{ backgroundColor: data.fill }}
						/>
						<span className="text-xs text-muted-foreground">
							{data.risk} Risk
						</span>
					</div>
				))}
			</CardFooter>
		</Card>
	);
};
