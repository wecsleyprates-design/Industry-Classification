import React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export type UserOption = {
	id: string;
	first_name: string;
	last_name: string;
};

type UpdateStatusDropdownProps = {
	selectedUser?: UserOption;
	userOptions: UserOption[];
	onSelect: (status: string) => void;
	disabled?: boolean;
};

export const UserDropdown: React.FC<UpdateStatusDropdownProps> = ({
	selectedUser,
	userOptions,
	onSelect,
	disabled = false,
}) => {
	const [open, setOpen] = React.useState(false);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<div
					className="flex flex-row items-center justify-between w-[450px] gap-2 border border-gray-200 rounded-lg px-2 h-11 text-sm"
					aria-disabled={disabled}
				>
					{selectedUser?.first_name} {selectedUser?.last_name}
					<Button
						variant="ghost"
						size="icon"
						className="text-gray-800 hover:bg-transparent p-0 -mr-2"
						disabled={disabled}
					>
						{open ? (
							<ChevronUpIcon className="size-4" />
						) : (
							<ChevronDownIcon className="size-4" />
						)}
					</Button>
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="p-0 w-[450px] z-[101]"
				sideOffset={10}
				side="bottom"
				align="end"
			>
				<div className="space-y-1 overflow-auto max-h-60">
					{userOptions.map((user) => (
						<DropdownMenuItem
							key={user.id}
							onClick={() => {
								if (!disabled) {
									onSelect(user.id);
									setOpen(false);
								}
							}}
							className="flex w-full items-center gap-2 hover:cursor-pointer p-2"
							aria-disabled={disabled}
						>
							{user.first_name} {user.last_name}
						</DropdownMenuItem>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
