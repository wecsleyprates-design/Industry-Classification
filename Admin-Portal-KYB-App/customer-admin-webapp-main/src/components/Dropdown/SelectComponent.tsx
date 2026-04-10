import React, { type FC } from "react";
import Select from "react-select";
import { CheckIcon } from "@heroicons/react/20/solid";

type OptionType<T> = {
	value: T;
	label: T;
};

type Props<T> = {
	className?: string;
	defaultValue: OptionType<T>;
	value: OptionType<T>;
	options: Array<OptionType<T>>;
	menuPlacement?: "top" | "bottom";
	maxMenuHeight?: number;
	onChange?: (arg0: T) => void;
};

const SelectDropdownCustomStyles = {
	control: (provided: any, state: any) => ({
		...provided,
		height: 45,
		fontSize: "14px",
		fontFamily: "Inter, sans-serif",
		boxShadow: "none",
		border: state.isFocused ? "2.5px solid #4B5563" : provided.border,
		borderRadius: "8px",
		"&:focus": {
			borderColor: "#000",
			outline: "none",
		},
		"&:hover": {
			borderColor: state.isFocused ? "#4B5563" : provided.borderColor,
		},
	}),
	placeholderContainer: (provided: any) => ({
		...provided,
		overflow: "hidden",
	}),
	option: (provided: any, state: any) => ({
		...provided,
		fontSize: "14px",
		backgroundColor: state.isSelected
			? "#2563eb"
			: state.isFocused
				? "#3B82F682"
				: provided.backgroundColor,
		color: state.isSelected ? "white" : provided.color,
	}),
};

const ReactSelectStyles = {
	control: (provided: any, state: any) => ({
		...provided,
		height: 40,
		fontSize: "14px",
		fontWeight: "600",
		color: "#374151",
		boxShadow: "none",
		borderRadius: "7px",
		borderColor: "#e5e7eb",
		display: "flex",
		justifyContent: "space-between",
		paddingRight: "0px",
		paddingLeft: "0px",
		"&:hover": {
			borderColor: "#e5e7eb",
			backgroundColor: "#f9fafb",
		},
	}),
	placeholderContainer: (provided: any) => ({
		...provided,
		overflow: "hidden",
	}),
	option: (provided: any, state: any) => ({
		...provided,
		fontSize: "14px",
		backgroundColor: state.isSelected
			? "#2563eb"
			: state.isFocused
				? "#3B82F682"
				: provided.backgroundColor,
		color: state.isSelected ? "white" : provided.color,
	}),
	dropdownIndicator: (provided: any) => ({
		...provided,
		color: "#bec3cb",
		padding: "0 6px",
	}),
	indicatorSeparator: (provided: any) => ({
		...provided,
		display: "none",
	}),
};

//  Added to give tick ahead of selected component
const CustomOption = (props: any) => {
	const { data, innerRef, innerProps, isSelected, isFocused } = props;
	return (
		<div
			ref={innerRef}
			{...innerProps}
			style={{
				backgroundColor: isSelected
					? "#dbeafe"
					: isFocused
						? "#eff6ff"
						: "white",
				color: isSelected ? "#2563eb" : "black",
				display: "flex",
				fontSize: "14px",
				padding: "10px 10px",
				alignItems: "center",
			}}
			className="flex justify-between"
		>
			{data.label}
			{isSelected && (
				<span>
					<CheckIcon className="w-3 h-3" />
				</span>
			)}
		</div>
	);
};

// component used for transaction date filter
export const ReactSelect = ({
	lists,
	defaultValue,
	value,
	onChange,
}: {
	lists: any[];
	defaultValue: Record<string, unknown>;
	value: Record<string, unknown>;
	onChange: (val: any) => void;
}) => {
	return (
		<div className="relative min-w-fit">
			<Select
				styles={ReactSelectStyles}
				defaultValue={defaultValue}
				value={value}
				options={lists}
				components={{ Option: CustomOption }}
				closeMenuOnSelect={true}
				onChange={onChange}
				isSearchable={false}
			/>
		</div>
	);
};

const SelectComponent: FC<Props<any>> = ({
	className,
	defaultValue,
	value,
	options,
	menuPlacement,
	maxMenuHeight,
	onChange,
}) => {
	return (
		<Select
			className={className}
			defaultValue={defaultValue}
			value={value}
			options={options}
			components={{
				IndicatorSeparator: () => null,
			}}
			styles={SelectDropdownCustomStyles}
			menuPlacement={menuPlacement ?? "auto"}
			maxMenuHeight={maxMenuHeight ?? 120}
			onChange={onChange}
		/>
	);
};

export default SelectComponent;
