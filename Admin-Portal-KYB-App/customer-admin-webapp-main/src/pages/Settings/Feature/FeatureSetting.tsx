import React, { Suspense } from "react";
import SkeletonLoader from "@/components/Loader/SkeletonLoader";
import { getRemoteComponent } from "@/lib/helper";

const CustomerFeature = React.lazy(async () => {
	const module = await getRemoteComponent("customer", "CustomerFeature");
	return { default: module.default };
}) as React.ComponentType;

export default function FeatureSetting() {
	return (
		<Suspense
			fallback={
				<SkeletonLoader loading={true} className="h-20 w-full rounded-lg" />
			}
		>
			<div>
				<CustomerFeature />
			</div>
		</Suspense>
	);
}
