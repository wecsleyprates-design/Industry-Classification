import React, { type FC } from "react";
import { hasAccess } from "@/lib/helper";
import useAuthStore from "@/store/useAuthStore";
import Toggle from "../Input/Toggle";
import TooltipV3 from "../Tooltip/TooltipV3";

import { MODULES } from "@/constants/Modules";

type Props = {
	value: boolean;
	onChange: () => void;
	disabled?: boolean;
};

const RiskMonitoringToggle: FC<Props> = (props) => {
	const permissions = useAuthStore((state) => state.permissions);
	const isEnabled = hasAccess(
		permissions,
		[MODULES.RISK_MONITORING_MODULE, MODULES.BUSINESS],
		["write", "write"],
	);
	return (
		<>
			<TooltipV3
				tooltip={
					!isEnabled
						? "Risk monitoring is not currently enabled for this customer. Please contact customer support for access."
						: props.value
							? "Disabling risk monitoring will turn off score refreshing for this business."
							: "Enabling risk monitoring will turn score refreshing on for this business."
				}
			>
				<Toggle {...props} />
			</TooltipV3>
		</>
	);
};

export default RiskMonitoringToggle;
