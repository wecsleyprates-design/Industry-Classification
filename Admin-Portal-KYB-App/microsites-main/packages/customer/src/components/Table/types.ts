import type React from "react";
import { type IPayload } from "@/types/common";

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
	payload?: IPayload | Record<string, unknown>;
	className?: string;
	tableHeaderClassname?: string;
}

export interface TableBodyProps {
	isLoading: boolean;
	columns: column[];
	tableData: TableData;
	renderDiv?: boolean;
	seprator?: boolean;
	rowClassName?: string;
}

export type CustomerRecord = {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	created_at: string;
	status: string;
	subrole: {
		id: string;
		code: string;
		label: string;
		description: string;
	};
	customer_details: {
		id: string;
		name: string;
		customer_type: "PRODUCTION" | "SANDBOX";
		contact_number: string | null;
		is_active: boolean;
		parent_id: string | null;
	};
};

export type CustomerStatusVariant =
	| "active"
	| "invited"
	| "invite-expired"
	| "inactive";
export type CustomerRowData = {
	customerId: string;
	businessName: string;
	type: { label: "Production" | "Sandbox" };
	owner: string;
	onboardingDate: string;
	status: { label: string; variant: CustomerStatusVariant };
};
