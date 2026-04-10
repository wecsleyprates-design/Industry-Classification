import { useGetIndustryExposureData } from "@/services/queries/dashboard.query";
import IndustryBubbleChart from "./industry-bubble-chart";

export function IndustryExposureChart({ customerId }: { customerId: string }) {
	const { data } = useGetIndustryExposureData(customerId);
	const chartData = data?.data;
	return (
		<IndustryBubbleChart
			industryData={Array.isArray(chartData) ? chartData : []}
		/>
	);
}
