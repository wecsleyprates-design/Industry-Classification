import React from "react";

import { Skeleton } from "@/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/ui/table";

export const HeaderLoadingState: React.FC = () => (
	<div className="flex items-center justify-between">
		<div className="font-semibold leading-none tracking-tight">Cases</div>
		<div className="flex items-center justify-end gap-2">
			<Skeleton className="h-10 w-[180px]" />
			<Skeleton className="h-10 w-[200px]" />
		</div>
	</div>
);

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
						<Skeleton className="h-5 w-5" />
						<Skeleton className="h-5 w-5" />
					</div>
				</TableCell>
			</TableRow>
		))}
	</TableBody>
);

export const FooterLoadingState: React.FC = () => (
	<div className="flex justify-between items-center">
		<Skeleton className="h-4 w-[200px]" />
		<Skeleton className="h-8 w-[300px]" />
	</div>
);
