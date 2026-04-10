import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Select, { type MultiValue } from "react-select";
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from "dayjs";
import { twMerge } from "tailwind-merge";
import { getCurrentTimezone } from "@/lib/helper";
import { type TOption } from "@/types/common";
import Button from "../Button";
import { Divider } from "../Dividers";
import {
	type DateRangeType,
	type DateType,
	type DateValueType,
	type IFilterPopoverProps,
	type TFilterOption,
	type TSelectedValueType,
} from "./types";

const FilterPopover: React.FC<IFilterPopoverProps> = ({
	data,
	dateFilterPayload,
	filterHandler,
	dateFilterHandler,
	applyFiltersAndDates,
	handlePopoverClose,
	initialValues,
	filterButtonRef,
	popoverId,
}) => {
	const popoverRef = useRef<HTMLDivElement | null>(null);
	// Refs hold latest values so Apply uses current selection even before state has flushed
	const filterOptionsRef = useRef<Record<string, TSelectedValueType[]>>({});
	const filterDateOptionsRef = useRef<Partial<Record<string, DateRangeType>>>(
		{},
	);

	// Position for portaled popover (so datepicker is at body level and not constrained by Menu/popover DOM)
	const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
	const updatePosition = () => {
		if (!filterButtonRef?.current) return;
		const rect = (
			filterButtonRef.current as HTMLElement
		).getBoundingClientRect();
		const width = 288; // w-[18rem]
		const minInset = 16;
		const maxLeft = Math.max(minInset, window.innerWidth - width - minInset);
		const desiredLeft = rect.right - width;
		setPopoverPosition({
			top: rect.bottom + 8,
			left: Math.min(Math.max(desiredLeft, minInset), maxLeft),
		});
	};
	useLayoutEffect(() => {
		updatePosition();
		const onScrollOrResize = () => updatePosition();
		window.addEventListener("scroll", onScrollOrResize, true);
		window.addEventListener("resize", onScrollOrResize);
		return () => {
			window.removeEventListener("scroll", onScrollOrResize, true);
			window.removeEventListener("resize", onScrollOrResize);
		};
	}, []);

	const [filterOptions, setFilterOptions] = useState<
		Record<string, TSelectedValueType[]>
	>({});

	const [filterDateOptions, setFilterDateOptions] = useState<
		Partial<Record<string, DateRangeType>>
	>({});

	useEffect(() => {
		if (initialValues) {
			setFilterOptions(initialValues);
			filterOptionsRef.current = initialValues;
		}
	}, [initialValues]);

	// Sync from URL: set date state when payload has real date ranges; clear when it doesn't so UI resets (e.g. after Reset)
	useEffect(() => {
		const hasDateRanges =
			dateFilterPayload &&
			Object.values(dateFilterPayload).some((range) => {
				const r = range as DateRangeType | undefined;
				return r?.startDate != null && r?.endDate != null;
			});
		if (hasDateRanges) {
			setFilterDateOptions(dateFilterPayload);
			filterDateOptionsRef.current = dateFilterPayload;
		} else {
			setFilterDateOptions({});
			filterDateOptionsRef.current = {};
		}
	}, [dateFilterPayload]);

	useEffect(() => {
		const handler = (e: Event) => {
			const targetNode = e.target as Node | null;

			if (
				filterButtonRef?.current &&
				(filterButtonRef.current as HTMLElement).contains(targetNode)
			)
				return;

			if (
				popoverRef?.current &&
				(popoverRef.current as HTMLElement).contains(targetNode)
			)
				return;

			// Don't close when clicking inside a datepicker calendar (often rendered in a portal)
			const isDatepickerCalendar = (e.target as Element)?.closest?.(
				"[data-tailwindcss-datepicker], [id*='datepicker'], [class*='datepicker']",
			);
			if (isDatepickerCalendar) return;

			handlePopoverClose?.();
		};

		document.addEventListener("mousedown", handler as EventListener);

		return () => {
			document.removeEventListener("mousedown", handler as EventListener);
		};
	}, []);

	const handleCheckboxChange = (
		alias: string,
		value: TSelectedValueType,
		isChecked: boolean,
	) => {
		setFilterOptions((prevOptions) => {
			const obj: TSelectedValueType[] = prevOptions?.[alias] ?? [];
			const next = isChecked
				? { ...prevOptions, [alias]: [...obj, value] }
				: { ...prevOptions, [alias]: obj.filter((item) => item !== value) };
			filterOptionsRef.current = next;
			return next;
		});
	};

	const MultiSelectDropdown: React.FC<TFilterOption> = (item) => {
		const [selectedOptions, setSelectedOptions] = useState<any[]>(
			filterOptions[item.alias] ?? [],
		);

		useEffect(() => {
			setSelectedOptions(filterOptions[item.alias] ?? []);
		}, [filterOptions, item.alias]);

		const filteredOptions = item.filterOptions;
		const selectedObjects = filteredOptions?.filter((option) =>
			selectedOptions.includes(option.value),
		);

		return (
			<Select
				isMulti
				options={filteredOptions}
				onChange={(e: MultiValue<TOption>) => {
					setFilterOptions((prevFilterOptions) => {
						const next = {
							...prevFilterOptions,
							[item.alias]: e.map((opt) => opt.value),
						};
						filterOptionsRef.current = next;
						return next;
					});
				}}
				value={selectedObjects}
				closeMenuOnSelect={false}
			/>
		);
	};

	const CheckboxFilter = (item: TFilterOption) => (
		<div
			className={`grid ${
				item?.isVertical ? "grid-rows-1" : `grid-cols-${1}`
			} grid-cols-${item.configs?.cols ? item.configs?.cols : 1}  my-2`}
		>
			{item.filterOptions?.map((option, index) => {
				return (
					<label key={index} className="block mb-2 truncate">
						<div
							className={`w-min max-h-min ${
								!option?.disabled ? "cursor-pointer" : ""
							}`}
						>
							<input
								type="checkbox"
								disabled={option?.disabled ?? false}
								checked={Boolean(
									filterOptions?.[item.alias]?.includes(option.value),
								)}
								onChange={(e) => {
									handleCheckboxChange(
										item.alias,
										option.value,
										e.target.checked,
									);
								}}
								className={`mr-2 accent-black leading-tight h-4 w-4 border-1 border-slate-700 ${
									!option?.disabled ? "cursor-pointer" : ""
								}`}
							/>
							<span className="text-sm font-medium align-top">
								{option.label}
							</span>
						</div>
					</label>
				);
			})}
		</div>
	);

	const RadioFilter = (item: TFilterOption) => (
		<div
			className={`grid ${
				item?.isVertical ? "grid-rows-1" : `grid-cols-${1}`
			} grid-cols-${item.configs?.cols ? item.configs?.cols : 1} my-2`}
		>
			{item.filterOptions?.map((option, index) => {
				const isChecked = Boolean(
					filterOptions?.[item.alias]?.[0] === option.value,
				);

				return (
					<label key={index} className="block mb-2 truncate">
						<div
							className={twMerge(
								"w-min max-h-min",
								!option?.disabled && "cursor-pointer",
							)}
						>
							<input
								type="radio"
								name={item.alias} // ensures group behavior
								disabled={option?.disabled ?? false}
								checked={isChecked}
								onChange={() => {
									setFilterOptions((prev) => {
										const next = { ...prev, [item.alias]: [option.value] };
										filterOptionsRef.current = next;
										return next;
									});
								}}
								className={`mr-2 accent-black leading-tight h-4 w-4 border-1 border-slate-700 ${
									!option?.disabled ? "cursor-pointer" : ""
								}`}
							/>
							<span className="text-sm font-medium align-top">
								{option.label}
							</span>
						</div>
					</label>
				);
			})}
		</div>
	);

	const handleValueChange = (alias: string, value: DateValueType) => {
		if (value) {
			setFilterDateOptions((prevDateOptions) => {
				const next = {
					...prevDateOptions,
					[alias]: {
						startDate: value.startDate ? value.startDate : null,
						endDate: value.endDate ? value.endDate : null,
					},
				};
				filterDateOptionsRef.current = next;
				return next;
			});
		}
	};

	const DateFilter = (item: TFilterOption) => {
		const raw = (filterDateOptions[item.alias] as
			| { startDate: DateType; endDate: DateType }
			| undefined) ?? { startDate: null, endDate: null };
		// react-tailwindcss-datepicker expects Date | null, not string
		const value = {
			startDate:
				raw.startDate instanceof Date
					? raw.startDate
					: raw.startDate
						? new Date(raw.startDate)
						: null,
			endDate:
				raw.endDate instanceof Date
					? raw.endDate
					: raw.endDate
						? new Date(raw.endDate)
						: null,
		};
		return (
			<div className="datepicker-filter-wrap my-2">
				<Datepicker
					value={value}
					onChange={(newValue) => handleValueChange(item.alias, newValue)}
					maxDate={new Date()}
					displayFormat="MM-DD-YYYY"
					placeholder="Select date range"
					containerClassName="relative w-full"
					inputClassName="w-full h-9 text-sm rounded-md border border-gray-300 bg-white px-2 py-1 text-black focus:outline-none focus:ring-1 focus:ring-gray-400 cursor-pointer"
				/>
			</div>
		);
	};

	const popoverContent = (
		<div
			id={popoverId}
			ref={popoverRef}
			role="dialog"
			aria-label="Filter options"
			className="flex w-[18rem] flex-col bg-white border rounded-md shadow-lg"
			style={{
				position: "fixed",
				top: popoverPosition.top,
				left: popoverPosition.left,
				zIndex: 20,
				maxHeight: `min(32rem, calc(100vh - ${popoverPosition.top}px - 24px))`,
			}}
		>
			<div className="flex flex-shrink-0 justify-between items-center mt-2 h-[2.5rem]">
				<span className="p-4 text-base font-semibold">Filter options</span>
				<Button
					className="z-0 items-center h-8 border-0 border-white shadow-none active:bg-slate-700"
					size="sm"
					outline={true}
					onClick={handlePopoverClose}
				>
					<span className="text-blue-700">Close</span>
				</Button>
			</div>
			<Divider />
			<div className="flex-1 min-h-0 overflow-y-auto p-4">
				{data.map((item, i) => {
					return (
						<div key={i}>
							<span className="text-sm font-semibold">{item.title}</span>
							{item.type === "multi-select-dropdown" &&
								(MultiSelectDropdown(item) as React.ReactNode)}
							{item.type === "checkbox" &&
								(CheckboxFilter(item) as React.ReactNode)}
							{item.type === "radio" && (RadioFilter(item) as React.ReactNode)}
							{item.type === "date-range" &&
								(DateFilter(item) as React.ReactNode)}
						</div>
					);
				})}
			</div>
			<Divider />
			<div className="flex flex-shrink-0 justify-start gap-2 p-4 pt-2">
				<Button
					type="button"
					className="flex items-center h-8 px-2 border"
					outline={true}
					color="transparent"
					onClick={() => {
						setFilterOptions({});
						setFilterDateOptions({});
						filterOptionsRef.current = {};
						filterDateOptionsRef.current = {};
						if (applyFiltersAndDates) {
							applyFiltersAndDates({}, {});
						} else {
							filterHandler?.({});
							dateFilterHandler?.({});
						}
					}}
				>
					<span className="text-xs font-semibold text-slate-700">Reset</span>
				</Button>
				<Button
					type="submit"
					className="flex items-center h-8"
					color="dark"
					onClick={() => {
						// Use refs so we have the latest selection even if state hasn't flushed yet
						const appliedFilters = {
							...(Object.keys(filterOptionsRef.current).length
								? filterOptionsRef.current
								: filterOptions),
						};

						const booleanFields = data.reduce(
							(acc: Record<string, boolean>, item) => {
								if (item.isBooleanField) {
									acc[item.alias] = true;
								}
								return acc;
							},
							{},
						);

						Object.keys(appliedFilters).forEach((key) => {
							if (booleanFields[key] && appliedFilters[key]?.length) {
								const value = appliedFilters[key][0];
								appliedFilters[key] = [value === true || value === "true"];
							}
						});

						const selectedDates: Record<string, DateType[]> = {};
						const timeZone = getCurrentTimezone();
						const dateOptionsForApply: Partial<Record<string, DateRangeType>> =
							Object.keys(filterDateOptionsRef.current ?? {}).length
								? (filterDateOptionsRef.current ?? {})
								: filterDateOptions;
						for (const [alias, range] of Object.entries(dateOptionsForApply)) {
							const r = range as DateRangeType | undefined;
							if (r?.startDate && r?.endDate) {
								const start = dayjs(r.startDate)
									.locale(timeZone)
									.hour(0)
									.minute(0)
									.second(0);
								const end = dayjs(r.endDate)
									.locale(timeZone)
									.hour(23)
									.minute(59)
									.second(59);
								selectedDates[alias] = [start.toDate(), end.toDate()];
							}
						}

						if (applyFiltersAndDates) {
							applyFiltersAndDates(appliedFilters, selectedDates);
						} else {
							// Fallback: filterHandler/dateFilterHandler build from window.location.search so sequential calls merge
							filterHandler?.(appliedFilters);
							dateFilterHandler?.(selectedDates);
						}
						handlePopoverClose?.();
					}}
				>
					<span className="text-xs font-semibold ">Apply</span>
				</Button>
			</div>
		</div>
	);

	return createPortal(popoverContent, document.body);
};

export default FilterPopover;
