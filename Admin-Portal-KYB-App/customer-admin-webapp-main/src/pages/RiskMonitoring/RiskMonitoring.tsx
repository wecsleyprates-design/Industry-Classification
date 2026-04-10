import React, { Suspense } from "react";
import { Skeleton } from "@/components/Skeleton";
import { getRemoteComponent } from "@/lib/helper";

const RemoteRiskMonitoring = React.lazy(async () => {
	const module = await getRemoteComponent("customer", "RiskMonitoring");
	return { default: module.default };
}) as React.ComponentType;

const RiskMonitoring = () => {
	return (
		<Suspense fallback={<Skeleton className="w-full h-48" />}>
			<RemoteRiskMonitoring />
		</Suspense>
	);
};

export default RiskMonitoring;
