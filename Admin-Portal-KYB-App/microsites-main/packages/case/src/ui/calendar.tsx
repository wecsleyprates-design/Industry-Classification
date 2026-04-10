import * as React from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
	className,
	showOutsideDays = true,
	...props
}: CalendarProps) {
	const defaultClassNames = getDefaultClassNames();

	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("p-3", className)}
			classNames={{
				today: `text-red-500 font-semibold`, // Add a border to today's date
				root: `${defaultClassNames.root} p-1`, // Add a shadow to the root element
				chevron: `${defaultClassNames.chevron} fill-gray-800`, // Change the color of the chevron
				month_caption: `${defaultClassNames.chevron} text-sm font-semibold py-4 px-3`,
				day_button: `${defaultClassNames.day_button}`,
				selected: `bg-[#2563EB] text-black hover:bg-[#1E40AF] focus:bg-[#1E40AF]`,
				range_start: `bg-[#2563EB] rounded-l-md text-white hover:bg-[#1E40AF] focus:bg-[#1E40AF]`,
				range_end: `bg-[#2563EB] rounded-r-md text-white hover:bg-[#1E40AF] focus:bg-[#1E40AF]`,
				range_middle: `bg-[#EFF6FF] text-black`,
			}}
			{...props}
		/>
	);
}
Calendar.displayName = "Calendar";

export { Calendar };
