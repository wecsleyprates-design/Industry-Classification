import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { PlusIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import axios from "axios";
import { twMerge } from "tailwind-merge";
import { v4 as uuidv4 } from "uuid";
import InfoIcon from "@/assets/InfoIcon";
import Button from "@/components/Button";
import FormattedCheckbox from "@/components/Checkbox/FormattedCheckbox";
import CountrySelectorDropdown from "@/components/Dropdown/CountrySelectorDropdown";
import { Input } from "@/components/Input";
import TINInput from "@/components/Input/TINInput";
import CustomWarningModal from "@/components/Modal/CustomWarningModal";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { type PlaceComponentResponse } from "@/components/PlacesAutocomplete/PlacesAutocomplete";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { useConditionalAddBusinessFields } from "@/hooks/useConditionalAddBusinessFields";
import useCustomToast from "@/hooks/useCustomToast";
import { getSlugReplacedURL } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import {
	normalizeCountryToISO,
	normalizeCountryToISO3166,
	normalizeStateToCode,
} from "@/lib/utils";
import { newBusinessSchema } from "@/lib/validation";
import { useCreateBusiness } from "@/services/queries/businesses.query";
import { useGetOnboardingSetup } from "@/services/queries/case.query";
import { type NewBusinessType } from "@/types/business";
import { STATUS_CODES } from "../../constants/StatusCodes";

import COUNTRIES from "@/constants/Countries";
import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

const countryMap = {
	Canada: COUNTRIES.CANADA,
	"United States": COUNTRIES.USA,
	"United Kingdom": COUNTRIES.UK,
};

type ModalType = "business_not_found" | "duplicate_external_id";

const NewBusiness: React.FC = () => {
	const navigate = useNavigate();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const applicantId: string = getItem(LOCALSTORAGE.userId) ?? "";
	const [showMailingAddress, setShowMailingAddress] = useState<boolean>(false);
	const [showModal, setShowModal] = useState<boolean>(false);
	const [modalType, setModalType] = useState<ModalType>("business_not_found");
	const { errorHandler } = useCustomToast();

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
	} = useForm<NewBusinessType>({
		defaultValues: {
			isMailingAddress: false,
			country: "US",
		},
		mode: "all",
		resolver: yupResolver(newBusinessSchema),
	});

	const {
		isPending: createBusinessLoading,
		mutateAsync: createBusiness,
		data: createBusinessData,
		error: createBusinessError,
	} = useCreateBusiness();

	const { data: onboardingSetupData } = useGetOnboardingSetup(customerId ?? "");

	const businessName = watch("businessName") || "";
	const street = watch("street") || "";

	const isInternationalizationEnabled = useMemo(() => {
		return onboardingSetupData?.data?.find(
			(e) => e.code === "international_business_setup",
		)?.is_enabled;
	}, [onboardingSetupData]);

	const {
		equifaxEnabled,
		ssnRequired,
		isLoading: areConditionalFieldsLoading,
	} = useConditionalAddBusinessFields();

	const onSubmit = async (data: NewBusinessType) => {
		const {
			businessName,
			dbaName,
			tin,
			street,
			suite,
			country,
			city,
			state,
			zip,
			mStreet,
			mSuite,
			mCity,
			mState,
			mZip,
			npi,
			externalId,
			skipCreditCheck,
			bypassSSN,
		} = data;

		// Normalize state to 2-character code as required by backend
		const normalizedState =
			country !== COUNTRIES.UK
				? normalizeStateToCode(state, country)
				: undefined;

		// Normalize country code to ISO 3166-1 alpha-2 format
		const normalizedCountry = normalizeCountryToISO(country);

		const reqObject = {
			...(externalId && { external_id: externalId }),
			name: businessName,
			tin,
			quick_add: true, // as this is quick add flow, we always have to mark it as true
			address_line_1: street,
			...(suite && { address_line_2: suite }),
			address_postal_code: zip,
			address_city: city,
			...(normalizedState && { address_state: normalizedState }),
			address_country: normalizedCountry,
			...(npi ? { npi } : {}),
			...(dbaName && { dba1: dbaName }),
			...(mStreet && { address1_line_1: mStreet }),
			...(mSuite && { address1_apartment: mSuite }),
			...(mCity && { address1_city: mCity }),
			...(mState && { address1_state: normalizeStateToCode(mState, country) }),
			...(mZip && { address1_postal_code: mZip }),
			...(mStreet && { address1_country: normalizedCountry }),
			...(skipCreditCheck && { skip_credit_check: skipCreditCheck }),
			...(bypassSSN && { bypass_ssn: bypassSSN }),
		};
		await createBusiness({ body: [reqObject], customerId, applicantId });
	};

	useEffect(() => {
		if (createBusinessError) {
			if (
				axios.isAxiosError(createBusinessError) &&
				createBusinessError?.response?.status !== STATUS_CODES.FORBIDDEN
			) {
				// the Quick Add process uses a bulk endpoint, but only ever creates one business at a time
				// therefore, we only need to check the error data for the first business in the array
				const failedRows =
					createBusinessError?.response?.data?.data?.failed_rows;
				// ["0"] is the property containing the object which stores the data for the first and only business
				// the 'data' property is an array of errors, so we need to access the first error at index 0
				const errorData = failedRows?.["0"]?.data?.[0];
				if (
					errorData?.column === "external_id" &&
					errorData?.reason?.includes(
						"The business external ID already exists for this customer",
					)
				) {
					setModalType("duplicate_external_id");
				} else {
					setModalType("business_not_found");
				}
				setShowModal(true);
			} else {
				errorHandler(createBusinessError);
			}
		}
	}, [createBusinessError]);

	useEffect(() => {
		if (createBusinessData) {
			const slug = String(
				createBusinessData?.data?.result?.["0"].data_businesses?.id ?? "",
			);
			if (slug) {
				navigate(
					`${getSlugReplacedURL(URL.BUSINESS_DETAILS, slug)}?showModal=true`,
				);
			}
		}
	}, [createBusinessData]);

	const handleCompanyChangedCallback = (val: PlaceComponentResponse) => {
		const { companyName, street, city, zip, state, suite, country } = val;
		const countryField =
			normalizeCountryToISO3166(country) || getValues().country;
		if (street.trim() !== "") {
			const currentValues = getValues();
			reset(
				{
					...currentValues,
					businessName: companyName,
					street,
					city,
					zip,
					suite,
					state: countryField !== COUNTRIES.UK ? state : "",
					country: countryField,
				},
				{
					keepDefaultValues: false,
				},
			);
		}
	};

	const resetStreetCallback = (val: PlaceComponentResponse) => {
		const { street, city, zip, state, suite, country } = val;
		const countryField =
			normalizeCountryToISO3166(country) || getValues().country;
		const currentValues = getValues();
		reset(
			{
				...currentValues,
				street,
				city,
				zip,
				state: countryField !== COUNTRIES.UK ? state : "",
				suite,
				country: countryField,
			},
			{
				keepDefaultValues: false,
			},
		);
	};

	const handleDisableClick = () => {
		if (!isValid) {
			void trigger();
		}
	};

	if (areConditionalFieldsLoading) {
		return <FullPageLoader />;
	}

	return (
		<div>
			<PageTitle
				titleText={"New Business"}
				backLocation={URL.BUSINESSES}
				isBackAllowed={true}
			/>
			<form
				className="grid grid-cols-1 gap-3 sm:grid-cols-6 md:grid-cols-12"
				onSubmit={handleSubmit(onSubmit)}
			>
				<p className="col-span-12 mt-8 md:col-span-12 sm:col-span-12 text-base text-[#1F2937] font-semibold">
					Company Details
				</p>
				<div className="col-span-12 sm:col-span-6">
					<PlacesAutocomplete
						name="businessName"
						setValue={setValue}
						handleReset={handleCompanyChangedCallback}
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
				</div>
				{isInternationalizationEnabled && (
					<div className="col-span-12 sm:col-span-6">
						<CountrySelectorDropdown
							control={control}
							label="Country"
							name="country"
							isRequired={true}
							errors={errors}
							triggerOnSelect={() => {
								// Clear tax ID field when country changes
								setValue("tin", "", { shouldValidate: false });
								if (Object.keys(errors).length) {
									void trigger(Object.keys(errors) as any);
								}
							}}
						/>
					</div>
				)}
				<div className="col-span-12 sm:col-span-6 md:col-span-6">
					<Input
						name="dbaName"
						label="DBA Name"
						register={register}
						errors={errors}
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</div>
				<div className="col-span-12 sm:col-span-6 md:col-span-4">
					<TINInput
						name="tin"
						label={getTaxIdLabel(watch("country"), "formLabel")}
						type="text"
						register={register}
						onChange={(e) => {
							setValue("tin", e.target.value, {
								shouldValidate: true,
								shouldDirty: true,
							});
						}}
						errors={errors}
						isRequired
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
						country={watch("country")}
					/>
				</div>
				<div className="col-span-12 sm:col-span-6 md:col-span-4">
					<Input
						name="npi"
						label="NPI Number (For Healthcare Providers)"
						minLength={10}
						register={register}
						errors={errors}
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</div>
				<div className="col-span-12 sm:col-span-6 md:col-span-4">
					<Input
						name="externalId"
						label="External ID"
						maxLength={50}
						register={register}
						errors={errors}
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</div>

				<p className="col-span-12 mt-8 md:col-span-12 sm:col-span-12 text-base text-[#1F2937] font-semibold">
					Location Address
				</p>
				<div className="col-span-12 sm:col-span-6 md:col-span-6">
					<PlacesAutocomplete
						handleReset={resetStreetCallback}
						name="street"
						setValue={setValue}
						countryRestriction={watch("country")}
					>
						<Input
							name="street"
							label="Street Address"
							placeholder=""
							register={register}
							value={street}
							errors={errors}
							isRequired
							labelClassName="font-normal text-xs text-[#1F2937]"
							className="px-2 py-2.5"
						/>
					</PlacesAutocomplete>
				</div>
				<div className="col-span-12 sm:col-span-6 md:col-span-6">
					<Input
						name="suite"
						label="Apt/Suite/PO Box"
						register={register}
						errors={errors}
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</div>
				<div className="col-span-12 sm:col-span-6 md:col-span-4">
					<Input
						name="city"
						label="City"
						register={register}
						errors={errors}
						isRequired
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</div>
				{watch("country") !== COUNTRIES.UK && (
					<div className="col-span-12 sm:col-span-6 md:col-span-4">
						<Input
							name="state"
							label={
								watch("country") === COUNTRIES.CANADA
									? "State/Province/Region"
									: "State"
							}
							onChange={(e) => {
								setValue(
									"state",
									e.target.value
										.normalize("NFD")
										.replace(/[\u0300-\u036f]/g, ""),
									{ shouldDirty: true, shouldValidate: true },
								);
							}}
							register={register}
							errors={errors}
							isRequired
							labelClassName="font-normal text-xs text-[#1F2937]"
							className="px-2 py-2.5"
						/>
					</div>
				)}
				<div className="col-span-12 sm:col-span-6 md:col-span-4">
					<Input
						name="zip"
						label={
							watch("country") === COUNTRIES.CANADA
								? "Zip/Postal Code"
								: "Zip Code"
						}
						register={register}
						errors={errors}
						isRequired
						labelClassName="font-normal text-xs text-[#1F2937]"
						className="px-2 py-2.5"
					/>
				</div>

				{/** Mailing Address Section */}

				<div className="grid grid-cols-1 col-span-12 gap-3 my-4 sm:grid-cols-6 md:grid-cols-12">
					{showMailingAddress ? (
						<>
							<p className="col-span-12  mt-8 md:col-span-12 sm:col-span-12 text-base text-[#1F2937] font-semibold">
								Mailing Address
							</p>
							<div className="col-span-12 sm:col-span-6 md:col-span-6">
								<Input
									name="mStreet"
									label="Street Address"
									register={register}
									errors={errors}
									isRequired
									labelClassName="font-normal text-xs text-[#1F2937]"
									className="px-2 py-2.5"
								/>
							</div>
							<div className="col-span-12 sm:col-span-6 md:col-span-6">
								<Input
									name="mSuite"
									label="Apt/Suite/PO Box"
									register={register}
									errors={errors}
									labelClassName="font-normal text-xs text-[#1F2937]"
									className="px-2 py-2.5"
								/>
							</div>
							<div className="col-span-12 sm:col-span-6 md:col-span-4">
								<Input
									name="mCity"
									label="City"
									register={register}
									errors={errors}
									isRequired
									labelClassName="font-normal text-xs text-[#1F2937]"
									className="px-2 py-2.5"
								/>
							</div>

							{watch("country") !== COUNTRIES.UK && (
								<div className="col-span-12 sm:col-span-6 md:col-span-4">
									<Input
										name="mState"
										onChange={(e) => {
											setValue(
												"mState",
												e.target.value
													.normalize("NFD")
													.replace(/[\u0300-\u036f]/g, ""),
												{ shouldDirty: true, shouldValidate: true },
											);
										}}
										label={
											watch("country") === COUNTRIES.CANADA
												? "State/Province/Region"
												: "State"
										}
										register={register}
										errors={errors}
										isRequired
										labelClassName="font-normal text-xs text-[#1F2937]"
										className="px-2 py-2.5"
									/>
								</div>
							)}
							<div className="col-span-12 sm:col-span-6 md:col-span-4">
								<Input
									name="mZip"
									label={
										watch("country") === COUNTRIES.CANADA
											? "Zip/Postal Code"
											: "Zip Code"
									}
									register={register}
									errors={errors}
									isRequired
									labelClassName="font-normal text-xs text-[#1F2937]"
									className="px-2 py-2.5"
								/>
							</div>
							<div className="col-span-12 mt-4">
								<Button
									color="grey"
									outline
									type="button"
									className="py-3 rounded-lg"
									onClick={() => {
										setValue("isMailingAddress", false);
										setShowMailingAddress(false);
									}}
								>
									<span className="text-red-600">Remove Mailing Address</span>
								</Button>
							</div>
						</>
					) : (
						<div className="col-span-12">
							<Button
								color="grey"
								outline
								type="button"
								className="flex gap-2 py-3 rounded-lg"
								onClick={() => {
									setValue("isMailingAddress", true);
									setShowMailingAddress(true);
								}}
							>
								<PlusIcon className="w-4 h-4 text-black" /> Add Mailing Address
							</Button>
						</div>
					)}
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
				<div className="flex justify-end col-span-12 gap-x-2 mt-4  mb-12 py-6 border-t border-[#E5E7EB]">
					<Button
						color="grey"
						type="button"
						onClick={() => {
							navigate(URL.BUSINESSES);
						}}
						outline
						className="rounded-lg"
					>
						Cancel
					</Button>
					<div className="relative right-0 inline-block h-[42px] rounded-lg min-w-20">
						<Button
							type="submit"
							color="dark"
							disabled={!isValid}
							className="px-6 rounded-lg"
							isLoading={createBusinessLoading}
						>
							Create
						</Button>
						<div
							className={twMerge(
								"top-0 bottom-0 left-0 right-0 bg-transparent rounded-lg",
								!isValid ? "absolute cursor-not-allowed" : "relative",
							)}
							onClick={handleDisableClick}
						/>
					</div>
				</div>
			</form>
			{showModal && (
				<CustomWarningModal
					isOpen={showModal}
					onClose={() => {
						setShowModal(false);
					}}
					onSucess={() => {
						setShowModal(false);
					}}
					title={
						modalType === "duplicate_external_id"
							? "Duplicate External ID"
							: "Business Not Found"
					}
					description={
						modalType === "duplicate_external_id"
							? "The External ID you provided is already in use for another business. Please provide a unique External ID and try again."
							: "We were unable to locate the business based on the information you provided. Please check the details you provided and try again. If the error persists, we recommend sending the applicant an invitation to have them provide updated details."
					}
					buttons={
						<div className="flex justify-end gap-x-2">
							{modalType === "business_not_found" && (
								<Button
									color="grey"
									outline
									className="rounded-lg"
									onClick={() => {
										const navigateURL = getValues().businessName
											? `${URL.SEND_INVITATION}?businessName=${
													getValues().businessName
												}`
											: URL.SEND_INVITATION;
										navigate(navigateURL);
									}}
								>
									Send invitation
								</Button>
							)}
							<Button
								color="dark"
								className="px-6 rounded-lg"
								onClick={() => {
									setShowModal(false);
								}}
							>
								Edit Details
							</Button>
						</div>
					}
					type="danger"
				/>
			)}
		</div>
	);
};

export default NewBusiness;
