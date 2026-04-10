import React, { useState } from "react";
import { type Path, useForm } from "react-hook-form";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { twMerge } from "tailwind-merge";
import InfoIcon from "@/assets/InfoIcon";
import Button from "@/components/Button";
import FormattedCheckbox from "@/components/Checkbox/FormattedCheckbox";
import CountrySelectorDropdown from "@/components/Dropdown/CountrySelectorDropdown";
import { Input } from "@/components/Input";
import SkeletonLoader from "@/components/Loader/SkeletonLoader";
import PlacesAutocomplete, {
	type PlaceComponentResponse,
} from "@/components/PlacesAutocomplete";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { useConditionalAddBusinessFields } from "@/hooks/useConditionalAddBusinessFields";
import { cn, normalizeCountryToISO3166, omit } from "@/lib/utils";
import { startApplicationCreateBusinessSchema } from "@/lib/validation";

import COUNTRIES from "@/constants/Countries";

export interface StartApplicationFormValues {
	businessName: string;
	dbaName?: string;
	address: string;
	country: string;
	skipCreditCheck?: boolean;
	bypassSSN?: boolean;
}

export interface StartApplicationSubmitValues extends Omit<
	PlaceComponentResponse,
	"address" | "companyName"
> {
	businessName: string;
	dbaName?: string;
	skipCreditCheck?: boolean;
	bypassSSN?: boolean;
}

interface StartApplicationFormProps {
	isLoading: boolean;
	isInternationalizationEnabled: boolean;
	onSubmit: (data: StartApplicationSubmitValues) => Promise<void> | void;
	onCancel: () => void;
}

