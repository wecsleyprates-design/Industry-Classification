import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { yupResolver } from "@hookform/resolvers/yup";
import { URL } from "constants/URL";
import Button from "@/components/Button";
import { TitleLeftDivider } from "@/components/Dividers";
import { Input } from "@/components/Input";
import { PhoneNumberInput } from "@/components/PhoneInput";
import PageTitle from "@/components/Title";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { createCaseSchema } from "@/lib/validation";
import { useCreateBusinessQuery } from "@/services/queries/case.query";
import useAuthStore from "@/store/useAuthStore";
import { type ICaseForm } from "@/types/case";

import { MODULES } from "@/constants/Modules";

const AddACase = () => {
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);
	const { successHandler, errorHandler } = useCustomToast();
	const [customerId] = useState(getItem("customerId"));
	const backPressHandler = () => {
		navigate(-1);
	};

	const {
		register,
		handleSubmit,
		setValue,
		getValues,
		control,
		formState: { errors },
	} = useForm<ICaseForm>({
		resolver: yupResolver(createCaseSchema) as any,
	});

	// create case

	const {
		mutateAsync: createBusiness,
		data: createBusinessData,
		error: createBusinessError,
		isPending: createBusinessLoading,
	} = useCreateBusinessQuery();

	useEffect(() => {
		if (createBusinessData) {
			successHandler({
				message: createBusinessData.message,
			});
			navigate(URL.CASE);
		}
	}, [createBusinessData]);

	useEffect(() => {
		if (createBusinessError) {
			errorHandler(createBusinessError);
		}
	}, [createBusinessError]);

	const onSubmit = async (data: ICaseForm) => {
		void createBusiness({
			body: {
				customer_id: customerId ?? "",
				first_name: data.firstName,
				last_name: data.lastName,
				email: data.email,
				business_name: data.companyName,
				...(data?.mobile && data.mobile?.length && { mobile: data.mobile }),
				...(data?.companyMobile &&
					data?.companyMobile?.length && {
						business_mobile: data.companyMobile,
					}),
			},
		});
	};

	return (
		<>
			{permissions[MODULES.CASES]?.create ? (
				<form onSubmit={handleSubmit(onSubmit)}>
					<div className="pb-12 border-b border-gray-900/10">
						<PageTitle titleText="Add new case" />
						<div className="pt-10">
							<TitleLeftDivider text="Personal details" />
						</div>
						<div className="grid grid-cols-1 mt-10 gap-x-6 gap-y-8 sm:grid-cols-6">
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
										control={control}
										label="Mobile number (Optional)"
										placeholder="Enter mobile number"
										value={getValues().mobile as string}
										error={errors.mobile?.message as string}
										onChange={(val) => {
											setValue("mobile", val as string);
										}}
									/>
								</div>
							</div>
						</div>
						<div className="pt-10">
							<TitleLeftDivider text="Business details"></TitleLeftDivider>
						</div>
						<div className="grid grid-cols-1 mt-10 gap-x-6 gap-y-8 sm:grid-cols-6">
							<div className="sm:col-span-3">
								<div className="mt-2">
									<Input
										errors={errors}
										id="companyName"
										name="companyName"
										label="Business name"
										isRequired
										placeholder="Enter first name"
										register={register}
										className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
									/>
								</div>
							</div>

							<div className="sm:col-span-3">
								<div className="mt-2">
									<PhoneNumberInput
										name="companyMobile"
										control={control}
										label="Business contact number (optional)"
										placeholder="Enter mobile number"
										value={getValues().companyMobile as string}
										error={errors.companyMobile?.message as string}
										onChange={(val) => {
											setValue("companyMobile", val as string);
										}}
									/>
								</div>
							</div>
						</div>
					</div>
					<div className="flex items-center justify-end mt-6 gap-x-6">
						<Button
							className="z-0 px-2 border-0 shadow-none"
							outline={true}
							onClick={backPressHandler}
							color="transparent"
						>
							<span className="text-sm font-medium text-slate-700">Cancel</span>
						</Button>
						<Button
							type="submit"
							isLoading={createBusinessLoading}
							className="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
						>
							Create
						</Button>
					</div>
				</form>
			) : (
				<Navigate to={URL.CASE} />
			)}
		</>
	);
};

export default AddACase;
