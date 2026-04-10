import { Skeleton } from "../skeleton";
import { TableCell, TableRow } from "../table";
import { type DataTableColumn } from "./DataTable";
import { TableCellInnerContainer } from "./TableCellInnerContainer";

export function LoadingRow<T>({
	columns,
}: {
	columns: Array<DataTableColumn<T>>;
}) {
	const getColumnWidth = (index: number) => {
		if (index === 0) {
			// Usually ID
			return "w-48";
		} else if (index === columns.length - 1) {
			// Usually Actions
			return "w-8";
		}

		return "w-24";
	};

	return (
		<TableRow>
			{columns.map((_, index) => (
				<TableCell key={`loading-${index}`}>
					<TableCellInnerContainer isLastColumn={index === columns.length - 1}>
						<Skeleton className={`h-4 ${getColumnWidth(index)}`} />
					</TableCellInnerContainer>
				</TableCell>
			))}
		</TableRow>
	);
}
