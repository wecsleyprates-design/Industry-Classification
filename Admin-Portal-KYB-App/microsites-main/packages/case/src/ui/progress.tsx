import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
	value: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
	({ className, value, ...props }, ref) => {
		// Clamp value between 0 and 100
		const clampedValue = Math.max(0, Math.min(100, value));

		return (
			<div
				ref={ref}
				role="progressbar"
				aria-valuenow={clampedValue}
				className={cn(
					"relative h-2 w-full overflow-hidden rounded-full bg-gray-200",
					className,
				)}
				{...props}
			>
				<div
					className="h-full bg-blue-700 transition-all duration-300 ease-in-out"
					style={{ width: `${clampedValue}%` }}
				/>
			</div>
		);
	},
);
Progress.displayName = "Progress";

export { Progress };
