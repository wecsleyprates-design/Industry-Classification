import React, { type FC } from "react";
import TooltipV3 from "./TooltipV3";

import Toggle from "@/ui/toggle";

type Props = {
	value: boolean;
	onChange: () => void;
	customerRiskMonitoringEnabled: boolean;
};

const RiskMonitoringToggle: FC<Props> = ({
	value,
	onChange,
	customerRiskMonitoringEnabled,
}) => {
	const toggleRiskMonitoringMessage = value
		? "Disabling risk monitoring will turn off score refreshing for this business."
		: "Enabling risk monitoring will turn score refreshing on for this business.";

	const tooltipMessage = !customerRiskMonitoringEnabled
		? "Risk monitoring is not currently enabled for this customer."
		: toggleRiskMonitoringMessage;

	return (
		<TooltipV3 tooltip={tooltipMessage}>
			<Toggle
				value={value}
				onChange={onChange}
				disabled={!customerRiskMonitoringEnabled}
			/>
		</TooltipV3>
	);
};

export default RiskMonitoringToggle;
