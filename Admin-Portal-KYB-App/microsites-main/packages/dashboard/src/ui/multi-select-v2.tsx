import React, { useState } from "react";
import ReactSelect, { components, type MultiValue } from "react-select";
import { Button } from "./button";

const CustomMenu = (props: any) => {
	const { selectProps } = props;
	const { onChange } = selectProps;

	const handleClearAll = () => {
		onChange([], { action: "clear" });
	};

	return (
		<components.Menu {...props}>
			<div className="flex p-2 gap-x-2 items-center justify-between border-b border-gray-200 h-[56px]">
				<div className="text-sm text-gray-500 font-normal">
					{selectProps.value.length} Selected
				</div>
				<Button
					onClick={handleClearAll}
					variant="ghost"
					className="text-sm text-blue-600 font-normal hover:bg-transparent hover:text-blue-600"
				>
					Reset
				</Button>
			</div>
			{props.children}
		</components.Menu>
	);
};

const CustomValueContainer = (props: any) => {
	const { children, selectProps } = props;
	const { value } = selectProps;

	if (value && value.length > 0) {
		return (
			<components.ValueContainer {...props}>
				<div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
					{value.length}
				</div>
				<div className="text-sm text-gray-800 px-1 py-2 font-normal">
					Team Members
				</div>

				{children[1]}
			</components.ValueContainer>
		);
	}

	return (
		<components.ValueContainer {...props}>{children}</components.ValueContainer>
	);
};

interface MultiSelectV2Props {
	options: MultiValue<{ label: string; value: string }>;
	placeholder?: string;
	onValueChange: (
		selected: MultiValue<{ label: string; value: string }>,
	) => void;
	className?: string;
}

const MultiSelectV2: React.FC<MultiSelectV2Props> = ({
	options,
	placeholder,
	onValueChange,
}) => {
	const [selectedOptions, setSelectedOptions] = useState<
		MultiValue<{ label: string; value: string }>
	>([]);

	const handleChange = (
		selected: MultiValue<{ label: string; value: string }>,
	) => {
		if (!selected) {
			setSelectedOptions([]);
			return;
		}

		setSelectedOptions(selected);
		onValueChange(selected);
	};

	return (
		<ReactSelect
			isMulti
			placeholder={placeholder}
			value={selectedOptions}
			options={options}
			onChange={handleChange}
			hideSelectedOptions={false}
			closeMenuOnSelect={false}
			isClearable={false}
			components={{
				IndicatorSeparator: () => null,
				Menu: CustomMenu,
				ValueContainer: CustomValueContainer,
			}}
			formatOptionLabel={(e) => {
				return (
					<div className="flex items-center gap-x-3">
						<div className="relative flex items-center">
							<input
								type="checkbox"
								className="appearance-none w-6 h-6 border-2 rounded-sm checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
								checked={selectedOptions.some((opt) => opt.value === e.value)}
								readOnly
							/>
							{selectedOptions.some((opt) => opt.value === e.value) && (
								<div className="absolute left-[9px] top-[4px] w-[6px] h-[12px] border-r-2 border-b-2 border-white rotate-45" />
							)}
						</div>
						{e.label}
					</div>
				);
			}}
			styles={{
				control: (provided: any, state: any) => {
					return {
						...provided,
						minHeight: 44,
						minWidth: "240px",
						maxWidth: "400px",
						fontSize: "14px",
						textColor: "#2596be",
						borderRadius: 8,
						borderColor: "#E5E7EB",
						boxShadow: state?.isFocused ? "0 0 0 2px #F3F4F6" : null,
						border: "1px solid #E5E7EB",
						outline: "none",
						backgroundColor: state?.isDisabled ? "#f9fafb" : "white",
						cursor: state?.isDisabled ? "not-allowed" : "default",
						"&:hover": {
							borderColor: "e5e6eb",
							boxShadow: "0 0 0 2px #F3F4F6",
						},
					};
				},
				placeholder: (base: any) => ({
					...base,
					lineHeight: "30px",
					color: "#1F2937",
				}),
				singleValue: (provided: any) => ({
					...provided,
					color: "#5c5c5c",
				}),
				option: (provided: any, state: any) => ({
					...provided,
					fontSize: "14px",
					backgroundColor: state.isSelected
						? "white"
						: state.isFocused
							? "#F3F4F6"
							: provided.backgroundColor,
					color: "#5E5E5E",
					fontWeight: 400,
					"&:hover": {
						backgroundColor: "#F3F4F6",
					},
				}),
				multiValue: (base) => ({
					...base,
					backgroundColor: "transparent",
					border: "1px solid #D1D5DB",
					borderRadius: "6px",
					padding: "2px 6px",
					boxShadow: "2px 2px 6px rgba(209, 213, 219, 0.5)",
					display: "flex",
					alignItems: "center",
				}),
				multiValueLabel: (base) => ({
					...base,
					color: "#374151",
					fontWeight: "500",
					padding: "0px 6px",
				}),
				multiValueRemove: (base) => ({
					...base,
					color: "#6B7280",
					cursor: "pointer",
					":hover": {
						backgroundColor: "#D1D5DB",
						color: "#374151",
						borderRadius: "4px",
					},
				}),
			}}
			className="basic-multi-select"
			classNamePrefix="select"
		/>
	);
};

export default MultiSelectV2;
