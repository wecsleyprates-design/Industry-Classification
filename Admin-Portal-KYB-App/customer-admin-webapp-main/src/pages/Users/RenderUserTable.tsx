import React, { Suspense } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { Skeleton } from "@/components/Skeleton";
import { getRemoteComponent } from "@/lib/helper";
import Users from "./Users";

import FEATURE_FLAGS from "@/constants/FeatureFlags";

const RemoteUserTable = React.lazy(async () => {
	const module = await getRemoteComponent("user", "TeamsTab");
	return { default: module.default };
}) as React.ComponentType;

const RenderUserTable = () => {
	const flags = useFlags();
	if (flags[FEATURE_FLAGS.PAT_703_USER_MANAGEMENT_V2]) {
		return (
			<Suspense fallback={<Skeleton className="w-full h-48" />}>
				<div className="-m-8">
					<RemoteUserTable />
				</div>
			</Suspense>
		);
	} else {
		return <Users />;
	}
};

export default RenderUserTable;
