import React, { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import InfoIcon from "@/assets/InfoIcon";
import FormattedCheckbox from "@/components/Checkbox/FormattedCheckbox";
import { CustomCreatableSelect } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { PhoneNumberInput } from "@/components/PhoneInput";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { useConditionalAddBusinessFields } from "@/hooks/useConditionalAddBusinessFields";
import { getItem } from "@/lib/localStorage";
import {
	useGetApplicant,
	useGetBusinesses,
	useGetCustomerBusinessConfigs,
} from "@/services/queries/businesses.query";
import ESignWrapper, { type ESignRef } from "./eSign/ESignWrapper";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const SendInviteForm = ({
	businessName,
	setNewBusinessName,
}: {
	businessName: string | undefined;
	setNewBusinessName: React.Dispatch<React.SetStateAction<string | undefined>>;
}) => {
	const eSignRef = useRef<ESignRef>(null);
	const [searchParams] = useSearchParams();
	const [businessId, setBusinessId] = useState("");
	const [options, setOptions] = useState();
	const [customerId] = useState(getItem(LOCALSTORAGE?.customerId));
	const {
		equifaxEnabled,
		ssnRequired,
		eSignEnabled,
		isLoading: areConditionalFieldsLoading,
	} = useConditionalAddBusinessFields();
	const businessNamesParam: string = searchParams.get("businessName") ?? "";
	const businessIdParam: string = searchParams.get("business_id") ?? "";

	const {
		register,
		setValue,
		getValues,
		reset,
		control,
		formState: { errors },
		watch,
	} = useFormContext();

	useEffect(() => {
		if (businessIdParam) {
			setBusinessId(businessIdParam);
			setValue("companyName", {
				business_id: businessIdParam,
				label: businessNamesParam,
				name: businessNamesParam,
				value: businessNamesParam,
			});
			setNewBusinessName(undefined);
		} else if (businessNamesParam && businessNamesParam.trim() !== "") {
			setBusinessId("");
			setValue("companyName", {
				business_id: "",
				label: businessNamesParam,
				name: "",
				value: businessNamesParam,
			});
			setNewBusinessName(businessNamesParam);
		}
	}, [businessNamesParam, businessIdParam]);

	const { data: businessesData, isLoading: businessesLoading } =
		useGetBusinesses({
			customerId: customerId ?? "",
		});
	const { data: applicantData, isInitialLoading } = useGetApplicant(
		customerId ?? "",
		businessId ?? "",
	);
	const {
		data: customerBusinessConfigsData,
		isFetching: areCustomerBusinessConfigsLoading,
	} = useGetCustomerBusinessConfigs(customerId ?? "", businessId ?? "");

	const eSignTemplateIds = watch("eSignTemplates");

	const onTemplatesSave = (selectedIds: string[]) => {
		setValue("eSignTemplates", selectedIds);
	};

	useEffect(() => {
		if (applicantData) {
			const config = customerBusinessConfigsData?.data?.[0]?.config;
			reset({
				...getValues(),
				firstName: applicantData?.data?.[0]?.first_name,
				lastName: applicantData?.data?.[0]?.last_name,
				email: applicantData?.data?.[0]?.email,
				mobile: applicantData?.data?.[0]?.mobile,
				skipCreditCheck: config?.skip_credit_check ?? false,
				bypassSSN: config?.bypass_ssn ?? false,
			});
		}
	}, [applicantData, businessId, customerBusinessConfigsData]);

	useEffect(() => {
		if (businessesData) {
			const vals = businessesData?.data?.records?.map((record: any) => {
				return {
					business_id: record?.id,
					name: record?.name,
					label: record?.name,
					value: record?.id,
				};
			});
			setOptions(vals);
		}
	}, [businessesData]);

	return (
		<div>
			{isInitialLoading ||
			areConditionalFieldsLoading ||
			areCustomerBusinessConfigsLoading ? (
				<FullPageLoader />
			) : null}
			<div className="pb-6">
				<PageTitle titleText="Send Invitation" />
				<div className="pt-10">
					<div className="text-sm font-semibold text-black font-Inter">
						Business details
					</div>
				</div>
				<div className="grid grid-cols-1 mt-5 gap-x-6 gap-y-8 sm:grid-cols-6">
					<div className="sm:col-span-3">
						<div className="mt-2">
							<CustomCreatableSelect
								label="Business name"
								isAstrik={true}
								isLoading={businessesLoading}
								control={control}
								options={options}
								name="companyName"
								error={errors.companyName?.message as string}
								defaultValue={{
									business_id: "",
									label: "",
									value: "",
									name: "",
									skipCreditCheck: false,
									bypassSSN: false,
								}}
								onChange={(value) => {
									if (value?.business_id) {
										setBusinessId((prev) => value?.business_id);
									} else if (value === null) {
										reset({
											firstName: "",
											lastName: "",
											mobile: "",
											email: "",
											skipCreditCheck: false,
											bypassSSN: false,
										});
										setBusinessId("");
									} else {
										setNewBusinessName(value?.value);
									}
								}}
							/>
						</div>
					</div>

					<div className="sm:col-span-3">
						<div className="mt-2">
							<PhoneNumberInput
								name="companyMobile"
								label="Business contact number (optional)"
								labelClassName="mb-2"
								placeholder="Enter mobile number"
								value={getValues().companyMobile as string}
								error={errors.companyMobile?.message as string}
								onChange={(val) => {
									setValue("companyMobile", val as string);
								}}
								control={control}
								className="w-full border border-gray-200 rounded-lg text-sm text-[#1F2937] py-2.5 px-4"
							/>
						</div>
					</div>
				</div>
				<div className="pt-10">
					<div className="text-sm font-semibold text-black font-Inter">
						Personal details
					</div>
				</div>
				<div className="grid grid-cols-1 mt-5 gap-x-6 gap-y-8 sm:grid-cols-6">
					<div className="sm:col-span-3">
						<div className="mt-2">
							<Input
								errors={errors}
								id="firstName"
								name="firstName"
								label="First name"
								isRequired
								placeholder="Enter first name"
								register={register}
								className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
							/>
						</div>
					</div>

					<div className="sm:col-span-3">
						<div className="mt-2">
							<Input
								errors={errors}
								id="lastName"
								name="lastName"
								label="Last name"
								isRequired
								placeholder="Enter last name"
								register={register}
								className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
							/>
						</div>
					</div>

					<div className="sm:col-span-3">
						<div className="mt-2">
							<Input
								errors={errors}
								id="email"
								name="email"
								placeholder="Enter email address"
								register={register}
								label="Email address"
								isRequired
								className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
							/>
						</div>
					</div>

					<div className="sm:col-span-3">
						<div className="mt-2">
							<PhoneNumberInput
								name="mobile"
								label="Mobile number (optional)"
								labelClassName="mb-2"
								placeholder="Enter mobile number"
								value={getValues().mobile as string}
								error={errors?.mobile?.message as string}
								onChange={(val) => {
									setValue("mobile", val as string);
								}}
								control={control}
								className="w-full border border-gray-200 rounded-lg text-sm text-[#1F2937] py-2.5 px-4"
							/>
						</div>
					</div>
				</div>
				{eSignEnabled && (
					<div className="mt-5">
						<div className="flex flex-row items-center justify-start gap-1 mb-3 text-sm font-semibold text-black font-Inter">
							Documents
							<ReactCustomTooltip
								id={`documents-tooltip`}
								tooltip={
									<>
										{
											"Applicants will be required to eSign the selected document(s) before submitting their application."
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
								<InfoIcon height={16} />
							</ReactCustomTooltip>
						</div>
						<ESignWrapper
							ref={eSignRef}
							onTemplatesSave={onTemplatesSave}
							selectedTemplateIds={eSignTemplateIds ?? []}
						/>
					</div>
				)}
				{equifaxEnabled && (
					<div className="grid grid-cols-1 mt-5 gap-x-6 gap-y-8 sm:grid-cols-6">
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
					<div className="grid grid-cols-1 mt-5 gap-x-6 gap-y-8 sm:grid-cols-6">
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
		</div>
	);
};

export default SendInviteForm;
