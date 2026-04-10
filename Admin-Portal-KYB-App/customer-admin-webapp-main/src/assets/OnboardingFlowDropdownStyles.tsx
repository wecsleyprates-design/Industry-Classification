export const OnboardingFlowDropdownStyles = {
	control: (provided: any, state: any) => {
		return {
			...provided,
			height: 46,
			fontSize: "14px",
			textColor: "#2596be",
			fontFamily: "Inter, sans-serif",
			borderRadius: 6,
			borderColor: "#e5e6eb",
			boxShadow: state?.isFocused ? "0 0 0 2px #F3F4F6" : null,
			border: state?.selectProps?.value
				? "1px solid #E5E7EB"
				: "2px solid #E5E7EB",
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
		color: "#9CA3AF",
		fontFamily: "Inter, sans-serif",
	}),
	singleValue: (provided: any) => ({
		...provided,
		color: "#5c5c5c", // Text color for the selected option
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
				? "#F3F4F6"
				: provided.backgroundColor,
		color: "#5E5E5E",
		fontWeight: state.isSelected ? 500 : 400,
		"&:hover": {
			backgroundColor: "#F3F4F6",
		},
	}),
};
