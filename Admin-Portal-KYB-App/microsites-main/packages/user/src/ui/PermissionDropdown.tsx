"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export default function PermissionDropdown({
	value,
	onChange,
}: {
	value: string;
	onChange: (val: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button className="w-[153px] h-[40px] rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 text-left">
					{value}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[180px]">
				{["View", "Edit", "Create & Delete", "No Access"].map((option) => (
					<DropdownMenuItem
						key={option}
						onClick={() => {
							onChange(option);
						}}
					>
						{option}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
