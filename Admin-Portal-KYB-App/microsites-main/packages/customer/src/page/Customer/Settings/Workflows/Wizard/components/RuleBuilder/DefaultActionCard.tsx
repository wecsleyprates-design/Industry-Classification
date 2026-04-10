import React, { useMemo } from "react";
import { FlagIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import type { DecisionValue } from "@/types/workflows";
import { DECISION_OPTIONS } from "./constants";

interface DefaultActionCardProps {
	value: DecisionValue | "";
	onChange: (value: DecisionValue | "") => void;
	onRemove: () => void;
	isVisible: boolean;
	onAdd: () => void;
}

type SelectOption = { value: DecisionValue | ""; label: string };

const selectStyles = {
	control: (provided: any, state: any) => ({
		...provided,
		height: 40,
		minHeight: 40,
		fontSize: "14px",
		fontWeight: 500,
		borderRadius: "8px",
		borderColor: state.isFocused ? "#2563eb" : "#e5e7eb",
		boxShadow: state.isFocused ? "0 0 0 2px rgba(37, 99, 235, 0.2)" : "none",
		"&:hover": {
			borderColor: "#9ca3af",
		},
	}),
	menu: (provided: any) => ({
		...provided,
		zIndex: 50,
	}),
};

export const DefaultActionCard: React.FC<DefaultActionCardProps> = ({
	value,
	onChange,
	onRemove,
	isVisible,
	onAdd,
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

	if (!isVisible) {
		if (isReadOnly) {
			return null;
		}
		return (
			<button
				type="button"
				onClick={onAdd}
				className="w-full flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
			>
				<PlusIcon className="h-5 w-5" />
				<span className="font-medium">Add Default Action</span>
			</button>
		);
	}

	return (
		<div className="bg-white rounded-lg border border-gray-200">
			<div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-t-lg">
				<div className="flex items-center gap-3">
					<div className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50">
						<FlagIcon className="h-5 w-5 text-blue-600" />
					</div>
					<div>
						<h3 className="text-sm font-semibold text-gray-900">
							Default Action
						</h3>
						<p className="text-xs text-gray-500 hidden sm:block">
							When no workflow matches, what decision to take
						</p>
					</div>
				</div>

				{!isReadOnly && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onRemove}
							className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
							title="Remove default action"
						>
							<TrashIcon className="h-4 w-4" />
						</button>
					</div>
				)}
			</div>

			<div className="flex flex-col xl:flex-row gap-2 xl:gap-6 py-4 xl:py-6 px-4 xl:px-6 border-t border-gray-200">
				<div className="text-xs font-medium text-gray-400 uppercase tracking-wide xl:pt-3 w-8 flex-shrink-0">
					ELSE
				</div>
				<div className="flex-1 xl:flex-initial">
					<label className="block text-xs font-medium text-gray-500 mb-1.5">
						Assign to
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
				</div>
			</div>
		</div>
	);
};
