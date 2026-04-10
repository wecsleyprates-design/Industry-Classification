import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

import { Tooltip } from "@/ui/tooltip";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "bg-blue-600 text-primary-foreground hover:bg-blue-700",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border border-input bg-background hover:bg-accent hover:text-accent-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 rounded-md px-3 text-xs",
				lg: "h-10 rounded-md px-8",
				icon: "size-11 [&_svg]:size-5 [&_svg]:shrink-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export interface ButtonProps
	extends
		React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	},
);
Button.displayName = "Button";

interface SegmentedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	icon: React.ReactNode;
	label: React.ReactNode;
	onClick?: () => void;
	tooltip?: string;
}

const SegmentedButton = React.forwardRef<
	HTMLButtonElement,
	SegmentedButtonProps
>(({ className, icon, label, onClick, tooltip, ...props }, ref) => {
	const iconButton = (
		<button
			ref={ref}
			onClick={onClick}
			className="flex items-center justify-center size-11 border-l border-l-input bg-transparent text-gray-800 hover:bg-accent hover:text-accent-foreground [&_svg]:size-5 [&_svg]:shrink-0"
			{...props}
		>
			{icon}
		</button>
	);

	return (
		<div className="inline-flex rounded-md overflow-hidden border border-input h-11 p-0">
			<div className="flex items-center bg-background text-sm mx-4 my-2">
				{label}
			</div>
			{tooltip ? (
				<Tooltip
					trigger={iconButton}
					content={tooltip}
					side="bottom"
					align="center"
				/>
			) : (
				iconButton
			)}
		</div>
	);
});

SegmentedButton.displayName = "SegmentedButton";

export { Button, buttonVariants, SegmentedButton };
