import React, { useMemo } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import type { DecisionValue } from "@/types/workflows";
import { DECISION_OPTIONS } from "./constants";

interface DecisionSelectProps {
	value: DecisionValue | "";
	onChange: (value: DecisionValue | "") => void;
	label?: string;
	hasError?: boolean;
	errorMessage?: string;
}

type SelectOption = { value: DecisionValue | ""; label: string };

const getSelectStyles = (hasError: boolean) => ({
	control: (provided: any, state: any) => ({
		...provided,
		height: 40,
		minHeight: 40,
		fontSize: "14px",
		fontWeight: 500,
		borderRadius: "8px",
		borderColor: hasError ? "#fca5a5" : state.isFocused ? "#2563eb" : "#e5e7eb",
		backgroundColor: hasError ? "#fef2f2" : provided.backgroundColor,
		boxShadow: hasError
			? "0 0 0 1px #fca5a5"
			: state.isFocused
				? "0 0 0 2px rgba(37, 99, 235, 0.2)"
				: "none",
		"&:hover": {
			borderColor: hasError ? "#f87171" : "#9ca3af",
		},
	}),
	menu: (provided: any) => ({
		...provided,
		zIndex: 50,
	}),
});

export const DecisionSelect: React.FC<DecisionSelectProps> = ({
	value,
	onChange,
	label = "Decision",
	hasError = false,
	errorMessage = "Decision is required",
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const options = useMemo<SelectOption[]>(
		() =>
			DECISION_OPTIONS.map((opt) => ({
				value: opt.value,
				label: opt.label,
			})),
		[],
	);

	const selectedOption = useMemo<SelectOption>(
		() =>
			options.find((opt) => opt.value === value) ?? { value: "", label: "" },
		[options, value],
	);

	const handleChange = (option: SelectOption | null) => {
		onChange(option?.value ?? "");
	};

	const selectStyles = useMemo(() => getSelectStyles(hasError), [hasError]);
	const showError = hasError && !value;

	return (
		<div className="flex flex-col xl:flex-row gap-2 xl:gap-6 py-4 xl:py-6 px-4 xl:px-6 border-t border-gray-200">
			<div className="text-xs font-medium text-gray-400 uppercase tracking-wide xl:pt-3 w-8 flex-shrink-0">
				{label}
			</div>
			<div className="flex-1 xl:flex-initial">
				<label className="block text-xs font-medium text-gray-500 mb-1.5">
					Decision
				</label>
				<div className="w-full xl:w-56">
					<SelectComponent
						value={selectedOption}
						defaultValue={{ value: "", label: "" }}
						options={options}
						onChange={handleChange}
						customStyles={selectStyles}
						isDisabled={isReadOnly}
					/>
				</div>
				{showError && (
					<div className="flex items-center gap-1.5 mt-1.5">
						<ExclamationCircleIcon className="h-4 w-4 text-red-500" />
						<span className="text-sm text-red-500">{errorMessage}</span>
					</div>
				)}
			</div>
		</div>
	);
};
