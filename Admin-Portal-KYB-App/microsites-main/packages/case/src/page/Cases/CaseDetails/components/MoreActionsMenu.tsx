import React, { useState } from "react";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";

import { Button } from "@/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Tooltip } from "@/ui/tooltip";

export interface MoreActionsMenuProps {
	menuItems: MenuItem[];
	badge?: React.ReactNode;
}

type MenuItem = {
	label: React.ReactNode;
	icon: React.ReactNode;
	onClick?: () => void | Promise<void>;
	isDisabled?: boolean;
	hidden?: boolean;
};

export function MoreActionsMenu({ menuItems, badge }: MoreActionsMenuProps) {
	const [open, setOpen] = useState(false);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
			<Tooltip
				content="More Actions"
				side="bottom"
				trigger={
					<DropdownMenuTrigger asChild>
						<div className="relative">
							<Button
								variant="outline"
								size="icon"
								className="relative"
							>
								<EllipsisHorizontalIcon className="size-4" />
							</Button>
							{badge && (
								<div className="absolute size-auto top-2 right-2 pointer-events-none">
									{badge}
								</div>
							)}
						</div>
					</DropdownMenuTrigger>
				}
			/>
			<DropdownMenuContent
				className="p-0"
				sideOffset={10}
				tabIndex={0}
				side="bottom"
				align="end"
			>
				<div className="p-2 space-y-2">
					{menuItems
						.filter((item) => !item.hidden)
						.map((item, index) => (
							<DropdownMenuItem
								key={index}
								onClick={item.onClick}
								className="flex items-center gap-2 hover:cursor-pointer"
								disabled={item.isDisabled}
							>
								{item.icon}
								{item.label}
							</DropdownMenuItem>
						))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
