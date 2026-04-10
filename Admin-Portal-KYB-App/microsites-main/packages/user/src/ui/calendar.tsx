import { type ComponentProps } from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

export type CalendarProps = ComponentProps<typeof DayPicker>;

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
			className={cn("p-3", className)}
			classNames={{
				today: `text-red-500 font-semibold`, // Add a border to today's date
				root: `${defaultClassNames.root} p-1`, // Add a shadow to the root element
				chevron: `${defaultClassNames.chevron} fill-gray-800`, // Change the color of the chevron
				month_caption: `${defaultClassNames.chevron} text-sm font-semibold py-4 px-3`,
				day_button: `${defaultClassNames.day_button}`,
				selected: `bg-gray-100 text-gray-800 hover:bg-gray-800 hover:text-white focus:bg-gray-700`,
				range_start:
					"bg-gray-700 rounded-l-md text-white hover:bg-gray-700 focus:bg-gray-700",
				range_end:
					"bg-gray-700 rounded-r-md text-white hover:bg-gray-700 focus:bg-gray-700",
				range_middle: "bg-gray-100",
			}}
			{...props}
		/>
	);
}
Calendar.displayName = "Calendar";

export { Calendar };
