import React, { useEffect, useState } from "react";
import { twMerge } from "tailwind-merge";
import SortIcon from "@/assets/SortIcon";
import { type column, type TableHeaderProps } from "./types";

type Order = "ASC" | "DESC";

const TableHeader: React.FC<TableHeaderProps> = ({
	columns,
	sortHandler,
	payload,
	className,
	tableHeaderClassname,
}) => {
	const [orderBy, setOrderBy] = useState<Order>("ASC");
	const [activeSortColumn, setActiveSortColumn] = useState<
		column | null | undefined
	>();
	const key = payload?.sort ? Object.keys(payload.sort)[0] : "";
	useEffect(() => {
		if (key !== "") {
			const id = columns.findIndex((column) => column?.alias === key);
			handleSortClick(columns[id]);
		}
	}, []);

	const handleSortClick = (column: column) => {
		const order =
			column.path === activeSortColumn?.path
				? orderBy === "ASC"
					? "DESC"
					: "ASC"
				: "DESC";
		setOrderBy(order);
		setActiveSortColumn(column);
		sortHandler?.(order, column?.alias ?? "");
	};

	return (
		<thead className="bg-white">
			<tr>
				{columns.map((column, i) => {
					return (
						<th
							scope="col"
							key={i}
							className={twMerge(
								"px-3 py-3.5 text-left text-xs font-semibold text-gray-900 max-w-fit min-w-max sm:table-cell ",
								tableHeaderClassname,
							)}
						>
							<div
								className={twMerge(
									"flex flex-row items-center min-w-max",
									className,
								)}
							>
								{column.title}
								{column.sort && (
									<SortIcon
										onClick={() => {
											handleSortClick(column);
										}}
										className={
											column.path === activeSortColumn?.path
												? orderBy === "ASC"
													? "ml-2 cursor-pointer"
													: "ml-2 rotate-180 cursor-pointer"
												: "ml-2 cursor-pointer"
										}
										color={column.path === activeSortColumn?.path ? "#000" : ""}
									/>
								)}
							</div>
						</th>
					);
				})}
			</tr>
		</thead>
	);
};

export default TableHeader;
