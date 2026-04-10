import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { CheckIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "../types";
import { UpdateBadge } from "./UpdateBadge";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import type { FieldSource } from "@/page/Cases/CaseDetails/components/fieldSource.types";

export interface MultiSelectOption {
	label: string;
	value: string;
}

export interface MultiSelectDropdownFieldProps {
	options: MultiSelectOption[];
	selectedValues: string[];
	onChange: (selectedValues: string[]) => void;
	onEditComplete?: (originalValue: string[], newValue: string[]) => void;
	originalValue: string[];
	editingEnabled: boolean;
	disabled?: boolean;
	fieldSource?: FieldSource;
	saveStatus?: SaveStatus;
	placeholder?: string;
	ariaLabel?: string;
}

export const MultiSelectDropdownField: React.FC<
	MultiSelectDropdownFieldProps
> = ({
	options,
	selectedValues,
	onChange,
	onEditComplete,
	originalValue,
	editingEnabled,
	disabled = false,
	fieldSource,
	saveStatus,
	placeholder = "Select options...",
	ariaLabel = "Select options",
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const selectedValuesRef = useRef(selectedValues);
	const originalValueRef = useRef(originalValue);
	const onEditCompleteRef = useRef(onEditComplete);
	selectedValuesRef.current = selectedValues;
	originalValueRef.current = originalValue;
	onEditCompleteRef.current = onEditComplete;

	const selectedLabels = useMemo(() => {
		const valueToLabel = new Map(options.map((o) => [o.value, o.label]));
		return selectedValues.map((v) => valueToLabel.get(v) ?? v);
	}, [options, selectedValues]);

	const displayValue =
		selectedLabels.length > 0
			? selectedLabels.join(", ")
			: VALUE_NOT_AVAILABLE;

	const hasChanged = useCallback(
		(a: string[], b: string[]): boolean =>
			JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort()),
		[],
	);

	const handleToggle = useCallback(
		(value: string) => {
			const next = selectedValues.includes(value)
				? selectedValues.filter((v) => v !== value)
				: [...selectedValues, value];
			onChange(next);
		},
		[selectedValues, onChange],
	);

	const handleBlur = useCallback(
		(e: React.FocusEvent) => {
			const relatedTarget = e.relatedTarget as Node | null;
			if (
				relatedTarget &&
				containerRef.current?.contains(relatedTarget)
			) {
				return;
			}
			setTimeout(() => {
				if (!containerRef.current?.contains(document.activeElement)) {
					setIsOpen(false);
					const cb = onEditCompleteRef.current;
					if (
						cb &&
						hasChanged(
							originalValueRef.current,
							selectedValuesRef.current,
						)
					) {
						cb(originalValueRef.current, selectedValuesRef.current);
					}
				}
			}, 100);
		},
		[hasChanged],
	);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
				const cb = onEditCompleteRef.current;
				if (
					cb &&
					hasChanged(
						originalValueRef.current,
						selectedValuesRef.current,
					)
				) {
					cb(originalValueRef.current, selectedValuesRef.current);
				}
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => {
				document.removeEventListener("mousedown", handleClickOutside);
			};
		}
	}, [isOpen, hasChanged]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				onChange(originalValue);
				setIsOpen(false);
			} else if (e.key === "Enter" && !isOpen) {
				e.preventDefault();
				setIsOpen(true);
			}
		},
		[isOpen, onChange, originalValue],
	);

	return (
		<div ref={containerRef} className="relative w-fit">
			{/* Display Mode */}
			<div
				className={cn(
					"group flex items-center gap-1",
					!isOpen &&
						editingEnabled &&
						!disabled &&
						"cursor-pointer hover:bg-gray-50 rounded-md px-1 -mx-1",
					isOpen && "invisible",
				)}
				onClick={(e) => {
					if (!isOpen && editingEnabled && !disabled) {
						e.stopPropagation();
						setIsOpen(true);
					}
				}}
				onKeyDown={(e) => {
					if (!isOpen && (e.key === "Enter" || e.key === " ")) {
						e.preventDefault();
						setIsOpen(true);
					}
				}}
				tabIndex={!isOpen && editingEnabled && !disabled ? 0 : -1}
				role={
					!isOpen && editingEnabled && !disabled
						? "button"
						: undefined
				}
			>
				<span className="text-sm font-normal text-gray-800">
					{displayValue}
				</span>
				{editingEnabled && !disabled && !isOpen && (
					<PencilSquareIcon
						className="h-3.5 w-3.5 text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
						aria-hidden="true"
					/>
				)}
				{saveStatus && (
					<UpdateBadge saveStatus={saveStatus} showUpdatedBadge />
				)}
			</div>

			{/* Edit Mode */}
			{isOpen && (
				<div className="absolute left-0 top-0 z-10 min-w-[200px]">
					<button
						ref={buttonRef}
						type="button"
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						className={cn(
							"px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-300",
							"w-full text-left justify-between flex items-center",
							disabled && "opacity-50 cursor-not-allowed",
						)}
						aria-label={ariaLabel}
						aria-expanded={isOpen}
						aria-haspopup="listbox"
					>
						<span className="truncate">
							{selectedValues.length > 0
								? `${selectedValues.length} selected`
								: placeholder}
						</span>
						<svg
							className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					<div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto z-20">
						<div className="p-2 space-y-1">
							{options.map((option) => {
								const isSelected = selectedValues.includes(
									option.value,
								);
								return (
									<label
										key={option.value}
										className={cn(
											"flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100",
											isSelected && "bg-blue-50",
										)}
									>
										<input
											type="checkbox"
											checked={isSelected}
											onChange={() =>
												handleToggle(option.value)
											}
											className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
										/>
										<span className="text-sm text-gray-900">
											{option.label}
										</span>
										{isSelected && (
											<CheckIcon className="h-4 w-4 text-blue-600 ml-auto" />
										)}
									</label>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
