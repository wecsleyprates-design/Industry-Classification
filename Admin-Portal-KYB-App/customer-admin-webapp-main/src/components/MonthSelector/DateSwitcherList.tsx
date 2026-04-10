import React, { useRef } from "react";
import DatePicker from "react-multi-date-picker";
import { toast } from "react-toastify";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { convertToLocalDate } from "@/lib/helper";

const DateSwitcherList: React.FC<{
	type: "month" | "year";
	date: Date;
	hasNext: boolean;
	hasPrevious: boolean;
	updateDate: (type: "month" | "year", value: 1 | -1) => void;
	scoreIds?: Array<{
		date: Date;
		score_trigger_id: string;
	}>;
	updateScoreId?: (id?: string) => void;
}> = ({
	type,
	date,
	updateDate,
	hasNext = false,
	hasPrevious = false,
	scoreIds,
	updateScoreId,
}) => {
	const datePickerRef = useRef<any>(null);
	const update = (key: "month" | "year", value: 1 | -1) => {
		updateDate(key, value);
	};

	return (
		<div>
			<div className="flex items-center justify-center w-full gap-1 mx-auto align-middle">
				{hasPrevious && (
					<ChevronLeftIcon
						onClick={() => {
							update(type, -1);
						}}
						className="h-3 w-3 text-[#B8B8B8] cursor-pointer"
						aria-disabled
					/>
				)}
				<div
					className="cursor-pointer"
					onClick={() => datePickerRef.current.openCalendar()}
				>
					{convertToLocalDate(date, "MMM’YY")}
				</div>
				<div className="w-0">
					<DatePicker
						style={{
							width: "0px",
							border: "none",
						}}
						ref={datePickerRef}
						value={date ?? new Date()}
						editable={false}
						mapDays={({ date: mDate, selectedDate }) => {
							const props: any = {};
							const formattedDate = dayjs(mDate.toDate()).format("MM/DD/YYYY");
							const formattedSelectedDate = dayjs(
								selectedDate.toString(),
							).format("MM/DD/YYYY");

							if (
								scoreIds
									?.map((item) => dayjs(item.date).format("MM/DD/YYYY"))
									.includes(formattedDate)
							) {
								props.style = {
									...props.style,
									color: "#fff",
									backgroundColor: "#266EF1",
								};
							}

							if (formattedDate === formattedSelectedDate) {
								props.style = {
									...props.style,
									color: "#000",
									backgroundColor: "#fff",
									border: "2px solid #CCCCCC",
								};
							}
							return props;
						}}
						onChange={(date) => {
							if (date) {
								const tDate = dayjs(date.toString()).utc().toDate();
								const val = scoreIds?.find((item) => {
									return (
										convertToLocalDate(item.date, "MM/DD/YYYY") ===
										convertToLocalDate(tDate, "MM/DD/YYYY")
									);
								});
								if (val) {
									updateScoreId?.(val?.score_trigger_id ?? "");
								} else {
									toast.warn(`No Score was generated on this date.`);
								}
							}
						}}
					></DatePicker>
				</div>
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
