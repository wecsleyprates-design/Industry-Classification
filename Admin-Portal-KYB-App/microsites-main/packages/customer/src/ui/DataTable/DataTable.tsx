import React, { useCallback } from "react";
import { ChevronDownIcon } from "lucide-react";
import { isPaginatedAPIResponse } from "@/lib/assertions";
import { cn } from "@/lib/utils";
import { type APIResponse, type PaginatedAPIResponse } from "@/types/common";
import { LoadingRow } from "./LoadingRow";
import { TableCellInnerContainer } from "./TableCellInnerContainer";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/table";

// Helper type that creates a column configuration for a specific property K
type ColumnForProperty<T, K extends keyof T> = {
	label: React.ReactNode;
	accessor?: K;
	render?: (value: T[K], row: T) => React.ReactNode | string;
	sortKey?: string;
	sortable?: boolean;
};

// Creates a union of all possible column configurations
export type DataTableColumn<T> = {
	[K in keyof T]: ColumnForProperty<T, K>;
}[keyof T];

export type SortDirection = "ASC" | "DESC" | null;

const SortableTableHead: React.FC<{
	children: React.ReactNode;
	sortKey: string;
	currentSort?: string;
	onSort: (key: string) => void;
}> = ({ children, sortKey, currentSort, onSort }) => {
	const isActive =
		currentSort === `${sortKey}:ASC` || currentSort === `${sortKey}:DESC`;
	const isAsc = currentSort === `${sortKey}:ASC`;

	return (
		<TableHead
			className={cn("cursor-pointer select-none", isActive && "text-primary")}
			onClick={() => {
				onSort(sortKey);
			}}
		>
			<div className="flex items-center h-full">
				<span className="text-[#1F2937] font-inter font-medium text-[14px] leading-[20px]">
					{children}
				</span>

				<div
					className={cn(
						"ml-1 w-[20px] h-[20px] rounded flex items-center justify-center transition-colors duration-200",
						isActive ? "bg-blue-50" : "bg-gray-100",
					)}
				>
					<ChevronDownIcon
						className={cn(
							"w-[14px] h-[14px] text-[#1F2937] transition-transform duration-200",
							isActive && (isAsc ? "rotate-180" : "rotate-0"),
						)}
					/>
				</div>
			</div>
		</TableHead>
	);
};

export interface DataTableProps<T> {
	columns: Array<DataTableColumn<T>>;
	data: PaginatedAPIResponse<T> | APIResponse<T[]> | null | undefined;
	isLoading: boolean;
	currentPage: number;
	onPageChange: (page: number) => void;
	numberOfLoadingRows?: number;
	currentSort?: string;
	onSort?: (key: string) => void;
}

export function DataTable<T>({
	columns,
	data,
	isLoading,
	currentPage,
	onPageChange,
	numberOfLoadingRows = 10,
	currentSort,
	onSort,
}: DataTableProps<T>) {
	const isPaginated = isPaginatedAPIResponse(data);
	const records: T[] | null | undefined = isPaginated
		? data.data.records
		: data?.data;

	const renderCell = useCallback((column: DataTableColumn<T>, row: T) => {
		if (column.render && column.accessor) {
			return column.render(row[column.accessor], row);
		}
		return column.accessor ? (row[column.accessor] as React.ReactNode) : null;
	}, []);

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((column, index) => {
							const isSortable = column.sortable && column.sortKey && onSort;
							const className =
								index === columns.length - 1 ? "text-right mr-4" : "";

							if (isSortable && column.sortKey) {
								return (
									<SortableTableHead
										key={`header-${index}`}
										sortKey={column.sortKey}
										currentSort={currentSort}
										onSort={onSort}
									>
										<span className={cn(className, "mr-4")}>
											{column.label}
										</span>
									</SortableTableHead>
								);
							}

							return (
								<TableHead key={`header-${index}`} className={className}>
									<span className="mr-4">{column.label}</span>
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody>
					{isLoading
						? [...Array(numberOfLoadingRows)].map((_, index) => (
								<LoadingRow key={index} columns={columns} />
							))
						: records?.map((row, index) => (
								<TableRow key={index}>
									{columns.map((column, columnIndex) => (
										<TableCell key={`row-${index}-column-${columnIndex}`}>
											<TableCellInnerContainer
												isLastColumn={columnIndex === columns.length - 1}
											>
												{renderCell(column, row)}
											</TableCellInnerContainer>
										</TableCell>
									))}
								</TableRow>
							))}
				</TableBody>
			</Table>
		</>
	);
}
