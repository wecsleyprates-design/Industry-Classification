import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";

import { formatCurrency } from "@/helpers";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

const data = [
	{
		name: "Jan",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Feb",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Mar",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Apr",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "May",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Jun",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Jul",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Aug",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Sep",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Oct",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Nov",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
	{
		name: "Dec",
		total: Math.floor(Math.random() * 5000) + 1000,
	},
];

const formatYAxisValue = (value: number) => {
	if (value >= 1000) {
		return `$${value / 1000}K`;
	}
	return `$${value}`;
};

export const CurrentBalanceGraph = () => {
	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<p className="text-sm text-gray-500">CURRENT BALANCE</p>
					<h2 className="text-3xl font-semibold">
						{formatCurrency(289129.12)}
					</h2>
				</div>
				<div className="flex gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="flex items-center gap-1"
							>
								Bank Accounts{" "}
								<ChevronDownIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="w-[200px]"
						>
							<DropdownMenuLabel>Account Types</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem checked={true}>
								Checking Accounts
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem checked={true}>
								Savings Accounts
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="flex items-center gap-1"
							>
								All Accounts{" "}
								<ChevronDownIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="start"
							className="w-[200px]"
						>
							<DropdownMenuLabel>
								Account Status
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem checked={true}>
								Active Accounts
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem checked={false}>
								Closed Accounts
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<ResponsiveContainer width="100%" height={350}>
				<BarChart
					data={data}
					margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
				>
					<CartesianGrid
						strokeDasharray="3 3"
						vertical={false}
						stroke="#E5E7EB"
					/>
					<XAxis
						dataKey="name"
						stroke="#6B7280"
						fontSize={12}
						tickLine={false}
						axisLine={false}
						tickMargin={12}
					/>
					<YAxis
						stroke="#6B7280"
						fontSize={12}
						tickLine={false}
						axisLine={false}
						tickFormatter={formatYAxisValue}
						tickMargin={12}
					/>
					<Bar
						dataKey="total"
						fill="#2563EB"
						radius={[4, 4, 0, 0]}
						maxBarSize={50}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
};
