import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-2", className)}
			classNames={{
				today: `text-red-500 font-semibold`,
				root: `${defaultClassNames.root} p-1 w-full`,
				chevron: `${defaultClassNames.chevron} fill-gray-800`,
				month_caption: `${defaultClassNames.chevron} text-sm font-semibold py-2 px-2`,
				month: "w-full",
				month_grid: "w-full border-collapse",
				weekdays: "w-full",
				weekday: "text-xs font-medium w-8 h-8",
				week: "w-full",
				day: "w-8 h-8 text-center text-sm p-0",
				day_button: `${defaultClassNames.day_button} w-8 h-8 text-sm`,
				selected: `bg-gray-100 text-gray-800 hover:bg-gray-800 hover:text-white focus:bg-gray-700`,
				range_start:
					"bg-gray-700 rounded-l-md text-white hover:bg-gray-700 focus:bg-gray-700",
				range_end:
					"bg-gray-700 rounded-r-md text-white hover:bg-gray-700 focus:bg-gray-700",
				range_middle: "bg-gray-100",
				...classNames,
			}}
			{...props}
		/>
	);
}
Calendar.displayName = "Calendar";

export { Calendar };
