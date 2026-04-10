import * as React from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string;
	required?: boolean;
	maxLength?: number;
	showCharacterCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	(
		{
			className,
			error,
			label,
			id,
			required,
			maxLength,
			showCharacterCount,
			value,
			...props
		},
		ref,
	) => {
		const inputId = id;
		const fallBackId = React.useId();
		const hasError = error && error.trim() !== "";
		const currentLength = (value as string)?.length || 0;

		return (
			<div className="flex flex-col space-y-1">
				{label && (
					<div className="flex gap-1 items-center">
						<label
							htmlFor={inputId ?? fallBackId}
							className="text-sm font-normal"
						>
							{label}{" "}
							{required && (
								<span className="text-red-500">*</span>
							)}
						</label>
					</div>
				)}
				<div className="relative">
					<textarea
						className={cn(
							"flex w-full rounded-lg border border-input bg-transparent p-2 text-sm text-gray-800 shadow-none transition-colors placeholder:placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
							error &&
								"border-red-500 focus-visible:ring-red-500 pr-10",
							className,
						)}
						// this is to override host app styles
						style={{
							border: "1px solid #e5e7eb",
						}}
						ref={ref}
						maxLength={maxLength}
						value={value}
						{...props}
					/>
					{hasError && (
						<ExclamationCircleIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-500" />
					)}
				</div>
				{showCharacterCount && maxLength && (
					<div className="flex justify-start">
						<span
							className={cn(
								"text-xs",
								currentLength > maxLength
									? "text-red-500"
									: "text-gray-500",
							)}
						>
							{currentLength}/{maxLength} characters
						</span>
					</div>
				)}
				{hasError && (
					<p className="text-xs text-red-500 mt-1">{error}</p>
				)}
			</div>
		);
	},
);
Textarea.displayName = "Textarea";

export { Textarea };
