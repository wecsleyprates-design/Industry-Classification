export const SelectDropdownCustomStyles = {
	control: (provided: any, state: any) => ({
		...provided,
		height: 46,
		fontSize: "14px",
		borderRadius: 6,
		boxShadow: "none",
		border: state.isFocused ? "2.5px solid #000" : "1px solid #DFDFDF",
		"&:focus": {
			borderColor: "#000",
			outline: "none",
		},
		"&:hover": {
			borderColor: state.isFocused ? "#000" : "1px solid #E5E7EB",
		},
	}),
	placeholder: (base: any, state: any) => ({
		...base,
		lineHeight: "30px",
		color:
			state.selectProps.placeholder === "Select industry" ||
			state.selectProps.placeholder === "Select title ..."
				? "#9ca3af"
				: "#374151",
		fontWeight:
			state.selectProps.placeholder === "Select industry" ||
			state.selectProps.placeholder === "Select title ..."
				? 100
				: 200,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	}),
	placeholderContainer: (provided: any) => ({
		...provided,
		overflow: "hidden",
	}),
	option: (provided: any, state: any) => ({
		...provided,
		fontSize: "14px",
		backgroundColor: state.isSelected
			? "white"
			: state.isFocused
				? "#3B82F682"
				: provided.backgroundColor,
		color: state.isSelected ? "black" : provided.color,
		fontWeight: state.isSelected ? 500 : 400,
		"&:hover": {
			backgroundColor: "#3B82F682",
		},
	}),
};
