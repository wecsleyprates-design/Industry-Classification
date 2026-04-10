import React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

import COUNTRIES from "@/constants/countries";
import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface Props {
	value?: string;
	onSelect: (code: string) => void;
	disabled?: boolean;
}

const CountrySelectorDropdown: React.FC<Props> = ({
	value,
	onSelect,
	disabled,
}) => {
	const [open, setOpen] = React.useState(false);
	// Converts ISO country code to flag emoji using Unicode Regional Indicator symbols
	const codeToFlag = (code: string) => {
		if (!code) return "";
		const base = 127397; // 0x1F1E6 - 'A'
		return code
			.toUpperCase()
			.replace(/[^A-Z]/g, "")
			.split("")
			.map((c) => String.fromCodePoint(c.charCodeAt(0) + base))
			.join("");
	};
	const options = [
		{
			code: COUNTRIES.USA,
			label: "United States",
			flag: codeToFlag(COUNTRIES.USA),
		},
		{
			code: COUNTRIES.CANADA,
			label: "Canada",
			flag: codeToFlag(COUNTRIES.CANADA),
		},
		{
			code: COUNTRIES.UK,
			label: "United Kingdom",
			flag: codeToFlag(COUNTRIES.UK),
		},
	];
	const selectedOption = options.find((o) => o.code === value);
	const selected = selectedOption?.label ?? "Select Country";

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild disabled={disabled}>
				<div className="flex flex-row items-center justify-between gap-2 border border-gray-200 rounded-lg px-2 h-11 text-sm">
					<div className="flex items-center gap-2 text-gray-800">
						{selectedOption?.flag && (
							<span className="text-base leading-none">
								{selectedOption.flag}
							</span>
						)}
						<span>{selected}</span>
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="text-gray-800 hover:bg-transparent p-0 -mr-1"
						type="button"
						tabIndex={-1}
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
				sideOffset={8}
				side="bottom"
				align="start"
			>
				<div className="space-y-1">
					{options.map((opt) => (
						<DropdownMenuItem
							key={opt.code}
							onClick={() => {
								onSelect(opt.code);
							}}
							className="flex w-full items-center gap-2 hover:cursor-pointer p-2"
						>
							<span className="text-base leading-none">
								{opt.flag}
							</span>
							<span>{opt.label}</span>
						</DropdownMenuItem>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default CountrySelectorDropdown;
