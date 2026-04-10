import * as React from "react";
import {
	ExclamationCircleIcon,
	EyeIcon,
	EyeSlashIcon,
	InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	info?: string;
	error?: string;
	required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, label, id, info, error, required, ...props }, ref) => {
		const inputId = id;
		const fallBackId = React.useId();
		const hasInfo = info && info.trim() !== "";
		const hasError = error && error.trim() !== "";
		const [showPassword, setShowPassword] = React.useState(false);

		const togglePasswordVisibility = () => {
			setShowPassword(!showPassword);
		};

		return (
			<div className="flex flex-col space-y-1">
				{label && (
					<div className="flex gap-1 items-center">
						<label
							htmlFor={inputId ?? fallBackId}
							className="text-sm font-normal"
						>
							{label} {required && <span className="text-red-500">*</span>}
						</label>
						{hasInfo && (
							<Popover>
								<PopoverTrigger>
									<InformationCircleIcon className="size-4" />
								</PopoverTrigger>
								<PopoverContent side="top">
									<p className="text-sm leading-normal m-0 p-0">{info}</p>
								</PopoverContent>
							</Popover>
						)}
					</div>
				)}
				<div className="relative">
					<input
						type={type === "password" && showPassword ? "text" : type}
						id={inputId ?? fallBackId}
						className={cn(
							"flex h-9 w-full rounded-md border border-input bg-transparent p-2 text-sm text-gray-800 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
							error && "border-red-500 focus-visible:ring-red-500 pr-10",
							type === "password" && "pr-10",
							className,
						)}
						ref={ref}
						{...props}
					/>
					{type === "password" && (
						<button
							type="button"
							onClick={togglePasswordVisibility}
							className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
						>
							{showPassword ? (
								<EyeSlashIcon className="h-5 w-5" />
							) : (
								<EyeIcon className="h-5 w-5" />
							)}
						</button>
					)}
					{hasError && (
						<ExclamationCircleIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-red-500" />
					)}
				</div>
				{hasError && <p className="text-xs text-red-500 mt-1">{error}</p>}
			</div>
		);
	},
);
Input.displayName = "Input";

export { Input };
