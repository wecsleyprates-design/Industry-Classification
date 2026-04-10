import * as React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useDropdownPosition } from "@/hooks";

import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Form } from "@/ui/form";

export interface FilterOptionsDropdownProps {
	form: React.ReactElement;
	dropdownRef?: React.RefObject<{
		setOpen: (open: boolean) => void;
	} | null>;
	onClearFilters?: () => void;
	hasActiveFilters?: boolean;
}

export function FilterOptionsDropdown({
	form,
	dropdownRef,
	onClearFilters,
	hasActiveFilters = false,
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

	const handleClearFilters = () => {
		onClearFilters?.();
	};

	/*
	 * onOpenChange is set to an empty function to prevent default close behavior.
	 * We manage open state manually via the button onClick and close button.
	 * onInteractOutside prevents closing when clicking outside to allow users
	 * to interact with filter controls without accidentally dismissing the dropdown.
	 * Users can close via the X button in the header.
	 */
	return (
		<DropdownMenu open={open} onOpenChange={() => {}} modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					ref={ref}
					variant="outline"
					className="flex items-center gap-2 font-semibold h-10 px-4 rounded-lg text-sm"
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
				className="w-auto p-0 rounded-xl overflow-y-auto"
				sideOffset={5}
				side={side}
				style={{ maxHeight }}
				align="end"
				onInteractOutside={(e) => {
					e.preventDefault();
				}}
			>
				<div className="flex flex-col max-h-full">
					<div className="flex-none bg-background z-10 flex justify-between items-center h-12 px-4 border-b rounded-t-xl">
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

					<div className="flex-1 min-h-0 overflow-y-auto">{form}</div>

					{hasActiveFilters && onClearFilters && (
						<div className="flex-none bg-background border-t p-3">
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={handleClearFilters}
							>
								Clear Filters
							</Button>
						</div>
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
