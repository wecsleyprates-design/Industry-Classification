import React from "react";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import { getItem } from "@/lib/localStorage";
import RiskMonitoringScoring from "../RiskMonitoringScoring";

import { LOCALSTORAGE } from "@/constants";
import { PLATFORM } from "@/constants/Platform";
import { ToastProvider } from "@/providers/ToastProvider";

const CustomerRiskMonitoringScoring = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";

	return (
		<CustomerWrapper>
			<ToastProvider />
			<RiskMonitoringScoring
				customerId={customerId}
				platform={PLATFORM.customer}
			/>
		</CustomerWrapper>
	);
};

export default CustomerRiskMonitoringScoring;
