import React from "react";

import { Skeleton } from "@/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/ui/table";

export const TableContentLoadingState: React.FC = () => (
	<Table>
		<TableBody>
			{Array.from({ length: 10 }).map((_, index) => (
				<TableRow key={index}>
					<TableCell>
						<Skeleton className="h-6 w-[100px]" />
					</TableCell>
					<TableCell>
						<Skeleton className="h-6 w-[120px]" />
					</TableCell>
					<TableCell>
						<Skeleton className="h-6 w-[180px]" />
					</TableCell>
					<TableCell>
						<Skeleton className="h-6 w-[80px]" />
					</TableCell>
					<TableCell>
						<Skeleton className="h-6 w-[70px]" />
					</TableCell>
					<TableCell>
						<Skeleton className="h-6 w-8" />
					</TableCell>
				</TableRow>
			))}
		</TableBody>
	</Table>
);