export const StartApplicationForm: React.FC<StartApplicationFormProps> = (
	props,
) => {
	const {
		register,
		handleSubmit,
		reset,
		setValue,
		getValues,
		control,
		watch,
		trigger,
		formState: { errors, isValid },
	} = useForm<StartApplicationFormValues>({
		defaultValues: {
			businessName: "",
			dbaName: "",
			address: "",
			country: COUNTRIES.USA,
		},
		mode: "all",
		resolver: yupResolver(startApplicationCreateBusinessSchema),
	});

	const [selectedPlace, setSelectedPlace] =
		useState<PlaceComponentResponse | null>(null);
	const address = watch("address") || "";
	const businessName = watch("businessName") || "";
	const [addressOnFocus, setAddressOnFocus] = useState<string>(address);
	const {
		equifaxEnabled,
		ssnRequired,
		isLoading: areConditionalFieldsLoading,
	} = useConditionalAddBusinessFields();

	/**
	 * The form is only valid if the form inputs are valid *and* a place has been selected,
	 * i.e. the user has selected an address from the autocomplete. This is to prevent the
	 * userfrom submitting the form with an address not found by Google.
	 */
	const isFormValid = isValid && !!selectedPlace;

	const onPlaceSelect = (place: PlaceComponentResponse) => {
		setSelectedPlace(place);
		const { companyName, address, country } = place;
		const businessName = companyName || getValues().businessName;
		const countryCode = normalizeCountryToISO3166(country) || "";

		const currentValues = getValues();
		reset({
			...currentValues,
			businessName,
			address,
			country: countryCode,
		});
	};

	const onSubmit = async (data: StartApplicationFormValues) => {
		if (!selectedPlace) return;

		await props.onSubmit({
			...omit(selectedPlace, "address", "companyName"),
			businessName: data.businessName,
			dbaName: data.dbaName,
			...(data.skipCreditCheck && { skipCreditCheck: data.skipCreditCheck }),
			...(data.bypassSSN && { bypassSSN: data.bypassSSN }),
		});
	};

	if (areConditionalFieldsLoading) {
		return (
			<div className="flex flex-col gap-12">
				<div className="flex flex-col gap-8">
					<SkeletonLoader loading={true} className="h-8 w-40" />
					<SkeletonLoader loading={true} className="h-12" />
					<SkeletonLoader loading={true} className="h-12" />
				</div>
				<div className="flex flex-col gap-8">
					<SkeletonLoader loading={true} className="h-8 w-40" />
					<SkeletonLoader loading={true} className="h-12" />
					<SkeletonLoader loading={true} className="h-12" />
				</div>
				<SkeletonLoader loading={true} className="h-8 w-50 justify-self-end" />
			</div>
		);
	}

	return (
		<form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
			<p className="text-base text-[#1F2937] font-semibold">Business Details</p>
			<div className="flex flex-col gap-3">
				<PlacesAutocomplete
					name="businessName"
					setValue={(name, value) => {
						setValue(name, value);
					}}
					onPlaceSelect={onPlaceSelect}
					isBusiness
					countryRestriction={watch("country")}
				>
					<Input
						name="businessName"
						label="Legal Business Name"
						register={register}
						value={businessName}
						placeholder=""
						errors={errors}
						isRequired
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</PlacesAutocomplete>
				<Input
					name="dbaName"
					label="DBA"
					register={register}
					errors={errors}
					labelClassName="font-normal text-xs text-[#1F2937]"
					className="px-2 py-2.5"
				/>
			</div>

			<p className="col-span-12 mt-8 md:col-span-12 sm:col-span-12 text-base text-[#1F2937] font-semibold">
				Location Address
			</p>
			{props.isInternationalizationEnabled && (
				<div className="col-span-12 sm:col-span-6">
					<CountrySelectorDropdown
						control={control}
						label="Country"
						name="country"
						isRequired={true}
						errors={errors}
						triggerOnSelect={() => {
							const errorKeys = Object.keys(errors) as Array<
								Path<StartApplicationFormValues>
							>;
							if (errorKeys.length) void trigger(errorKeys);
						}}
					/>
				</div>
			)}
			<div className="col-span-12 sm:col-span-6 md:col-span-6">
				<PlacesAutocomplete
					onPlaceSelect={onPlaceSelect}
					name="address"
					setValue={(name, value) => {
						setValue(name, value);
					}}
					countryRestriction={watch("country")}
				>
					<Input
						name="address"
						label="Address"
						placeholder=""
						register={register}
						value={address}
						errors={errors}
						isRequired
						labelClassName="font-normal text-xs text-[#1F2937]"
						className={cn("px-2 py-2.5", !selectedPlace && "text-gray-400")}
						onFocus={() => {
							setAddressOnFocus(address);
						}}
						onChange={(e) => {
							/** Clear selectedPlace only when user actually modifies the input */
							if (e.target.value !== addressOnFocus && selectedPlace)
								setSelectedPlace(null);
						}}
						onBlur={() => {
							/** Only clear address if user changed the value and didn't select a new place */
							if (address !== addressOnFocus && !selectedPlace)
								setValue("address", "");
						}}
					>
						{!selectedPlace && address && addressOnFocus && (
							<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
								<ExclamationTriangleIcon
									className="size-4 text-[#F59E0B] cursor-pointer"
									title="Please select an address from the list of suggestions."
								/>
							</div>
						)}
					</Input>
				</PlacesAutocomplete>
			</div>
			<div className="col-span-12">
				{equifaxEnabled && (
					<div className="grid grid-cols-1 mt-5 gap-x-6 gap-y-8 sm:grid-cols-4">
						<div className="sm:col-span-3">
							<div className="flex flex-row items-center justify-start gap-2 mt-5">
								<FormattedCheckbox
									label="Skip personal credit checks on this business"
									id="skipCreditCheck"
									name="skipCreditCheck"
									register={register}
									errors={errors}
								/>
								<ReactCustomTooltip
									id={`skipcreditcheck-tooltip`}
									tooltip={
										<>
											{
												"When selected, personal credit checks will not be run on any owner associated with this business."
											}
										</>
									}
									place="right"
									tooltipStyle={{
										maxWidth: "400px",
										zIndex: 1000,
										fontSize: "12px",
									}}
								>
									<InfoIcon />
								</ReactCustomTooltip>
							</div>
						</div>
					</div>
				)}
				{ssnRequired && (
					<div className="grid grid-cols-1 mt-5 gap-x-6 gap-y-8 sm:grid-cols-4">
						<div className="sm:col-span-3">
							<div className="flex flex-row items-center justify-start gap-2 mt-5">
								<FormattedCheckbox
									label="Skip Social Security Number checks on this business"
									id="bypassSSN"
									name="bypassSSN"
									register={register}
									errors={errors}
								/>
								<ReactCustomTooltip
									id={`bypass-ssn-tooltip`}
									tooltip={
										<>
											{
												"When selected, Social Security Number checks will not be run on any owner associated with this business."
											}
										</>
									}
									place="right"
									tooltipStyle={{
										maxWidth: "400px",
										zIndex: 1000,
										fontSize: "12px",
									}}
								>
									<InfoIcon />
								</ReactCustomTooltip>
							</div>
						</div>
					</div>
				)}
			</div>
			<div className="flex justify-end col-span-12 gap-x-2 mt-4 border-t border-[#E5E7EB] pt-4">
				<Button
					type="button"
					color="grey"
					size="md"
					onClick={() => {
						props.onCancel();
					}}
					outline
					className="rounded-lg"
				>
					Cancel
				</Button>
				<div className="relative right-0 inline-block rounded-lg">
					<Button
						type="submit"
						color="primary"
						size="md"
						disabled={!isFormValid}
						className="rounded-lg"
						isLoading={props.isLoading}
					>
						Start Application
					</Button>
					<div
						className={twMerge(
							"top-0 bottom-0 left-0 right-0 bg-transparent rounded-lg",
							!isFormValid ? "absolute cursor-not-allowed" : "relative",
						)}
						onClick={() => {
							void trigger();
						}}
					/>
				</div>
			</div>
		</form>
	);
};
