import React, { useRef, useState } from "react";
import DatePicker from "react-multi-date-picker";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { indexBasedOnMonth } from "@/lib/utils";

type Props = {
	date?: Date;
	updateDate?: (date: Date) => void;
	type: "month" | "year";
	format?: string;
	width?: string;
	ref?: any;
	disableDefaultData?: () => void;
};

type Months =
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

export const DateSelector: React.FC<Props> = ({
	date,
	type,
	format,
	width,
	disableDefaultData,
	updateDate,
}) => {
	const ref = useRef<any>(null);
	const [isOpen, setIsOpen] = useState(false);

	const handleClick = () => {
		if (!isOpen) {
			ref.current.openCalendar();
			setIsOpen(true);
		} else {
			ref.current.closeCalendar();
			setIsOpen(false);
		}
	};

	return (
		<div className="flex dashboard border-2 border-[#E5E7EB] rounded-lg">
			<DatePicker
				ref={ref}
				onOpen={() => {
					setIsOpen(true);
				}}
				onClose={() => {
					setIsOpen(false);
				}}
				key={date?.getTime()}
				className="relative shadow-xl custom-date-picker ring-white dashboard"
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
				maxDate={
					type === "year"
						? dayjs(new Date()).add(1, "month").toDate()
						: new Date()
				}
				value={date}
				onChange={(value) => {
					if (type === "month") {
						const dateParts = value?.toString().split(format ? "," : "/") ?? [];
						const month = format
							? indexBasedOnMonth(dateParts[0].trim() as Months)
							: parseInt(dateParts[0].trim(), 10);
						const year = parseInt(dateParts[1], 10);
						const dateObject = new Date(year, format ? month : month - 1);
						updateDate?.(dateObject);
						disableDefaultData?.();
					} else {
						updateDate?.(new Date(value?.toString() ?? ""));
						disableDefaultData?.();
					}
				}}
				render={
					<div
						className="flex items-center justify-between px-2 py-1 cursor-pointer gap-x-2"
						onClick={() => {
							handleClick();
						}}
					>
						{date?.getFullYear()}
						<ChevronDownIcon className="#9CA3AF h-5 w-3" />
					</div>
				}
			/>
		</div>
	);
};
