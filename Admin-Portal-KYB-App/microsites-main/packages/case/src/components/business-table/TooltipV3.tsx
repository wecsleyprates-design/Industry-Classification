import { useCallback, useEffect, useRef, useState } from "react";

type TooltipProps = {
	children: React.ReactNode;
	tooltip?: string;
};

type TooltipPosition = "top" | "bottom" | "left" | "right";

const POSITION_CLASSES: Record<TooltipPosition, string> = {
	top: "bottom-full mb-2",
	bottom: "top-full mt-2",
	left: "right-full mr-2",
	right: "left-full ml-2",
};

const ARROW_POSITION_CLASSES: Record<TooltipPosition, string> = {
	top: "bottom-[-5px] left-1/2 -translate-x-1/2",
	bottom: "top-[-5px] left-1/2 -translate-x-1/2",
	left: "right-[-5px] top-1/2 -translate-y-1/2",
	right: "left-[-5px] top-1/2 -translate-y-1/2",
};

const TooltipV3: React.FC<TooltipProps> = ({ children, tooltip }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState<TooltipPosition>("top"); // Manage tooltip position
	const tooltipRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLDivElement>(null);

	// Function to handle tooltip positioning logic
	const adjustTooltipPosition = useCallback(() => {
		const tooltipRect = tooltipRef?.current?.getBoundingClientRect();
		const triggerRect = triggerRef?.current?.getBoundingClientRect();

		if (!tooltipRect || !triggerRect) return;

		const spaceAbove = triggerRect.top;
		const spaceBelow = window.innerHeight - triggerRect.bottom;
		const spaceLeft = triggerRect.left;
		const spaceRight = window.innerWidth - triggerRect.right;

		// Adjust based on available space, with fallback to position with most space
		if (spaceBelow > tooltipRect.height) {
			setPosition("bottom");
		} else if (spaceAbove > tooltipRect.height) {
			setPosition("top");
		} else if (spaceRight > tooltipRect.width) {
			setPosition("right");
		} else if (spaceLeft > tooltipRect.width) {
			setPosition("left");
		} else {
			// Fallback: choose the direction with the most available space
			const maxSpace = Math.max(
				spaceAbove,
				spaceBelow,
				spaceLeft,
				spaceRight,
			);
			if (maxSpace === spaceBelow) {
				setPosition("bottom");
			} else if (maxSpace === spaceAbove) {
				setPosition("top");
			} else if (maxSpace === spaceRight) {
				setPosition("right");
			} else {
				setPosition("left");
			}
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			adjustTooltipPosition();
		}
	}, [isOpen, adjustTooltipPosition]);

	return (
		<div className="relative flex items-center justify-center">
			<div
				ref={triggerRef}
				onMouseEnter={() => {
					setIsOpen(true);
				}}
				onMouseLeave={() => {
					setIsOpen(false);
				}}
			>
				{children}
			</div>

			{isOpen && (
				<div
					ref={tooltipRef}
					className={`absolute bg-[#03071299] text-sm w-[150px] sm:w-[280px] text-white p-2 rounded-lg transition-opacity z-40 ${POSITION_CLASSES[position]}`}
				>
					{tooltip}
					<div
						className={`absolute bg-transparent w-3 h-3 rotate-45 ${ARROW_POSITION_CLASSES[position]}`}
					></div>
				</div>
			)}
		</div>
	);
};

export default TooltipV3;
