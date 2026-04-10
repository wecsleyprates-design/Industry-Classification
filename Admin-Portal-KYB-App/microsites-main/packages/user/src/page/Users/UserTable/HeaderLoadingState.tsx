import React from "react";
import { useFlags } from "launchdarkly-react-client-sdk";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { Skeleton } from "@/ui/skeleton";

export const HeaderLoadingState: React.FC = () => {
	const flags = useFlags();

	return (
		<div className="flex items-center justify-between px-6 pt-6">
			<Skeleton className="h-10 w-[180px]" />
			<div className="flex items-center gap-x-2">
				<Skeleton className="h-10 w-[200px]" />
				{flags[FEATURE_FLAGS.BEST_23_CUSTOMER_CASES_DETAILS] && (
					<Skeleton className="w-12 h-10" />
				)}
			</div>
		</div>
	);
};
