import { useEffect, useMemo, useState } from "react";
import { Pie, PieChart, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { useGetCasesByApprovalstatus } from "@/services/queries/dashboard.query";
import { EmptyResultsCircleFilled } from "./empty-states";

import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/ui/card";
import { type ChartConfig, ChartContainer } from "@/ui/chart";

const colors: Record<string, string> = {
	autoApproved: "#1E40AF", // blue-800
	manuallyApproved: "#2563EB", // blue-600
	autoRejected: "#60A5FA", // blue-400
	manuallyRejected: "#BFDBFE", // blue-200
};

const CustomTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div className={"rounded-lg border bg-background p-2 shadow-sm"}>
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<span className="text-sm font-semibold">{data.name}:</span>
						{data?.count}
					</div>
				</div>
			</div>
		);
	}
	return null;
};

const chartConfig = {
	value: { label: "Percentage" },
} satisfies ChartConfig;

export const TotalCases: React.FC<{
	customerId: string;
}> = ({ customerId }) => {
	const { data } = useGetCasesByApprovalstatus(customerId);
	const chartData = data?.data;
	const [pieData, setPieData] = useState([
		{ name: "Auto Approved", value: 0, fill: colors.autoApproved, count: 0 },
		{
			name: "Manually Approved",
			value: 0,
			fill: colors.manuallyApproved,
			count: 0,
		},
		{ name: "Auto Rejected", value: 0, fill: colors.autoRejected, count: 0 },
		{
			name: "Manually Rejected",
			value: 0,
			fill: colors.manuallyRejected,
			count: 0,
		},
	]);

	useEffect(() => {
		if (chartData?.decisions) {
			setPieData([
				{
					name: "Auto Approved",
					value: Number(chartData.decisions.AUTO_APPROVED.percentage),
					fill: colors.autoApproved,
					count: Number(chartData.decisions.AUTO_APPROVED.count),
				},
				{
					name: "Manually Approved",
					value: Number(chartData.decisions.MANUALLY_APPROVED.percentage),
					fill: colors.manuallyApproved,
					count: Number(chartData.decisions.MANUALLY_APPROVED.count),
				},
				{
					name: "Auto Rejected",
					value: Number(chartData.decisions.AUTO_REJECTED.percentage),
					fill: colors.autoRejected,
					count: Number(chartData.decisions.AUTO_REJECTED.count),
				},
				{
					name: "Manually Rejected",
					value: Number(chartData.decisions.MANUALLY_REJECTED.percentage),
					fill: colors.manuallyRejected,
					count: Number(chartData.decisions.MANUALLY_REJECTED.count),
				},
			]);
		}
	}, [chartData]);

	const isEmpty = useMemo(
		() => pieData.every((item) => item.count === 0),
		[pieData],
	);

	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="text-[16px] font-semibold">
					Total Cases by Approval Status
				</CardTitle>
			</CardHeader>
			<CardContent className="relative flex-1 flex items-center justify-center">
				<ChartContainer
					config={chartConfig}
					className={cn("h-[300px] w-full", isEmpty && "pointer-events-none")}
				>
					<PieChart>
						<Tooltip content={CustomTooltip} />
						<Pie
							data={isEmpty ? [] : pieData}
							dataKey="value"
							nameKey="name"
							cx="50%"
							cy="50%"
							label={({
								cx,
								cy,
								midAngle,
								innerRadius,
								outerRadius,
								value,
							}) => {
								const RADIAN = Math.PI / 180;
								const radius = +innerRadius + (outerRadius - innerRadius) * 0.6;
								const angle = midAngle ?? 0;
								const x = +cx + radius * Math.cos(-angle * RADIAN);
								const y = +cy + radius * Math.sin(-angle * RADIAN);

								return (
									<text
										x={x}
										y={y}
										fill="white"
										textAnchor="middle"
										dominantBaseline="middle"
										fontSize={16}
									>
										{value ? `${value.toFixed(2)}%` : ""}
									</text>
								);
							}}
							labelLine={false}
						/>
					</PieChart>
				</ChartContainer>
				{isEmpty && (
					<div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
						<EmptyResultsCircleFilled />
					</div>
				)}
			</CardContent>
			<CardFooter className="flex content-center justify-center w-full grid-cols-2 text-center">
				<div className="grid grid-cols-2">
					{pieData.map((data) => (
						<div key={data.name} className="flex items-center gap-3 my-1">
							<div
								className="w-3 h-3 rounded-full"
								style={{ backgroundColor: data.fill }}
							/>
							<span className="text-xs text-muted-foreground">{data.name}</span>
						</div>
					))}
				</div>
			</CardFooter>
		</Card>
	);
};
