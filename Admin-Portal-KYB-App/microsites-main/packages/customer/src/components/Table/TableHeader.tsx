import React, { useEffect, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { type column, type TableHeaderProps } from "./types";

type Order = "ASC" | "DESC";

const TableHeader: React.FC<TableHeaderProps> = ({
	columns,
	sortHandler,
	payload,
	tableHeaderClassname,
}) => {
	const [orderBy, setOrderBy] = useState<Order>("ASC");
	const key = payload?.sort ? Object.keys(payload.sort)[0] : "";
	const currentOrder = payload?.sort
		? (payload.sort as Record<string, Order>)[key]
		: undefined;

	useEffect(() => {
		if (key !== "" && currentOrder) {
			setOrderBy(currentOrder);
		}
	}, [key, currentOrder]);

	const handleSortClick = (column: column) => {
		if (!column.sort || !sortHandler) return;

		const isActive = column.alias === key;
		const order: Order = isActive && orderBy === "ASC" ? "DESC" : "ASC";

		setOrderBy(order);
		sortHandler(order, column?.alias ?? "");
	};

	return (
		<thead className="bg-white">
			<tr>
				{columns.map((column, i) => {
					const isSortable = column.sort;
					const isActive = column.alias === key;
					const showAsc = isActive && orderBy === "ASC";
					const showDesc = isActive && orderBy === "DESC";

					return (
						<th
							scope="col"
							key={i}
							onClick={() => {
								if (isSortable) {
									handleSortClick(column);
								}
							}}
							className={twMerge(
								`px-3 py-3.5 text-xs font-semibold text-left text-gray-900 max-w-fit min-w-max sm:table-cell`,
								isSortable && "cursor-pointer hover:bg-gray-50 select-none",
								tableHeaderClassname,
							)}
						>
							<div className="flex flex-row items-center gap-1 min-w-max">
								{column.title}
								{isSortable && (
									<div className="flex flex-col">
										<ChevronUpIcon
											className={twMerge(
												"w-3 h-3",
												showAsc ? "text-gray-900" : "text-gray-300",
											)}
										/>
										<ChevronDownIcon
											className={twMerge(
												"w-3 h-3 -mt-1",
												showDesc ? "text-gray-900" : "text-gray-300",
											)}
										/>
									</div>
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
