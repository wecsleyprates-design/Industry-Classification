import type React from "react";
import { type IPayload } from "@/lib/types/common";

export type column = {
	title: string | React.ReactNode;
	path: string;
	sort?: boolean;
	alias?: string;
	content?: (item: any) => React.ReactElement;
};
export interface TableData {
	records: any[];
	total_items: number;
	total_pages: number;
}
export interface TableHeaderProps {
	columns: column[];
	sortHandler?: (sort: "ASC" | "DESC", alias: string) => void;
	payload?: IPayload;
	color?: string;
}

export interface TableBodyProps {
	isLoading: boolean;
	columns: column[];
	tableData: TableData;
}

export interface IPagination {
	tableData: TableData;
	page: number;
	itemsPerPage: number;
	paginationHandler: (page: number) => void;
	itemsPerPageHandler: (value: number) => void;
}

export interface TableProps
	extends TableHeaderProps, TableBodyProps, IPagination {
	tableData: TableData;
}
