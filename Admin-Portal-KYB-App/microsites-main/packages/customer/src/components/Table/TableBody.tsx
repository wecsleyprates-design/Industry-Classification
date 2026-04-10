import React, { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import TableLoader from "../Spinner/TableLoader";
import { type column, type TableBodyProps } from "./types";

const renderCol = (column: column, item: any) => {
	return column.content ? column.content(item) : item[column.path];
};

const TableBody: React.FC<TableBodyProps> = ({
	columns,
	tableData,
	isLoading,
	renderDiv,
	seprator,
	rowClassName,
}) => {
	const [records, setRecords] = useState(tableData?.records);
	useEffect(() => {
		setRecords(tableData?.records ?? []);
	}, [tableData?.records]);
	const WrapperContainer = renderDiv ? "div" : "td";
	return (
		<tbody>
			{isLoading ? (
				<tr className="text-center">
					<td colSpan={columns.length} className="text-center">
						<h6
							className="my-2 text-base font-medium text-center text-red-500"
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
								<h6 className="my-2 text-base font-medium text-center text-red-500">
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
											<WrapperContainer
												key={index}
												className={twMerge(
													"relative px-3 py-4 text-xs text-gray-500 sm:table-cell align-middle",
													rowClassName,
												)}
											>
												{renderCol(column, item)}
												{seprator && (
													<>
														<div className="absolute bottom-0 w-full h-px bg-gray-100 right-full" />
														<div className="absolute bottom-0 left-0 w-full h-px bg-gray-100" />
													</>
												)}
											</WrapperContainer>
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
