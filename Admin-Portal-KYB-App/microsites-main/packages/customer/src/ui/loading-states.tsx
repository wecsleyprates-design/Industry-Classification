import React from "react";
import { useFlags } from "launchdarkly-react-client-sdk";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { Skeleton } from "@/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/ui/table";

export const HeaderLoadingState: React.FC = () => {
	const flags = useFlags();

	return (
		<div className="flex items-center justify-between">
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

export const TableContentLoadingState: React.FC = () => (
	<TableBody>
		{Array.from({ length: 10 }).map((_, index) => (
			<TableRow key={index}>
				<TableCell>
					<Skeleton className="h-4 w-[100px]" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-4 w-[80px]" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-4 w-[60px]" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-4 w-[150px]" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-4 w-[40px]" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-6 w-[100px] rounded-full" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-4 w-[120px]" />
				</TableCell>
				<TableCell>
					<Skeleton className="h-4 w-[120px]" />
				</TableCell>
				<TableCell>
					<div className="flex space-x-2">
						<Skeleton className="w-5 h-5" />
						<Skeleton className="w-5 h-5" />
					</div>
				</TableCell>
			</TableRow>
		))}
	</TableBody>
);

export const FooterLoadingState: React.FC = () => (
	<div className="flex items-center justify-between">
		<Skeleton className="h-4 w-[200px]" />
		<Skeleton className="h-8 w-[300px]" />
	</div>
);
