import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { convertToLocalDate } from "@/lib/helper";

const DateSwitcher: React.FC<{
	type: "month" | "year";
	date: Date;
	setDate: React.Dispatch<React.SetStateAction<Date>>;
}> = ({ type, date, setDate }) => {
	const update = (key: "month" | "year", value: 1 | -1) => {
		let tDate: Date = date;
		tDate = dayjs(tDate).add(value, key).toDate();
		setDate(tDate);
	};

	return (
		<div>
			<div className="flex justify-center w-full align-middle items-center mx-auto gap-1">
				<ChevronLeftIcon
					onClick={() => {
						update(type, -1);
					}}
					className="h-3 w-3 text-[#B8B8B8] cursor-pointer"
				/>
				<div className="w-14">{convertToLocalDate(date, "MMM’YY")}</div>
				<ChevronRightIcon
					onClick={() => {
						update(type, 1);
					}}
					className="h-3 w-3 text-[#B8B8B8] cursor-pointer"
				/>
			</div>
		</div>
	);
};

export default DateSwitcher;
