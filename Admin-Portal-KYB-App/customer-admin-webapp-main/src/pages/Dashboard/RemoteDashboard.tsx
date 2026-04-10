import React, { Suspense } from "react";
import QueryProviderWrapper from "@/components/MFE/QueryProviderWrapper";
import { getRemoteComponent } from "@/lib/helper";

const Home = React.lazy(async () => {
	const module = await getRemoteComponent("dashboard", "Home");
	return { default: module.default };
}) as React.ComponentType;

const RemoteDashboard = () => {
	return (
		<QueryProviderWrapper>
			<Suspense fallback={<>Loading...</>}>
				<Home />
			</Suspense>
		</QueryProviderWrapper>
	);
};

export default RemoteDashboard;
