import {
	BanknotesIcon,
	CalculatorIcon,
	ChevronDownIcon,
	ExclamationTriangleIcon,
	ScaleIcon,
} from "@heroicons/react/24/outline";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetTaxStatus } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

const formatCurrency = (value: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
};

const formatYAxisValue = (value: number) => {
	if (value >= 1000000) {
		return `$${value / 1000000}M`;
	}
	if (value >= 1000) {
		return `$${value / 1000}K`;
	}
	return `$${value}`;
};

interface TaxReturn {
	year: number;
	grossRevenue: number;
	netIncome: number;
	taxesPaid: number;
	status: "Filed" | "Not Filed" | "Extension";
	filingDate?: string;
}

interface TaxMetrics {
	irsBalance: number;
	irsLiens: number;
	accruedPenalties: number;
	accruedInterest: number;
}

const TaxOverview = ({ taxReturns }: { taxReturns: TaxReturn[] }) => {
	const chartData = taxReturns
		.sort((a, b) => a.year - b.year)
		.map((tax) => ({
			year: tax.year,
			revenue: tax.grossRevenue,
			income: tax.netIncome,
		}));

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<p className="text-sm text-gray-500">
						TOTAL REVENUE (LAST YEAR)
					</p>
					<h2 className="text-3xl font-semibold">
						{formatCurrency(
							taxReturns[taxReturns.length - 1]?.grossRevenue ||
								0,
						)}
					</h2>
				</div>
				<div className="flex gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="flex items-center gap-1"
							>
								View Options{" "}
								<ChevronDownIcon className="w-4 h-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-[200px]">
							<DropdownMenuLabel>Data Display</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuCheckboxItem checked={true}>
								Gross Revenue
							</DropdownMenuCheckboxItem>
							<DropdownMenuCheckboxItem checked={true}>
								Net Income
							</DropdownMenuCheckboxItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<ResponsiveContainer width="100%" height={350}>
				<BarChart
					data={chartData}
					margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
				>
					<CartesianGrid
						strokeDasharray="3 3"
						vertical={false}
						stroke="#E5E7EB"
					/>
					<XAxis
						dataKey="year"
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
						dataKey="revenue"
						fill="#2563EB"
						radius={[4, 4, 0, 0]}
						maxBarSize={50}
					/>
					<Bar
						dataKey="income"
						fill="#4F46E5"
						radius={[4, 4, 0, 0]}
						maxBarSize={50}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
};

const EmptyTaxOverview = () => {
	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<p className="text-sm text-gray-500">
						TOTAL REVENUE (LAST YEAR)
					</p>
					<h2 className="text-3xl font-semibold">$0</h2>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						className="flex items-center gap-1"
						disabled
					>
						View Options <ChevronDownIcon className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="h-[350px] flex items-center justify-center bg-gray-50 rounded-lg">
				<p className="text-sm text-gray-500">No tax data available</p>
			</div>
		</div>
	);
};

interface MetricCardProps {
	title: string;
	value: number;
	icon: React.ReactNode;
	iconColor: string;
	iconBgColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
	title,
	value,
	icon,
	iconColor,
	iconBgColor,
}) => (
	<Card className="flex flex-col overflow-hidden bg-white border border-gray-100 rounded-2xl">
		<CardContent className="pt-6">
			<div className="flex items-center gap-4">
				<div
					className={`h-12 w-12 flex items-center justify-center rounded-lg ${iconBgColor}`}
				>
					<div className={`size-6 ${iconColor}`}>{icon}</div>
				</div>
				<div className="space-y-1">
					<p className="text-sm font-medium text-gray-500">{title}</p>
					<h3 className="text-2xl font-light text-gray-700">
						{formatCurrency(value)}
					</h3>
				</div>
			</div>
		</CardContent>
	</Card>
);

const MetricsGrid: React.FC<{ metrics: TaxMetrics }> = ({ metrics }) => {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
			<MetricCard
				title="IRS Balance*"
				value={metrics.irsBalance}
				icon={<BanknotesIcon />}
				iconColor="text-pink-600"
				iconBgColor="bg-pink-50"
			/>
			<MetricCard
				title="IRS Liens*"
				value={metrics.irsLiens}
				icon={<ScaleIcon />}
				iconColor="text-indigo-600"
				iconBgColor="bg-indigo-50"
			/>
			<MetricCard
				title="Accrued Penalties"
				value={metrics.accruedPenalties}
				icon={<ExclamationTriangleIcon />}
				iconColor="text-purple-600"
				iconBgColor="bg-purple-50"
			/>
			<MetricCard
				title="Accrued Interest"
				value={metrics.accruedInterest}
				icon={<CalculatorIcon />}
				iconColor="text-sky-600"
				iconBgColor="bg-sky-50"
			/>
		</div>
	);
};

export const CaseTaxOverviewTab: React.FC<{ caseId: string }> = ({
	caseId,
}) => {
	const { customerId } = useAppContextStore();

	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? VALUE_NOT_AVAILABLE;

	const { data: taxStatus, isLoading: isTaxStatusLoading } = useGetTaxStatus({
		businessId,
		caseId,
	});

	const hasData = Boolean(
		(!isTaxStatusLoading && taxStatus?.data?.annual_data) ?? false,
	);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<Card className="flex flex-col pt-6 overflow-hidden">
					<CardContent className="flex-1">
						{hasData ? (
							<TaxOverview taxReturns={[]} />
						) : (
							<EmptyTaxOverview />
						)}
					</CardContent>
				</Card>
				<MetricsGrid
					metrics={{
						irsBalance:
							taxStatus?.data?.annual_data?.[0]?.irs_balance ?? 0,
						irsLiens:
							taxStatus?.data?.annual_data?.[0]?.lien_balance ??
							0,
						accruedPenalties: 0,
						accruedInterest: 0,
					}}
				/>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
