import React, { useEffect, useRef, useState } from "react";
import CloseIcon from "@/assets/svg/CloseICon";
import Button from "../Button";
import { Divider } from "../Dividers";
import {
	type IFilterPopoverProps,
	type TFilterOption,
	type TSelectedValueType,
} from "./types";

const AccountsPopover: React.FC<IFilterPopoverProps> = ({
	data,
	filterHandler,
	handlePopoverClose,
	initialValues,
	filterButtonRef,
	popoverId,
}) => {
	const popoverRef = useRef<HTMLDivElement | null>(null);
	const [selectAll, setSelectAll] = useState<boolean>(false);
	const [filterOptions, setFilterOptions] = useState<
		Record<string, TSelectedValueType[]>
	>({ filter_account: [] });

	useEffect(() => {
		if (initialValues) {
			setFilterOptions(initialValues);
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
	});

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

	const handleCheckboxAll = (isChecked: boolean, item: TFilterOption) => {
		let change;
		if (isChecked) {
			change = true;
		} else {
			change = false;
		}
		for (const option of item?.filterOptions ?? []) {
			if (!filterOptions?.[item.alias]?.includes(option.value) || !change)
				handleCheckboxChange(item.alias, option.value, change);
		}
		setSelectAll((prev) => !prev);
	};

	const CheckboxFilter = (item: TFilterOption) => {
		return (
			<div
				className={`grid ${
					item?.isVertical ? "grid-rows-1" : `grid-cols-${1}`
				} grid-cols-${item.configs?.cols ? item.configs?.cols : 1} my-2`}
			>
				<div className="block mb-2 truncate cursor-pointer w-min max-h-min">
					<input
						type="checkbox"
						disabled={false}
						checked={selectAll}
						onChange={(e) => {
							handleCheckboxAll(e.target.checked, item);
						}}
						className={`mr-2 accent-black leading-tight h-4 w-4 border-1 border-slate-700 cursor-pointer `}
					/>
					<span className="text-sm font-medium text-blue-600 align-top ">
						Select All
					</span>
				</div>
				{item.filterOptions?.map((option, index) => {
					return (
						<label key={index} className="block mb-2 truncate">
							<div
								className={`max-h-min flex w-full ${
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
										!option?.disabled ? "cursor-pointer text-blue-600" : ""
									}`}
								/>
								<div className="w-full -mt-1">
									<div className="text-sm break-all align-top text-wrap">
										{option.label}
									</div>
									<div className="text-sm text-gray-500 align-top">
										{option.subLabel}
									</div>
								</div>
							</div>
						</label>
					);
				})}
			</div>
		);
	};

	useEffect(() => {
		if (
			filterOptions?.filter_account?.length ===
			data?.filter((val) => val.type === "checkbox")[0]?.filterOptions?.length
		) {
			setSelectAll(true);
		} else {
			setSelectAll(false);
		}
	}, [filterOptions, data]);

	return (
		<div
			id={popoverId}
			tabIndex={0}
			ref={popoverRef}
			className="absolute z-20 w-[17rem] bg-white border rounded-xl mt-2 shadow-lg right-0"
		>
			<div className=" flex justify-between items-center mt-2 h-[2.5rem]">
				<span className="p-4 text-base font-semibold">Accounts</span>
				<Button
					className="z-0 items-center h-8 mr-2 border-0 border-white shadow-none"
					size="sm"
					color="transparent"
					onClick={handlePopoverClose}
				>
					<CloseIcon />
				</Button>
			</div>
			<Divider />
			<div className="px-4 py-1">
				{data.map((item, i) => {
					return (
						<div key={i}>
							{item.type === "checkbox" && CheckboxFilter(item)}
						</div>
					);
				})}
			</div>
			<Divider />
			<div className="flex justify-end flex-auto gap-2 p-2">
				<Button
					type="submit"
					color="dark"
					className="flex items-center h-8"
					onClick={() => {
						filterHandler?.(filterOptions);
						handlePopoverClose?.();
					}}
				>
					<span className="text-sm font-semibold ">Apply</span>
				</Button>
			</div>
		</div>
	);
};

export default AccountsPopover;
