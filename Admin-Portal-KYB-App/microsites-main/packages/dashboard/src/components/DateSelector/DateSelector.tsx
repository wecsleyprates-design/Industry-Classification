import React, { useRef } from "react";
import DatePicker from "react-multi-date-picker";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { indexBasedOnMonth } from "@/lib/helper";

export interface Months {
	key:
		| "January"
		| "February"
		| "March"
		| "April"
		| "May"
		| "June"
		| "July"
		| "August"
		| "September"
		| "October"
		| "November"
		| "December";
}
type Props = {
	date: Date;
	type: "month" | "year";
	updateDate?: (date: Date) => void;
	format?: string;
	width?: string;
	ref?: any;
};
const DateSelector: React.FC<Props> = ({
	date,
	type,
	format,
	width,
	updateDate,
}) => {
	const ref = useRef<any>(null);

	return (
		<div className="flex">
			<DatePicker
				key={date?.getTime()}
				className="relative border-white custom-date-picker ring-1 ring-white border-1"
				style={{
					borderColor: "white",
					boxShadow: "none",
					textAlign: "end",
					width: width ?? "150px",
					cursor: "pointer",
				}}
				editable={false}
				onlyMonthPicker={type === "month"}
				onlyYearPicker={type === "year"}
				months={[
					"Jan",
					"Feb",
					"Mar",
					"Apr",
					"May",
					"Jun",
					"Jul",
					"Aug",
					"Sep",
					"Oct",
					"Nov",
					"Dec",
				]}
				format={type === "month" ? (format ?? "MM/YYYY") : "YYYY"}
				minDate={new Date("01/01/1920")}
				maxDate={new Date()}
				value={date}
				onChange={(value) => {
					if (type === "month") {
						const dateParts = value?.toString().split(format ? "," : "/") ?? [];
						const month = format
							? indexBasedOnMonth(dateParts[0].trim() as Months["key"])
							: parseInt(dateParts[0].trim(), 10);
						const year = parseInt(dateParts[1], 10);
						const dateObject = new Date(year, format ? month : month - 1);
						updateDate?.(dateObject);
					} else {
						updateDate?.(new Date(value?.toString() ?? ""));
					}
				}}
			/>
			<span
				className="cursor-pointer h-2 w-1 pl-1.5 pt-2.5"
				onClick={() => {
					ref.current.openCalendar();
				}}
			>
				<ChevronDownIcon />
			</span>
		</div>
	);
};

export default DateSelector;
