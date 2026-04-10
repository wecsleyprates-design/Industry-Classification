import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { convertToLocalDate } from "@/lib/helper";

const DateSwitcherList: React.FC<{
	type: "month" | "year";
	date: Date;
	hasNext: boolean;
	hasPrevious: boolean;
	updateDate: (type: "month" | "year", value: 1 | -1) => void;
}> = ({ type, date, updateDate, hasNext = false, hasPrevious = false }) => {
	const update = (key: "month" | "year", value: 1 | -1) => {
		updateDate(key, value);
	};

	return (
		<div>
			<div className="flex justify-center w-full align-middle items-center mx-auto gap-1">
				{hasPrevious && (
					<ChevronLeftIcon
						onClick={() => {
							update(type, -1);
						}}
						className="h-3 w-3 text-[#B8B8B8] cursor-pointer"
						aria-disabled
					/>
				)}
				<div className="w-14">{convertToLocalDate(date, "MMM’YY")}</div>
				{hasNext && (
					<ChevronRightIcon
						onClick={() => {
							update(type, 1);
						}}
						className="h-3 w-3 text-[#B8B8B8] cursor-pointer"
					/>
				)}
			</div>
		</div>
	);
};

export default DateSwitcherList;
