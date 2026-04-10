import React, { useEffect, useState } from "react";
import TableLoader from "../Spinner/TableLoader";
import { type column, type TableBodyProps } from "./types";
const renderCol = (column: column, item: any) => {
	return column.content ? column.content(item) : item[column.path];
};
const TableBody: React.FC<TableBodyProps> = ({
	columns,
	tableData,
	isLoading,
}) => {
	const [records, setRecords] = useState(tableData?.records);
	useEffect(() => {
		setRecords(tableData?.records ?? []);
	}, [tableData?.records]);
	return (
		<tbody>
			{isLoading ? (
				<tr className="text-center">
					<td colSpan={columns.length} className="text-center">
						<h6
							className="text-base font-medium text-red-500 text-center my-2"
							style={{ display: "flex", justifyContent: "center" }}
						>
							<TableLoader />
						</h6>
					</td>
				</tr>
			) : (
				<>
					{records && records.length === 0 ? (
						<tr className="text-center">
							<td colSpan={columns.length} className="text-center">
								<h6 className="text-base font-medium text-red-500 text-center my-2">
									No records found!
								</h6>
							</td>
						</tr>
					) : (
						records?.map((item, i) => {
							return (
								<tr key={i}>
									{columns.map((column, index) => {
										return (
											<td
												className="relative px-3 py-4 text-xs sm:text-sm text-gray-500 sm:table-cell"
												key={index}
											>
												{renderCol(column, item)}
												<div className="absolute bottom-0 right-full h-px w-full bg-[#D9D9D9]" />
												<div className="absolute bottom-0 left-0 h-px w-full bg-[#D9D9D9]" />
											</td>
										);
									})}
								</tr>
							);
						})
					)}
				</>
			)}
		</tbody>
	);
};
export default TableBody;
