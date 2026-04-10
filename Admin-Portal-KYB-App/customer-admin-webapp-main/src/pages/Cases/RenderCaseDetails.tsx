import React, { Suspense } from "react";
import { Skeleton } from "@/components/Skeleton";
import { getRemoteComponent } from "@/lib/helper";

const RemoteCaseDetails = React.lazy(async () => {
	const module = await getRemoteComponent("case", "CustomerCaseDetails");
	return { default: module.default };
}) as React.ComponentType;

const RenderCaseDetails = () => {
	return (
		<Suspense fallback={<Skeleton className="w-full h-48" />}>
			<div className="-m-8">
				<RemoteCaseDetails />
			</div>
		</Suspense>
	);
};

export default RenderCaseDetails;
