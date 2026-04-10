import React, { Suspense } from "react";
import { Skeleton } from "@/components/Skeleton";
import { getRemoteComponent } from "@/lib/helper";

const RemoteCaseTable = React.lazy(async () => {
	const module = await getRemoteComponent("case", "CustomerCaseTable");
	return { default: module.default };
}) as React.ComponentType;

const RenderCaseTable = () => {
	return (
		<Suspense fallback={<Skeleton className="w-full h-48" />}>
			<div className="-m-8">
				<RemoteCaseTable />
			</div>
		</Suspense>
	);
};

export default RenderCaseTable;
