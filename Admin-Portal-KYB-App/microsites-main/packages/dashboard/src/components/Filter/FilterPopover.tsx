import React, { useEffect, useRef, useState } from "react";
import Select, { type MultiValue } from "react-select";
import Datepicker from "react-tailwindcss-datepicker";
import dayjs from "dayjs";
import { type TOption } from "@/lib/types/common";
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
	handlePopoverClose,
	initialValues,
	filterButtonRef,
}) => {
	const popoverRef = useRef<HTMLDivElement | null>(null);

	const [filterOptions, setFilterOptions] = useState<
		Record<string, TSelectedValueType[]>
	>({});

	const [filterDateOptions, setFilterDateOptions] = useState<
		Partial<Record<string, DateRangeType>>
	>({});

	useEffect(() => {
		if (initialValues) {
			setFilterOptions(initialValues);
		}
	}, []);

	useEffect(() => {
		if (dateFilterPayload) {
			setFilterDateOptions(dateFilterPayload);
		}
	}, []);

	useEffect(() => {
		popoverRef?.current?.focus();
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

			if (
				popoverRef.current &&
				!(popoverRef.current as HTMLElement).contains(targetNode)
			) {
				handlePopoverClose?.();
			}
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
			if (isChecked) {
				return {
					...prevOptions,
					[alias]: [...obj, value],
				};
			}

			const updatedObj = obj.filter((item) => item !== value);

			return {
				...prevOptions,
				[alias]: updatedObj,
			};
		});
	};

	const MultiSelectDropdown: React.FC<TFilterOption> = (item) => {
		const [selectedOptions, setSelectedOptions] = useState<any[]>(
			filterOptions["data_cases.status"] ?? [],
		);

		useEffect(() => {
			setSelectedOptions(filterOptions["data_cases.status"] ?? []);
		}, [filterOptions]);

		const filteredOptions = item.filterOptions;
		const selectedObjects = filteredOptions?.filter((option) =>
			selectedOptions.includes(option.value),
		);

		return (
			<Select
				isMulti
				options={filteredOptions}
				onChange={(e: MultiValue<TOption>) => {
					setFilterOptions({
						"data_cases.status": e.map((item) => item.value),
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
								checked={filterOptions?.[item.alias]?.includes(option.value)}
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

	const handleValueChange = (alias: string, value: DateValueType) => {
		if (value)
			setFilterDateOptions((prevDateOptions) => {
				return {
					...prevDateOptions,
					[alias]: {
						startDate: value.startDate ? value.startDate : null,
						endDate: value.endDate ? value.endDate : null,
					},
				};
			});
	};

	const DateFilter = (item: TFilterOption) => (
		<Datepicker
			value={
				(filterDateOptions[item.alias] ?? {
					startDate: null,
					endDate: null,
				}) as any
			}
			maxDate={new Date()}
			displayFormat="MM-DD-YYYY"
			popoverDirection="down"
			onChange={(value) => {
				handleValueChange(item.alias, value);
			}}
			inputClassName="focus:outline-none w-full h-9 text-sm rounded-md font-normal bg-white border-gray-300 border text-black p-1"
		/>
	);

	return (
		<div
			ref={popoverRef}
			className="absolute z-20 w-[18rem] bg-white border rounded-md mt-2 shadow-lg"
			tabIndex={0}
		>
			<div className=" flex justify-between items-center mt-2 h-[2.5rem]">
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
			<div className="p-4">
				{data.map((item, i) => {
					return (
						<div key={i}>
							<span className="text-sm font-semibold">{item.title}</span>
							{item.type === "multi-select-dropdown" && (
								<MultiSelectDropdown {...item} />
							)}
							{item.type === "checkbox" && <CheckboxFilter {...item} />}
							{item.type === "date-range" && <DateFilter {...item} />}
						</div>
					);
				})}
				{/* <Divider /> */}
				<div className="flex justify-start flex-auto gap-2 pt-2">
					<Button
						type="button"
						className="flex items-center h-8 px-2 border"
						outline={true}
						color="transparent"
						onClick={() => {
							setFilterOptions({});
							setFilterDateOptions({});
						}}
					>
						<span className="text-xs font-semibold text-slate-700">Reset</span>
					</Button>
					<Button
						type="submit"
						className="flex items-center h-8"
						onClick={() => {
							filterHandler?.(filterOptions);
							const selectedDates: Record<string, DateType[]> = {};

							for (const [val, key] of Object.entries(filterDateOptions)) {
								if (key?.startDate && key?.endDate) {
									const start = dayjs(key?.startDate)
										.hour(0)
										.minute(0)
										.second(0);
									const end = dayjs(key?.endDate)
										.hour(23)
										.minute(59)
										.second(59);
									selectedDates[val] = [start.toDate(), end.toDate()];
								}
							}
							dateFilterHandler?.(selectedDates);
							handlePopoverClose?.();
						}}
					>
						<span className="text-xs font-semibold ">Apply</span>
					</Button>
				</div>
			</div>
		</div>
	);
};

export default FilterPopover;
