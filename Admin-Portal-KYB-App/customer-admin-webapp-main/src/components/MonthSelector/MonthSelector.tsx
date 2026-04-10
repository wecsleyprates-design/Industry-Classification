import React, { useRef } from "react";
import { DateObject, type DatePickerRef } from "react-multi-date-picker";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

interface Props {
	buttons?: React.JSX.Element;
	date: DateObject;
	setDate?: React.Dispatch<React.SetStateAction<DateObject>>;
	viewDurationYear?: boolean;
}

const MonthSelector: React.FC<Props> = ({
	viewDurationYear,
	date,
	setDate,
}) => {
	const datePickerRef = useRef<DatePickerRef>(null);

	const update = (key: string, value: number) => {
		if (key === "year") {
			date.year = Number(date.year) + Number(value);
			setDate?.(new DateObject({ date }));
		} else if (key === "month") {
			date.month.index = Number(date.month.index) + Number(value);
			setDate?.(new DateObject({ date }));
		}
	};

	const style = {
		display: "inline-block",
		width: "60px",
		fontSize: "16px",
	};

	return (
		<div style={{ textAlign: "center" }}>
			<div className="flex flex-row space-x-0 mt-1">
				<button
					onClick={() => {
						update("year", -1);
					}}
					className=""
				>
					<ChevronLeftIcon color="black" className="h-3 w-3  text-[#B8B8B8] " />
				</button>
				<span
					style={style}
					className="text-gray-800 font-semibold"
					onClick={() => datePickerRef?.current?.openCalendar()}
				>
					Nov 23
				</span>
				<button
					onClick={() => {
						update("year", 1);
					}}
					className="text-black  "
				>
					<ChevronRightIcon
						color="black"
						className="h-3 w-3  text-[#B8B8B8] "
					/>
				</button>
			</div>
			{/* <div className="flex flex-row space-x-0">
				<button
					onClick={() => {
						update("month", -1);
					}}
					className="text-black  "
				>
					<ChevronLeftIcon color="black" className="h-3 w-3  " />
				</button>
				<span
					style={style}
					className="text-black"
					onClick={() => datePickerRef?.current?.openCalendar()}
				>
					{date?.month.name}
				</span>
				<button
					onClick={() => {
						update("month", 1);
					}}
					className="text-black  "
				>
					<ChevronRightIcon color="black" className="h-3 w-3  " />
				</button>
			</div> */}
			{/* <Calendar ref={datePickerRef} className=" absolute -translate-x-10" /> */}
		</div>
	);
};

export default MonthSelector;
