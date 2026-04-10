import React, { useRef } from "react";
import useCustomToast from "@/hooks/useCustomToast";

type TooltipProps = {
	children: React.ReactNode;
	tooltip?: string;
	isLeft?: boolean;
};

const Tooltip: React.FC<TooltipProps> = ({ children, tooltip, isLeft }) => {
	const { successHandler, errorHandler } = useCustomToast();
	const childrenRef = useRef(null);

	return (
		<div className="relative inline-block group">
			<div ref={childrenRef}>{children}</div>
			{tooltip && (
				<>
					<div
						className={`z-50 cursor-pointer  absolute top-5 ml-auto mr-auto min-w-max scale-0 transform rounded-lg px-3 py-2 text-xs font-medium transition-all duration-500 group-hover:scale-100 ${
							isLeft ? "-translate-x-20" : ""
						}`}
					>
						<div
							className="flex flex-col items-center max-w-xs shadow-lg"
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
							<div className="w-4 h-2 bg-[#03071299]  clip-bottom " />

							<div className="z-50 p-2 text-xs text-center text-white bg-[#03071299] g-[#9ca3af] rounded">
								{tooltip}
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

export default Tooltip;
