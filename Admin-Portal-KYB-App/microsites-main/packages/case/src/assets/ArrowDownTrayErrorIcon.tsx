import React from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

const ArrowDownTrayErrorIcon = () => {
	return (
		<div className="flex">
			<ArrowDownTrayIcon className="text-[#B91C1C] h-5 w-5 cursor-pointer" />
			<div className="bg-[#B91C1C] h-[6px] w-[6px] rounded-full -translate-x-1"></div>
		</div>
	);
};

export default ArrowDownTrayErrorIcon;
