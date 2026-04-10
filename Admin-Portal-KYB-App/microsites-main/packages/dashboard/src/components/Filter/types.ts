import type React from "react";
import { type TOption } from "@/lib/types/common";

export type TFilterOption = {
	title: string | React.ReactElement;
	type: "checkbox" | "date-range" | "search-checkbox" | "multi-select-dropdown";
	filterOptions?: TOption[];
	alias: string;
	isVertical?: boolean;
	configs?: IConfigs;
};

export interface IConfigs {
	cols?: number;
}

export interface IFilterPopoverProps {
	data: TFilterOption[];
	initialValues: Record<string, TSelectedValueType[]>;
	dateFilterPayload?: Record<string, DateRangeType>;
	filterHandler?: (
		selectedValues: Record<string, TSelectedValueType[]>,
	) => void;
	dateFilterHandler?: (selectedDates: Record<string, DateType[]>) => void;
	handlePopoverClose?: () => void;
	filterButtonRef?: React.MutableRefObject<null>;
	type?: "small" | "large";
	configs?: IConfigs;
}

export type TSelectedValueType = string | Record<string, unknown>;

type TDateRangeLabel = "startDate" | "endDate";
export type TSelectedDateType = Record<TDateRangeLabel, Date | null>;

export type DateType = string | null | Date;

export type DateRangeType = {
	startDate: DateType;
	endDate: DateType;
};
export type DateValueType = DateRangeType | null;
export interface IFilterProps extends IFilterPopoverProps {
	title: string | React.ReactElement;
	type?: "small" | "large";
}
