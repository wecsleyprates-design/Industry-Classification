import React from "react";
import { useParams } from "react-router";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import RiskMonitoringScoring from "../RiskMonitoringScoring";

import { PLATFORM } from "@/constants/Platform";
import { ToastProvider } from "@/providers/ToastProvider";

const AdminRiskMonitoringScoring = () => {
	const { slug } = useParams<{ slug?: string }>();

	return (
		<CustomerWrapper>
			<ToastProvider />
			<RiskMonitoringScoring
				customerId={slug ?? ""}
				platform={PLATFORM.admin}
			/>
		</CustomerWrapper>
	);
};

export default AdminRiskMonitoringScoring;
