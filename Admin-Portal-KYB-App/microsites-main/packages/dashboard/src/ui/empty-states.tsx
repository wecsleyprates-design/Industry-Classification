import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Ellipse from "../assets/svgs/ellipse";

export const EmptyResultsDisplay = ({
	filled = false,
	message = "No Data to Display",
}: {
	filled?: boolean;
	message?: string;
}) => {
	return (
		<div className="flex flex-col items-center gap-4 text-center">
			<div
				className={cn(
					"flex items-center justify-center rounded-lg w-12 h-12 md:w-14 md:h-14",
					filled ? "bg-blue-100" : "bg-blue-50",
				)}
			>
				<Search className="text-[#2563EB] w-5 h-5 md:w-6 md:h-6" />
			</div>
			<div className="text-center text-gray-800 font-semibold text-sm sm:text-sm md:text-base break-words whitespace-normal max-w-[140px] sm:max-w-[160px] md:max-w-[180px] lg:max-w-[200px]">
				{message}
			</div>
		</div>
	);
};

export const EmptyResultsCircle = () => {
	return (
		<div className="grid place-items-center aspect-square my-2 w-40 sm:w-48 md:w-64">
			<Ellipse className="[grid-area:1/1] w-full h-full" />
			<div className="[grid-area:1/1] flex items-center justify-center">
				<EmptyResultsDisplay />
			</div>
		</div>
	);
};

export const EmptyResultsCircleFilled = () => {
	return (
		<div className="relative flex items-center justify-center aspect-square bg-contain bg-no-repeat bg-gray-100 bg-center rounded-full w-40 sm:w-48 md:w-64">
			<EmptyResultsDisplay filled />
		</div>
	);
};
