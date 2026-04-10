import React from "react";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	text: string;
	color?: "red" | "yellow" | "green";
	icon?: React.ReactElement;
	className?: string;
	isRemoveable?: boolean;
	key?: any;
	onRemove?: () => void;
}

const defaultClasses = `
inline-flex items-center gap-x-0.5 mr-2 rounded-md px-2 py-1 text-xs font-medium 
  `;

const Badge: React.FC<BadgeProps> = ({
	text,
	icon,
	className,
	isRemoveable,
	onRemove = () => {},
	color,
	...props
}) => {
	const handleClick = () => {
		onRemove();
	};

	function getClasses(color?: "red" | "yellow" | "green") {
		let classes = ``;
		switch (color) {
			case "red":
				classes = classes + "bg-red-100 text-red-700 font-medium";
				break;
			case "yellow":
				classes = classes + "bg-yellow-100 text-yellow-700 font-medium";
				break;
			case "green":
				classes = classes + "bg-green-100 text-green-700 font-medium";
				break;
			default:
				classes = classes + "bg-[#DCFCE7] text-[#15803D] font-medium";
		}
		return classes;
	}

	return (
		<>
			<span
				className={twMerge(
					defaultClasses,
					getClasses(color),
					className,
				)}
				{...props}
			>
				{icon && icon} {text}
				{isRemoveable ? (
					<>
						<button
							onClick={handleClick}
							type="button"
							className="group relative -mr-1 h-3.5 w-3.5 rounded-sm hover:bg-blue-600/20"
						>
							<span className="sr-only">Remove</span>
							<svg
								viewBox="0 0 14 14"
								className="h-3.5 w-3.5 stroke-blue-800/50 group-hover:stroke-blue-800/75"
							>
								<path d="M4 4l6 6m0-6l-6 6" />
							</svg>
							<span className="absolute -inset-1" />
						</button>
					</>
				) : (
					<></>
				)}
			</span>
		</>
	);
};

export default Badge;
