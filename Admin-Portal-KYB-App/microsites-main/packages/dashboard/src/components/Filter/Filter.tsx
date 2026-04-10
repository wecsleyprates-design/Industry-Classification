import React, { useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import FilterPopover from "./FilterPopover";
import { type IFilterProps } from "./types";

const Filter: React.FC<IFilterProps> = ({
	title,
	data,
	filterHandler,
	dateFilterHandler,
	initialValues,
	dateFilterPayload,
	configs,
}) => {
	const filterButtonRef = useRef(null);
	const [isPopoverOpen, setPopoverOpen] = useState(false);
	const [isFilterApplied, setIsFilterApplied] = useState(false);
	const aliases = useMemo(() => data.map((value) => value.alias), [data]);
	useEffect(() => {
		if (
			aliases.some((value) =>
				Object.keys(initialValues ?? {}).includes(value),
			) ||
			Object.keys(dateFilterPayload ?? {}).length > 0
		) {
			setIsFilterApplied(true);
		} else setIsFilterApplied(false);
	}, [initialValues, dateFilterPayload]);

	const handlePopoverToggle = () => {
		setPopoverOpen((prevOpen) => !prevOpen);
	};

	const handlePopoverClose = () => {
		setPopoverOpen(false);
	};

	return (
		<Menu
			as="div"
			className="relative inline-block  text-left md:pl-5 lg:pl-0 "
		>
			<div>
				<Menu.Button
					onClick={handlePopoverToggle}
					ref={filterButtonRef}
					className={`inline-flex h-8 w-full lg:w-40 justify-between align-middle gap-x-1.5 rounded-md px-3 py-2 text-xs font-semibold ring-1 ring-inset ${
						isFilterApplied
							? "ring-blue-300 hover:bg-blue-200 bg-blue-50 text-blue-900"
							: "bg-white ring-gray-300 hover:bg-gray-50 text-gray-900"
					}`}
				>
					{title}
					<ChevronDownIcon
						className={`-mr-1 h-5 w-5 ${
							isFilterApplied ? "text-blue-700" : "text-gray-400"
						}`}
						aria-hidden="true"
					/>
				</Menu.Button>
			</div>

			{isPopoverOpen && (
				<FilterPopover
					initialValues={initialValues}
					data={data}
					filterButtonRef={filterButtonRef}
					dateFilterPayload={dateFilterPayload}
					handlePopoverClose={handlePopoverClose}
					filterHandler={filterHandler}
					dateFilterHandler={dateFilterHandler}
					configs={configs}
				/>
			)}
		</Menu>
	);
};

export default Filter;
