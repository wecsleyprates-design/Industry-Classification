import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	Legend,
	type LegendProps,
	ResponsiveContainer,
	type TooltipProps,
	XAxis,
	YAxis,
} from "recharts";

import { CardContent, CardHeader, CardTitle } from "@/ui/card";
import { ChartContainer, ChartTooltip } from "@/ui/chart";

export interface WorthScoreChartCardProps {
	worthScore: number;
	maxScore: number;
	updatedDate: string;
	data: Array<{
		name: string;
		value: number;
		maxValue: number;
	}>;
	legendCategories: string[]; // New prop for legend categories
}

const chartConfig = {
	value: {
		label: "Score",
		color: "hsl(var(--chart-1))",
	},
};

const blueShades = ["#a0caf7", "#70adea", "#4da6ff", "#0080ff", "#0059b3"];

const RenderLegend: React.FC<LegendProps & { legendCategories?: string[] }> = (
	props,
) => {
	const { payload, legendCategories } = props as {
		payload?: Array<{
			value?: string;
			color?: string;
			type?: string;
			[key: string]: any;
		}>;
		legendCategories?: string[];
	};

	const blueShades = ["#a0caf7", "#70adea", "#4da6ff", "#0080ff", "#0059b3"];
	const itemsToRender = legendCategories || payload || [];

	return (
		<ul className="flex flex-wrap w-full justify-center gap-4 text-xs -mt-2">
			{itemsToRender.map((entry, index) => {
				const value = typeof entry === "string" ? entry : entry.value;
				const color =
					typeof entry === "string"
						? blueShades[index % blueShades.length]
						: entry.color;
				return (
					<li key={`item-${index}`} className="flex items-center">
						<span
							className="inline-block w-3 h-3 mr-1"
							style={{ backgroundColor: color }}
						></span>
						{value}
					</li>
				);
			})}
		</ul>
	);
};

const CustomTooltip = ({
	active,
	payload,
	label,
}: TooltipProps<number, string> & {
	payload?: Array<{ value?: number; name?: string; [key: string]: any }>;
	label?: string;
}) => {
	if (active && payload && payload.length) {
		// The first value is the transparent bar, so we start from the second
		const individualValue = payload[1]?.value ?? 0;
		const cumulativeValue = payload.reduce(
			(sum, entry) => sum + (entry.value as number),
			0,
		);

		return (
			<div className="bg-white p-2 border border-gray-200 rounded shadow">
				<p className="font-bold">{label}</p>
				{label !== "Worth Score" && (
					<p>{`Individual Value: ${individualValue}`}</p>
				)}
				{label !== "Base Score" && (
					<p>{`Cumulative Value: ${cumulativeValue}`}</p>
				)}
			</div>
		);
	}
	return null;
};

export function WorthScoreChartCard({
	worthScore,
	maxScore,
	updatedDate,
	data,
	legendCategories,
}: WorthScoreChartCardProps) {
	const riskLevel =
		worthScore >= 700
			? "Low Risk"
			: worthScore >= 500
				? "Medium Risk"
				: "High Risk";
	const riskColor =
		worthScore >= 700
			? "bg-green-100 text-green-800"
			: worthScore >= 500
				? "bg-yellow-100 text-yellow-800"
				: "bg-red-100 text-red-800";

	// Prepare data for waterfall chart
	const waterfallData = data.map((item, index) => {
		if (index === 0) {
			return { ...item, transparentValue: 0 };
		}
		const previousSum = data
			.slice(0, index)
			.reduce((sum, d) => sum + d.value, 0);
		return {
			...item,
			transparentValue: index === data.length - 1 ? 0 : previousSum,
			value: item.value,
		};
	});

	return (
		<div className="w-full max-w-lg bg-white rounded-lg">
			<CardHeader className="p-4">
				<CardTitle className="flex items-center justify-between">
					<div>
						<span className="text-sm text-gray-500">Worth Score*</span>
						<div className="text-4xl font-semibold">
							{worthScore}/{maxScore}
						</div>
					</div>
					<div className={`rounded-md px-2 py-1 text-sm ${riskColor}`}>
						{riskLevel}
					</div>
				</CardTitle>
				<div className="text-xs text-muted-foreground font-light">
					Updated: {updatedDate}
				</div>
			</CardHeader>
			<CardContent>
				<ChartContainer
					className="h-72 w-full my-2 rounded-md"
					config={chartConfig}
				>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={waterfallData} layout="horizontal" barSize={40}>
							<CartesianGrid
								strokeDasharray="3 3"
								horizontal={true}
								vertical={false}
							/>
							<XAxis
								dataKey="name"
								type="category"
								axisLine={false}
								tickLine={false}
								tickMargin={1}
								tick={false} // Hide x-axis labels
							/>
							<YAxis
								axisLine={false}
								tickLine={false}
								tickMargin={10}
								domain={[0, 850]}
								ticks={[0, 170, 340, 510, 680, 850]}
							/>
							<ChartTooltip cursor={false} content={<CustomTooltip />} />

							{/* Transparent stacked bar */}
							<Bar
								dataKey="transparentValue"
								stackId="stack"
								fill="transparent"
							/>

							{/* Visible bar (stacked for all except last) */}
							<Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
								{waterfallData.map((_, index) => (
									<Cell
										key={`cell-${index}`}
										fill={blueShades[index % blueShades.length]}
									/>
								))}
								<LabelList dataKey="value" position="top" />
							</Bar>

							<Legend
								content={<RenderLegend legendCategories={legendCategories} />}
							/>
						</BarChart>
					</ResponsiveContainer>
				</ChartContainer>
				<div className="mt-2 text-xs text-muted-foreground">
					* Generated by Model 2.1
				</div>
			</CardContent>
		</div>
	);
}
