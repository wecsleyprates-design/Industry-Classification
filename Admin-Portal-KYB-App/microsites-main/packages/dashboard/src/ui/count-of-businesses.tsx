import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { useGetBusinessesScoreStats } from "@/services/queries/dashboard.query";
import { EmptyResultsDisplay } from "./empty-states";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/ui/chart";

const colors: Record<string, string> = {
	high: "#2563EB", // blue-600
	medium: "#3B82F6", // blue-500
	low: "#60A5FA", // blue-400
};

const chartConfig = {
	count: { label: "Count" },
	high: { label: "650+", color: colors.high },
	medium: { label: "500-649", color: colors.medium },
	low: { label: "350-499", color: colors.low },
} satisfies ChartConfig;

export const CountOfBusinesses: React.FC<{
	customerId: string;
}> = ({ customerId }) => {
	const { data } = useGetBusinessesScoreStats(customerId);
	const scoreRange = data?.data?.score_range;

	const barData = useMemo(
		() => [
			{
				name: "650+",
				count: Number(scoreRange?.["650-XXX"]?.count) || 0,
				fill: colors.high,
			},
			{
				name: "500-649",
				count: Number(scoreRange?.["500-649"]?.count) || 0,
				fill: colors.medium,
			},
			{
				name: "350-499",
				count: Number(scoreRange?.["0-499"]?.count) || 0,
				fill: colors.low,
			},
		],
		[scoreRange],
	);

	const isEmpty = useMemo(
		() => barData.every((item) => item.count === 0),
		[barData],
	);

	return (
		<Card className="flex flex-col">
			<CardHeader className="space-y-0">
				<CardTitle className="text-[16px] font-semibold">
					Count of Businesses
				</CardTitle>
				<p className="text-[14px] text-muted-foreground">
					Within Each Score Range
				</p>
			</CardHeader>
			<CardContent className="relative flex flex-1 items-center justify-center">
				<ChartContainer
					config={chartConfig}
					className={cn("h-[300px] w-full", isEmpty && "pointer-events-none")}
				>
					<BarChart
						data={barData}
						margin={{ top: 20, right: 0, bottom: 10, left: 0 }}
						barSize={80}
					>
						{!isEmpty && <CartesianGrid vertical={false} stroke="#E5E7EB" />}
						<XAxis
							dataKey="name"
							axisLine={true}
							tickLine={false}
							tick={{ fontSize: 12 }}
							stroke="#E5E7EB"
						/>
						<YAxis hide />
						<ChartTooltip content={<ChartTooltipContent />} />
						<Bar
							dataKey="count"
							radius={[8, 8, 0, 0]}
							label={
								!isEmpty
									? {
											position: "top",
											fill: "#6B7280",
											fontSize: 12,
										}
									: undefined
							}
							minPointSize={2}
						/>
					</BarChart>
				</ChartContainer>
				{isEmpty && (
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center mb-4">
						<EmptyResultsDisplay />
					</div>
				)}
			</CardContent>
		</Card>
	);
};
