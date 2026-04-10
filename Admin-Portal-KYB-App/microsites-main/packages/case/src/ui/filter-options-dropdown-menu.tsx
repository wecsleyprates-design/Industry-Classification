import * as React from "react";
import { useFormContext } from "react-hook-form";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDropdownPosition } from "@/hooks";
import { type FilterConfigItem } from "./filter-form";

import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export interface FilterOptionsDropdownProps {
	form: React.ReactElement;
	dropdownRef?: React.RefObject<{
		setOpen: (open: boolean) => void;
	} | null>;
	filterConfig: FilterConfigItem[];
	onFilterChange: (values: any) => void;
	onClose?: () => void;
}

export function FilterOptionsDropdown({
	form,
	dropdownRef,
	onFilterChange,
	onClose,
	filterConfig,
}: FilterOptionsDropdownProps) {
	const [open, setOpen] = React.useState(false);
	const { ref, maxHeight, side } = useDropdownPosition<HTMLButtonElement>({
		margin: 20,
		updateOnScroll: true,
	});

	React.useImperativeHandle(
		dropdownRef,
		() => ({
			setOpen,
		}),
		[setOpen],
	);

	/*
	 * onOpenChange is set to an empty function to prevent default close behavior.
	 * We manage open state manually via the button onClick and close button.
	 * onInteractOutside prevents closing when clicking outside to allow users
	 * to interact with filter controls without accidentally dismissing the dropdown.
	 * Users can close via the X button in the header.
	 */
	const { getValues, reset } = useFormContext();

	const handleApply = () => {
		onFilterChange(getValues());
		onClose?.();
	};

	const handleReset = () => {
		const defaultValues = filterConfig.reduce<Record<string, any>>(
			(acc, filter) => {
				if (filter.type === "number-range") {
					acc[filter.min.name] = "";
					acc[filter.max.name] = "";
				} else if (filter.type === "date-range") {
					acc[filter.name] = { from: undefined, to: undefined };
				} else {
					acc[filter.name] = [];
				}
				return acc;
			},
			{},
		);

		reset(defaultValues);
		onFilterChange(defaultValues);
	};

	return (
		<DropdownMenu open={open} onOpenChange={() => {}} modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					ref={ref as React.RefObject<HTMLButtonElement>}
					variant="outline"
					className="flex items-center gap-2 font-semibold h-11 rounded-lg"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						setOpen((prev) => !prev);
					}}
				>
					Filters
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent
				className="min-w-80 w-auto p-0 rounded-xl overflow-hidden"
				sideOffset={5}
				side={side}
				style={{ maxHeight }}
				align="end"
				onInteractOutside={(e) => {
					e.preventDefault();
				}}
			>
				<div className="flex-none bg-background flex justify-between items-center h-14 px-4 border-b rounded-t-xl">
					<DropdownMenuLabel className="text-lg font-semibold">
						Filter Options
					</DropdownMenuLabel>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => {
							setOpen(false);
						}}
					>
						<XMarkIcon className="h-4 w-4" />
						<span className="sr-only">Close</span>
					</Button>
				</div>

				<div
					className="flex-1 overflow-y-clip"
					style={{
						maxHeight: `calc(${maxHeight}px - 8rem)`,
					}}
				>
					<div className="overflow-visible">{form}</div>
					<div className="h-4" />
				</div>

				<div className="flex-none bg-background flex justify-end gap-x-2 items-center min-h-[72px] px-4 border-t rounded-b-xl">
					<Button
						type="button"
						variant="outline"
						size="lg"
						onClick={handleReset}
					>
						Reset
					</Button>
					<Button type="button" size="lg" onClick={handleApply}>
						Apply
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
