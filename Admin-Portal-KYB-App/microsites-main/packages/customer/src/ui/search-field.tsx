import * as React from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useDebouncedCallback } from "use-debounce";
import { cn } from "@/lib/utils";

import { Input, type InputProps } from "@/ui/input";

export interface SearchFieldProps extends Omit<InputProps, "type"> {
	onSearch?: (value: string) => void;
	value?: string;
}

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
	(
		{ className, onSearch, label, info, error, value, onChange, ...props },
		ref,
	) => {
		const debouncedSearch = useDebouncedCallback((value: string) => {
			onSearch?.(value);
		}, 500);

		const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
			// Handle controlled input state
			onChange?.(event);
			// Handle debounced search
			debouncedSearch(event.target.value);
		};

		return (
			<div className="relative">
				<MagnifyingGlassIcon
					className={cn(
						"absolute left-3 h-5 w-5 text-gray-400 pointer-events-none",
						{
							"top-[31px]": label,
							"top-1/2 -translate-y-1/2": !label && !error,
							"top-[9px]": !label && error,
						},
					)}
				/>
				<Input
					type="search"
					className={cn("pl-10", className)}
					onChange={handleChange}
					value={value}
					ref={ref}
					label={label}
					info={info}
					error={error}
					{...props}
				/>
			</div>
		);
	},
);

SearchField.displayName = "SearchField";

export { SearchField };
