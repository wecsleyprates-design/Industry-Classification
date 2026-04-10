import React, { useRef } from "react";
import useCustomToast from "@/hooks/useCustomToast";

type TooltipProps = {
	children: React.ReactNode;
	tooltip?: string;
};

const WorthInfoTooltip: React.FC<TooltipProps> = ({ children, tooltip }) => {
	const { successHandler, errorHandler } = useCustomToast();
	const childrenRef = useRef(null);

	return (
		<div className="relative inline-block group">
			<div ref={childrenRef}>{children}</div>
			{tooltip && (
				<div className="absolute z-50 w-64 mt-2 transition-all duration-500 transform scale-0 -translate-x-1/2 top-full left-1/2 group-hover:scale-100 md:w-80">
					<div
						className="flex flex-col items-center w-full shadow-lg"
						onClick={() => {
							navigator.clipboard
								.writeText(tooltip)
								.then(() => {
									successHandler({ message: "Text Copied!" });
								})
								.catch(() => {
									errorHandler({ message: "Copy failed" });
								});
						}}
					>
						<div className="w-4 h-2 bg-gray-400 clip-bottom" />
						<div className="z-50 w-full p-2 text-xs text-center text-white bg-gray-400 rounded">
							{tooltip}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default WorthInfoTooltip;
