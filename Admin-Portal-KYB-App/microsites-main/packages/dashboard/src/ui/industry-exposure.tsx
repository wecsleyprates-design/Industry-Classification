import { type IndustryExposureDataObject } from "@/lib/types";

import { BubbleChart } from "@/ui/bubble-chart";

export const IndustryExposure = (props: {
	industryExposureData: IndustryExposureDataObject[];
}) => {
	return (
		<BubbleChart
			title={
				<div className="flex justify-between">
					<div className="text-base font-semibold">Industry exposure</div>
				</div>
			}
			chartData={props.industryExposureData}
		/>
	);
};
