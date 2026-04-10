import React, { type FC } from "react";
import Select from "react-select";

type OptionType<T> = {
	value: T;
	label: string;
};

type Props<T> = {
	className?: string;
	defaultValue: OptionType<T>;
	value: OptionType<T>;
	options: Array<OptionType<T>>;
	menuPlacement?: "top" | "bottom";
	maxMenuHeight?: number;
	onChange?: (option: OptionType<T> | null) => void;
	showDot?: boolean;
	customStyles?: any;
	isSearchable?: boolean;
	isDisabled?: boolean;
};

const getDotColor = (value: string) => {
	switch (value) {
		case "live":
			return "#22c55e"; // green
		case "mocked":
			return "#6b7280"; // gray
		case "sandbox":
			return "#3b82f6"; // blue
		case "disabled":
		case "disable":
			return "#ef4444"; // red
		default:
			return "#d1d5db"; // fallback gray
	}
};

const CustomOption = (props: any) => {
	const { data, innerRef, innerProps, isFocused } = props;
	return (
		<div
			ref={innerRef}
			{...innerProps}
			style={{
				backgroundColor: isFocused ? "#eff6ff" : "white",
				color: "#111827",
				fontSize: "14px",
				display: "flex",
				alignItems: "center",
				padding: "8px 12px",
				cursor: "pointer",
			}}
		>
			<span
				style={{
					width: 8,
					height: 8,
					borderRadius: "50%",
					backgroundColor: getDotColor(data.value),
					marginRight: 8,
				}}
			/>
			{data.label}
		</div>
	);
};

const CustomSingleValue = (props: any) => {
	const { data } = props;
	return (
		<div
			style={{
				display: "flex",
				marginTop: -22,
				alignItems: "center",
				fontSize: "14px",
				fontWeight: 500,
				color: "#111827",
				width: 125,
			}}
		>
			<span
				style={{
					width: 10,
					height: 10,
					borderRadius: "50%",
					backgroundColor: getDotColor(data.value),
					marginRight: 10,
					marginLeft: 8,
				}}
			/>
			{data.label}
		</div>
	);
};

// Styles
const SelectDropdownCustomStyles = {
	control: (provided: any, state: any) => ({
		...provided,
		height: 45,
		fontSize: "14px",
		fontWeight: 500,
		borderRadius: "8px",
		borderColor: state.isFocused ? "#4B5563" : "#e5e7eb",
		boxShadow: "none",
		"&:hover": {
			borderColor: "#9ca3af",
		},
	}),
	option: (provided: any) => ({
		...provided,
		padding: 10,
	}),
	singleValue: (provided: any) => ({
		...provided,
		margin: 0,
	}),
	indicatorSeparator: () => ({
		display: "none",
	}),
	dropdownIndicator: (provided: any) => ({
		...provided,
		color: "#9ca3af",
	}),
};

const SelectComponent: FC<Props<any>> = ({
	className,
	defaultValue,
	value,
	options,
	menuPlacement,
	maxMenuHeight,
	onChange,
	showDot,
	customStyles,
	isSearchable = false,
	isDisabled = false,
}) => {
	return (
		<Select
			className={className}
			defaultValue={defaultValue}
			value={value}
			options={options}
			styles={{
				...SelectDropdownCustomStyles,
				...(customStyles ?? {}),
				menuPortal: (provided: any) => ({
					...provided,
					zIndex: 60,
				}),
			}}
			menuPosition="fixed"
			menuPlacement={menuPlacement ?? "auto"}
			maxMenuHeight={maxMenuHeight ?? 150}
			onChange={onChange}
			isSearchable={isSearchable}
			isDisabled={isDisabled}
			components={{
				IndicatorSeparator: () => null,
				...(showDot
					? {
							Option: CustomOption,
							SingleValue: CustomSingleValue,
						}
					: {}),
			}}
		/>
	);
};

export default SelectComponent;
