import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { twMerge } from "tailwind-merge";
import AccountsPopover from "./AccountsPopOver";
import FilterPopover from "./FilterPopover";
import { type IFilterProps } from "./types";

const Filter: React.FC<IFilterProps> = ({
	title,
	data,
	filterHandler,
	dateFilterHandler,
	applyFiltersAndDates,
	initialValues,
	dateFilterPayload,
	configs,
	type,
	payload,
	popOverType = "filter",
	className = "",
}) => {
	const filterButtonRef = useRef<HTMLButtonElement | null>(null);
	const popoverId = useId();
	const [isPopoverOpen, setPopoverOpen] = useState(false);
	const aliases = useMemo(() => data.map((value) => value.alias), [data]);
	const filterLength =
		payload?.filter &&
		Object.values(payload?.filter).reduce(
			(total: number, filterArray: any) => total + Number(filterArray.length),
			0,
		);
	// Button styling: dropdown/checkbox/radio or date filters applied
	const hasDropdownFilters =
		aliases.some((value) => Object.keys(initialValues ?? {}).includes(value)) ||
		Object.keys(dateFilterPayload ?? {}).length > 0;

	const handlePopoverToggle = () => {
		setPopoverOpen((prevOpen) => !prevOpen);
	};

	const handlePopoverClose = () => {
		setPopoverOpen(false);
	};

	useEffect(() => {
		if (!isPopoverOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") handlePopoverClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isPopoverOpen]);

	return (
		<div className="relative inline-block text-left md:pl-5 lg:pl-0">
			<div>
				<button
					type="button"
					onClick={handlePopoverToggle}
					ref={filterButtonRef}
					aria-haspopup="dialog"
					aria-expanded={isPopoverOpen}
					aria-controls={isPopoverOpen ? popoverId : undefined}
					className={twMerge(
						"inline-flex h-8 w-full justify-between align-middle gap-x-1.5 rounded-md px-3 py-2 text-xs font-semibold shadow-sm ring-1 ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
						hasDropdownFilters && popOverType !== "accounts"
							? "ring-blue-300 hover:bg-blue-200 bg-blue-50 text-blue-900"
							: "bg-white ring-gray-300 hover:bg-gray-50 text-gray-900",
						type === "large" ? "gap-x-1 h-10 items-center px-2 max-w-fit" : "",
						className,
					)}
				>
					{title === "Filter"
						? filterLength
							? ` ${filterLength ?? 0} filter applied`
							: title
						: title}
					<ChevronDownIcon
						className={twMerge(
							"-mr-1 h-5 w-5",
							hasDropdownFilters && popOverType === "filter"
								? "text-blue-700"
								: "text-gray-400",
						)}
						aria-hidden="true"
					/>
				</button>
			</div>

			{isPopoverOpen && popOverType === "filter" && (
				<FilterPopover
					initialValues={initialValues}
					data={data}
					filterButtonRef={filterButtonRef}
					dateFilterPayload={dateFilterPayload}
					handlePopoverClose={handlePopoverClose}
					filterHandler={filterHandler}
					dateFilterHandler={dateFilterHandler}
					applyFiltersAndDates={applyFiltersAndDates}
					configs={configs}
					popoverId={popoverId}
				/>
			)}
			{isPopoverOpen && popOverType === "accounts" && (
				<AccountsPopover
					initialValues={initialValues}
					data={data}
					filterButtonRef={filterButtonRef}
					dateFilterPayload={dateFilterPayload}
					handlePopoverClose={handlePopoverClose}
					filterHandler={filterHandler}
					dateFilterHandler={dateFilterHandler}
					configs={configs}
					popoverId={popoverId}
				/>
			)}
		</div>
	);
};

export default Filter;
