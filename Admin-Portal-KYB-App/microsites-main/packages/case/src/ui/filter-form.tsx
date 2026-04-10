import React from "react";
import { type DateRange } from "react-day-picker";
import { type UseFormReturn } from "react-hook-form";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { type z } from "zod";
import { type createFilterSchema } from "./filter-form-schema";

import { Button } from "@/ui/button";
import { Calendar } from "@/ui/calendar";
import { Checkbox } from "@/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/ui/form";
import { Input } from "@/ui/input";

export type FilterOption = {
	label: string;
	value: string;
};

export type BaseFilterConfig = {
	label: string | React.ReactNode;
	hidden?: boolean;
};

export type CheckboxGroupFilterConfig = BaseFilterConfig & {
	name: string;
	type: "checkbox-group";
	options: FilterOption[];
};

export type DropdownCheckboxFilterConfig = BaseFilterConfig & {
	name: string;
	type: "dropdown-checkbox";
	options: FilterOption[];
	placeholder: string;
};

export type DateRangeFilterConfig = BaseFilterConfig & {
	name: string;
	type: "date-range";
};

export type NumberRangeFilterConfig = BaseFilterConfig & {
	type: "number-range";
	min: { name: string; label: string };
	max: { name: string; label: string };
};

export type FilterConfigItem =
	| CheckboxGroupFilterConfig
	| DropdownCheckboxFilterConfig
	| DateRangeFilterConfig
	| NumberRangeFilterConfig;

export type FilterFormValues = z.infer<ReturnType<typeof createFilterSchema>>;

export interface FilterFormProps {
	form: UseFormReturn<any>;
	onFilterChange?: (values: any) => void;

	filterConfig: FilterConfigItem[];
}

const renderFilter = (filter: FilterConfigItem, form: UseFormReturn<any>) => {
	switch (filter.type) {
		case "checkbox-group":
			return (
				<FormField
					control={form.control}
					name={filter.name}
					render={() => (
						<FormItem>
							<FormLabel className="text-sm font-base text-gray-500 mb-4">
								{filter.label}
							</FormLabel>
							<div className="space-y-4">
								{filter.options.map((option) => (
									<FormField
										key={option.value}
										control={form.control}
										name={filter.name}
										render={({ field }) => (
											<FormItem className="flex flex-row items-start space-x-2 space-y-0 p-0">
												<FormControl>
													<Checkbox
														className="shadow-none"
														checked={field.value?.includes(
															option.value,
														)}
														onCheckedChange={(
															checked,
														) => {
															if (checked) {
																field.onChange([
																	...(field.value ||
																		[]),
																	option.value,
																]);
															} else {
																field.onChange(
																	field.value?.filter(
																		(
																			value: string,
																		) =>
																			value !==
																			option.value,
																	),
																);
															}
														}}
													/>
												</FormControl>
												<FormLabel className="text-sm font-normal cursor-pointer leading-none pt-[0.25rem]">
													{option.label}
												</FormLabel>
											</FormItem>
										)}
									/>
								))}
							</div>
						</FormItem>
					)}
				/>
			);
		case "dropdown-checkbox":
			return (
				<FormField
					control={form.control}
					name={filter.name}
					render={({ field }) => (
						<FormItem className="space-y-2">
							<FormLabel>{filter.label}</FormLabel>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										className="justify-between w-full"
									>
										{field.value?.length > 0
											? `${field.value.length} selected`
											: filter.placeholder}
										<ChevronDownIcon className="w-4 h-4 ml-2" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[200px] overflow-y-auto">
									<DropdownMenuLabel>
										Select {filter.label}
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									{filter.options.map((option) => (
										<DropdownMenuCheckboxItem
											key={option.value}
											checked={field.value.includes(
												option.value,
											)}
											onCheckedChange={(checked) => {
												const updatedValue = checked
													? [
															...field.value,
															option.value,
														]
													: field.value.filter(
															(value: string) =>
																value !==
																option.value,
														);
												field.onChange(updatedValue);
											}}
										>
											{option.label}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</FormItem>
					)}
				/>
			);
		case "number-range":
			return (
				<div className="flex flex-col gap-2">
					<FormLabel className="text-sm font-base text-gray-500 -mb-2">
						{filter.label}
					</FormLabel>
					<div className="flex gap-4">
						<FormField
							control={form.control}
							name={filter.min.name}
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										{filter.min.label}
									</FormLabel>
									<FormControl>
										<Input
											type="number"
											{...field}
											className="w-[100px] rounded-lg border border-gray-200"
											min={0}
											onBlur={() => {
												if (
													field.value &&
													+field.value < 0
												) {
													field.onChange(0);
												}
											}}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name={filter.max.name}
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-sm font-medium">
										{filter.max.label}
									</FormLabel>
									<FormControl>
										<Input
											type="number"
											{...field}
											className="w-[100px] rounded-lg border border-gray-200"
											max={850}
											onBlur={() => {
												if (
													field.value &&
													+field.value > 850
												) {
													field.onChange(850);
												}
											}}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</div>
				</div>
			);
		case "date-range":
			return (
				<FormField
					control={form.control}
					name={filter.name}
					render={({ field }) => (
						<FormItem className="flex flex-col">
							<FormLabel className="text-sm font-semibold text-gray-500">
								{filter.label}
							</FormLabel>
							<div className="rounded-lg border border-gray-200 w-[335px]">
								<Calendar
									mode="range"
									selected={
										field.value as DateRange | undefined
									}
									onSelect={(date) => {
										field.onChange(date);
									}}
									numberOfMonths={1}
									className="rounded-md border"
									disabled={(date) => date > new Date()} // disables future date selection
								/>
							</div>
						</FormItem>
					)}
				/>
			);
		default:
			return null;
	}
};

export const FilterForm: React.FC<FilterFormProps> = ({
	form,
	filterConfig,
}) => {
	return (
		<>
			<Form {...form}>
				<div className="flex flex-col max-h-96">
					<div className="flex-1 overflow-y-auto p-4 pt-0">
						<div className="flex flex-col gap-4 py-4 px-2 w-[360px]">
							{filterConfig
								.filter((filter) => !filter.hidden)
								.map((filter) => (
									<div
										key={
											typeof filter.label === "string"
												? filter.label
												: typeof filter.label ===
													  "object"
													? (filter?.label as any)
															?.key
													: ""
										}
									>
										{renderFilter(filter, form)}
									</div>
								))}
						</div>
					</div>
				</div>
			</Form>
		</>
	);
};
