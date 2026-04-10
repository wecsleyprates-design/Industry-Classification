import * as React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
	isDisabled?: boolean;
	currentFilterCount?: number;
}

export function FilterOptionsDropdown({
	form,
	isDisabled = false,
	currentFilterCount,
}: FilterOptionsDropdownProps) {
	const [open, setOpen] = React.useState(false);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="flex items-center gap-2"
					disabled={isDisabled}
				>
					{!!currentFilterCount && currentFilterCount > 0 && (
						<div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
							{currentFilterCount}
						</div>
					)}
					Filter
					{open ? (
						<ChevronUpIcon className="w-4 h-4" />
					) : (
						<ChevronDownIcon className="w-4 h-4" />
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="p-0 w-96" sideOffset={5} tabIndex={0}>
				<div className="w-full overflow-y-auto">
					<div className="sticky top-0 z-10 flex items-center justify-between p-2 border-b bg-background">
						<DropdownMenuLabel className="text-lg font-bold">
							Filter Options
						</DropdownMenuLabel>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => {
								setOpen(false);
							}}
						>
							<XMarkIcon className="w-4 h-4" />
							<span className="sr-only">Close</span>
						</Button>
					</div>

					<div className="p-4">{form}</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
