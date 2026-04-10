import React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
	src?: string;
	alt?: string;
	initials?: string;
	size?: "sm" | "md" | "lg";
	backgroundColor?: string;
	textColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
	src,
	alt,
	initials,
	size = "md",
	backgroundColor = "bg-blue-100",
	textColor = "text-blue-700",
	className,
	...props
}) => {
	const sizeClasses = {
		sm: "w-8 h-8 text-xs",
		md: "w-10 h-10 text-sm",
		lg: "w-12 h-12 text-base",
	};

	const baseClasses = cn(
		"relative inline-flex items-center justify-center rounded-full overflow-hidden",
		backgroundColor,
		sizeClasses[size],
		className,
	);

	const fallbackClasses = cn(
		"w-full h-full flex items-center justify-center font-semibold uppercase",
		backgroundColor,
		textColor,
	);

	if (src) {
		return (
			<AvatarPrimitive.Root className={baseClasses} {...props}>
				<AvatarPrimitive.Image
					src={src}
					alt={alt ?? "Avatar"}
					className="w-full h-full object-cover"
				/>
				<AvatarPrimitive.Fallback className={fallbackClasses}>
					{initials ?? alt?.charAt(0) ?? ""}
				</AvatarPrimitive.Fallback>
			</AvatarPrimitive.Root>
		);
	}

	return (
		<div className={baseClasses} {...props}>
			<div className={fallbackClasses}>{initials ?? alt?.charAt(0) ?? ""}</div>
		</div>
	);
};
