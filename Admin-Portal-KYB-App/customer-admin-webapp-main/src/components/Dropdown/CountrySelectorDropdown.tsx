import React, { useMemo, useState } from "react";
import ReactFlagsSelect from "react-flags-select";
import { Controller } from "react-hook-form";
import { getItem } from "@/lib/localStorage";
import { normalizeCountriesFromApi } from "@/lib/utils/normalizeCountriesFromApi";
import { useGetCustomerCountries } from "@/services/queries/onboarding.query";
import "./CountrySelectorDropdown.css";

import { ONBOARDING_SETUP_ID } from "@/constants/ConstantValues";
import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface Props {
	label: string;
	isRequired?: boolean;
	name: string;
	control: any;
	disabled?: boolean;
	errors?: any;
	triggerOnSelect?: () => void;
	customerId?: string;
}

const CountrySelectorDropdown: React.FC<Props> = ({
	label,
	isRequired,
	name,
	control,
	disabled,
	errors,
	triggerOnSelect,
	customerId,
}) => {
	const [refreshKey, setRefreshKey] = useState(0);

	// Get customerId from prop or localStorage
	const resolvedCustomerId =
		customerId ?? getItem(LOCALSTORAGE.customerId) ?? "";

	const { data: countriesData, error: countriesError } =
		useGetCustomerCountries(
			resolvedCustomerId,
			ONBOARDING_SETUP_ID.INTERNATIONAL_BUSINESS,
		);

	// Normalize countries from API response to format expected by ReactFlagsSelect
	// Handles UK -> GB conversion and provides fallback for errors
	const availableCountries = useMemo(() => {
		// If API call failed or returned no data, use fallback
		if (countriesError || !countriesData?.data) {
			return normalizeCountriesFromApi(null);
		}

		return normalizeCountriesFromApi(countriesData.data);
	}, [countriesData, countriesError]);

	return (
		<>
			<div className="flex flex-row">
				<label className="block text-xs font-normal leading-6 text-gray-900 whitespace-nowrap font-Inter">
					{label}
				</label>
				{isRequired && <span className="text-sm text-red-600">*</span>}
			</div>
			<Controller
				name={name}
				control={control}
				render={({ field: { value, onChange } }) => {
					return (
						<ReactFlagsSelect
							key={`country-select-${refreshKey}`}
							onSelect={(e) => {
								onChange(e);
								void triggerOnSelect?.();

								/**
								 * Within a modal, react-flags-select does not properly dismiss after selecting a country.
								 * This is a workaround to force a refresh of the component and dismiss the menu after selecting a country when a modal is open.
								 *
								 * Setting a new key will cause the component to re-render, which will dismiss the dropdown.
								 */
								if (document.getElementById("headlessui-portal-root")) {
									setTimeout(() => {
										setRefreshKey((prev) => prev + 1);
									}, 0);
								}
							}}
							disabled={disabled}
							searchable={true}
							searchPlaceholder={`Select ${label}`}
							selected={value}
							countries={availableCountries}
						/>
					);
				}}
			/>
			{errors ? (
				<p className="mt-2 text-sm text-red-600">
					{errors?.[name] && String(errors?.[name]?.message)}
				</p>
			) : null}
		</>
	);
};

export default CountrySelectorDropdown;
