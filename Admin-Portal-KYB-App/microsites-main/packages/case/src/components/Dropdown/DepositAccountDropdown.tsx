import { useEffect, useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { StylesConfig } from "react-select";
import Select from "react-select";
import { useGetBankingIntegration } from "@/services/queries/integration.query";

interface DepositoryAccountSelectProps {
	name: string;
	bankIdField: string;
	businessId: string;
	disabled?: boolean;
}
interface DepositoryAccountOption {
	label: string;
	value: string;
	id: string;
}

const depositorySelectStyles: StylesConfig<DepositoryAccountOption, false> = {
	control: (base) => ({
		...base,
		minHeight: 44,
		borderRadius: 8,
		borderColor: "#D1D5DC",
		boxShadow: "none",
		"&:hover": {
			borderColor: "#D1D5DC",
		},
	}),

	placeholder: (base) => ({
		...base,
		color: "#101828",
		fontSize: "16px",
	}),

	singleValue: (base) => ({
		...base,
		color: "#101828",
		fontSize: "14px",
	}),

	dropdownIndicator: (base) => ({
		...base,
		color: "#6B7280",
		"&:hover": {
			color: "#6B7280",
		},
	}),

	menu: (base) => ({
		...base,
		borderRadius: 8,
	}),
	menuList: (base) => ({
		...base,
		maxHeight: 180,
		overflowY: "auto",
	}),

	option: (base, state) => ({
		...base,
		fontSize: "14px",
		backgroundColor: state.isSelected
			? "#F3F4F6"
			: state.isFocused
				? "#F9FAFB"
				: "white",
		color: "#101828",
	}),
};

const buildDepositoryOptions = (
	data: any[] | undefined,
): DepositoryAccountOption[] => {
	if (!data) return [];

	return (
		data
			// .filter((account) => account.type === "depository")
			.map((account) => ({
				label: `••••${account.mask}`,
				value: account.id,
				id: account.id,
			}))
	);
};

const DepositoryAccountSelect = ({
	name,
	bankIdField,
	businessId,
	disabled,
}: DepositoryAccountSelectProps) => {
	const { control, setValue, getValues } = useFormContext();

	const { data, isLoading } = useGetBankingIntegration({
		businessId,
	});

	const options = useMemo(() => buildDepositoryOptions(data?.data), [data]);

	useEffect(() => {
		if (options.length === 1) {
			const selected = options[0];

			if (!getValues(name)) {
				setValue(name, selected, {
					shouldValidate: true,
					shouldDirty: true,
				});

				setValue(bankIdField, selected.id, {
					shouldValidate: true,
					shouldDirty: true,
				});
			}
		}
	}, [options]);

	return (
		<Controller
			name={name}
			control={control}
			render={({ field }) => (
				<Select
					{...field}
					options={options}
					isLoading={isLoading}
					isDisabled={disabled}
					isSearchable={false}
					styles={depositorySelectStyles}
					placeholder="Select a bank account…"
					menuPlacement="top"
					components={{ IndicatorSeparator: () => null }}
					onChange={(option) => {
						field.onChange(option);
						setValue(bankIdField, option?.id ?? null, {
							shouldValidate: true,
							shouldDirty: true,
						});
					}}
				/>
			)}
		/>
	);
};

export default DepositoryAccountSelect;
