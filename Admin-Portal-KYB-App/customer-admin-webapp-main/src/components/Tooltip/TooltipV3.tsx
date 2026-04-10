import { useEffect, useRef, useState } from "react";

type TooltipProps = {
	children: React.ReactNode;
	tooltip?: string;
};

const TooltipV3: React.FC<TooltipProps> = ({ children, tooltip }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [position, setPosition] = useState("top"); // Manage tooltip position
	const tooltipRef = useRef<any>(null);
	const triggerRef = useRef<any>(null);

	// Function to handle tooltip positioning logic
	const adjustTooltipPosition = () => {
		const tooltipRect = tooltipRef?.current?.getBoundingClientRect();
		const triggerRect = triggerRef?.current?.getBoundingClientRect();

		const spaceAbove = triggerRect.top;
		const spaceBelow = window.innerHeight - triggerRect.bottom;
		const spaceLeft = triggerRect.left;
		const spaceRight = window.innerWidth - triggerRect.right;

		// Adjust based on available space
		if (spaceBelow > tooltipRect.height) {
			setPosition("bottom");
		} else if (spaceAbove > tooltipRect.height) {
			setPosition("top");
		} else if (spaceRight > tooltipRect.width) {
			setPosition("right");
		} else if (spaceLeft > tooltipRect.width) {
			setPosition("left");
		}
	};

	useEffect(() => {
		if (isOpen) {
			adjustTooltipPosition();
		}
	}, [isOpen]);

	return (
		<div className="relative flex items-center justify-center">
			<button
				ref={triggerRef}
				onMouseEnter={() => {
					setIsOpen(true);
				}}
				onMouseLeave={() => {
					setIsOpen(false);
				}}
				className=""
			>
				{children}
			</button>

			{isOpen && (
				<div
					ref={tooltipRef}
					className={`absolute bg-[#03071299]  text-sm w-[150px] sm:w-[280px] text-white p-2 rounded-lg transition-opacity z-40 ${
						position === "top"
							? "bottom-full mb-2"
							: position === "bottom"
								? "top-full mt-2"
								: position === "left"
									? "right-full mr-2"
									: "left-full ml-2"
					}`}
				>
					{tooltip}
					<div
						className={`absolute  bg-transparent w-3 h-3 transform rotate-45 ${
							position === "top"
								? "bottom-[-5px] left-1/2 transform -translate-x-1/2"
								: position === "bottom"
									? "top-[-5px] left-1/2 transform -translate-x-1/2"
									: position === "left"
										? "right-[-5px] top-1/2 transform -translate-y-1/2"
										: "left-[-5px] top-1/2 transform -translate-y-1/2"
						}`}
					></div>
				</div>
			)}
		</div>
	);
};

export default TooltipV3;
