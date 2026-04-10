import React, { useCallback, useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type { AttributeDataType, ConditionValue } from "@/types/workflows";
import { validateNumber, validateWithRegex } from "./shared";

interface MultiValueInputProps {
	value: ConditionValue;
	onChange: (value: ConditionValue) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	validationRegex?: string | null;
	dataType?: AttributeDataType | null;
	hasError?: boolean;
}

const getInitialTags = (value: ConditionValue): Array<string | number> => {
	if (!Array.isArray(value)) return [];
	return value.filter((v) => v !== null && v !== undefined && v !== "");
};

export const MultiValueInput: React.FC<MultiValueInputProps> = ({
	value,
	onChange,
	placeholder,
	disabled,
	className,
	validationRegex,
	dataType,
	hasError: hasRequiredError = false,
}) => {
	const isNumber = dataType === "number";
	const inputRef = useRef<HTMLInputElement>(null);

	const [localTags, setLocalTags] = useState<Array<string | number>>(() =>
		getInitialTags(value),
	);
	const [inputValue, setInputValue] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLocalTags(getInitialTags(value));
	}, [value]);

	const syncToParent = useCallback(
		(tags: Array<string | number>) => {
			onChange(tags.length > 0 ? tags : null);
		},
		[onChange],
	);

	const addTagAndSync = useCallback(
		(shouldSync: boolean): void => {
			const trimmedValue = inputValue.trim();
			if (!trimmedValue) return;

			if (isNumber && !validateNumber(trimmedValue)) {
				setError("Must be a number");
				return;
			}

			if (!validateWithRegex(trimmedValue, validationRegex)) {
				setError("Invalid format");
				return;
			}

			const newValue = isNumber ? Number(trimmedValue) : trimmedValue;

			if (localTags.includes(newValue)) {
				setInputValue("");
				setError(null);
				return;
			}

			const newTags = [...localTags, newValue];
			setLocalTags(newTags);
			setInputValue("");
			setError(null);

			if (shouldSync) {
				syncToParent(newTags);
			}
		},
		[inputValue, localTags, validationRegex, isNumber, syncToParent],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key !== "Enter" && e.key !== ",") return;
			e.preventDefault();
			addTagAndSync(e.key === "Enter");
		},
		[addTagAndSync],
	);

	const handleBlur = useCallback(() => {
		const trimmedValue = inputValue.trim();
		if (trimmedValue) {
			if (isNumber && !validateNumber(trimmedValue)) {
				setError("Must be a number");
				syncToParent(localTags);
				return;
			}
			if (!validateWithRegex(trimmedValue, validationRegex)) {
				setError("Invalid format");
				syncToParent(localTags);
				return;
			}
			const newValue = isNumber ? Number(trimmedValue) : trimmedValue;
			if (!localTags.includes(newValue)) {
				const newTags = [...localTags, newValue];
				setLocalTags(newTags);
				syncToParent(newTags);
			} else {
				syncToParent(localTags);
			}
			setInputValue("");
			setError(null);
		} else {
			syncToParent(localTags);
		}
	}, [inputValue, localTags, isNumber, validationRegex, syncToParent]);

	const handleContainerClick = useCallback(() => {
		inputRef.current?.focus();
	}, []);

	const handleRemoveTag = useCallback(
		(indexToRemove: number) => {
			const newTags = localTags.filter((_, index) => index !== indexToRemove);
			setLocalTags(newTags);
			syncToParent(newTags);
		},
		[localTags, syncToParent],
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			if (isNumber && newValue !== "" && !validateNumber(newValue)) {
				return;
			}
			setInputValue(newValue);
			if (error) setError(null);
		},
		[error, isNumber],
	);

	const isEmpty = localTags.length === 0;
	const hasValidationError = error !== null;
	const showRequiredError = hasRequiredError && isEmpty;
	const hasError = hasValidationError || showRequiredError;

	return (
		<div className="flex flex-col">
			<div
				onClick={handleContainerClick}
				className={cn(
					"flex flex-wrap items-center gap-1.5 min-h-9 w-full rounded-md border border-input bg-transparent px-2 py-1.5 transition-colors focus-within:ring-2 focus-within:ring-blue-600 cursor-text",
					disabled && "cursor-not-allowed opacity-50",
					hasError && "border-red-300 focus-within:ring-red-500",
					showRequiredError && "bg-red-50",
					className,
				)}
			>
				{localTags.map((tag, index) => (
					<span
						key={`${tag}-${index}`}
						className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-sm text-blue-800"
					>
						{String(tag)}
						{!disabled && (
							<button
								type="button"
								onMouseDown={(e) => {
									e.preventDefault();
								}}
								onClick={() => {
									handleRemoveTag(index);
								}}
								className="hover:text-blue-600 focus:outline-none"
							>
								<XMarkIcon className="h-3.5 w-3.5" />
							</button>
						)}
					</span>
				))}
				<input
					ref={inputRef}
					type="text"
					inputMode={isNumber ? "decimal" : undefined}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
					placeholder={localTags.length === 0 ? placeholder : ""}
					disabled={disabled}
					className="flex-1 min-w-[80px] border-0 bg-transparent p-0 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0"
				/>
			</div>
			{hasValidationError && (
				<span className="text-xs text-red-500 mt-1">{error}</span>
			)}
		</div>
	);
};
