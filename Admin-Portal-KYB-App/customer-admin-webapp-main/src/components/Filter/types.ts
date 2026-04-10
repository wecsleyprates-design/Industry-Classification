import type React from "react";
import { type IPayload, type TOption } from "@/types/common";

export type TFilterOption = {
	title: string | React.ReactElement;
	type:
		| "checkbox"
		| "date-range"
		| "search-checkbox"
		| "multi-select-dropdown"
		| "radio";
	filterOptions?: TOption[];
	alias: string;
	isVertical?: boolean;
	isBooleanField?: boolean;
	configs?: IConfigs;
	defaultValue?: any;
	value?: any;
	onChange?: (val: any) => void;
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
	/** Single handler for Apply: updates both filter and filter_date in one navigate (avoids second navigate overwriting first) */
	applyFiltersAndDates?: (
		selectedValues: Record<string, TSelectedValueType[]>,
		selectedDates: Record<string, DateType[]>,
	) => void;
	handlePopoverClose?: () => void;
	filterButtonRef?: React.MutableRefObject<HTMLElement | null>;
	popoverId?: string;
	type?: "small" | "large";
	configs?: IConfigs;
}

export type TSelectedValueType = boolean | string | Record<string, unknown>;

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
	payload?: IPayload;
	type?: "small" | "large";
	popOverType?: "filter" | "accounts";
	className?: string;
}
