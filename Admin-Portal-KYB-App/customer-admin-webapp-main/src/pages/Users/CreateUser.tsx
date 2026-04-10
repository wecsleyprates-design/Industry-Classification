import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { yupResolver } from "@hookform/resolvers/yup";
import { URL } from "constants/URL";
import Button from "@/components/Button";
import CommonSelect from "@/components/Dropdown/SelectMenu";
import { Input } from "@/components/Input";
import { PhoneNumberInput } from "@/components/PhoneInput";
import PageTitle from "@/components/Title";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { createUserSchema } from "@/lib/validation";
import {
	useCreateCustomerUserQuery,
	useGetRolesQuery,
} from "@/services/queries/user.query";
import useAuthStore from "@/store/useAuthStore";
import { type TOption } from "@/types/common";
import { type IUserForm } from "@/types/users";

import { MODULES } from "@/constants/Modules";

const CreateUsers = () => {
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);
	const [customerId] = useState(getItem("customerId"));
	const backPressHandler = () => {
		navigate(-1);
	};
	const [loading, setLoading] = useState<boolean>(false);
	const { successHandler, errorHandler } = useCustomToast();

	const {
		register,
		handleSubmit,
		setValue,
		getValues,
		control,
		formState: { errors },
	} = useForm<IUserForm>({
		resolver: yupResolver(createUserSchema) as any,
	});
	const [roleOptions, setRoleOptions] = useState<TOption[] | []>([]);

	const { data: rolesData } = useGetRolesQuery(customerId ?? "");

	useEffect(() => {
		if (rolesData?.status === "success") {
			if (Array.isArray(rolesData?.data)) {
				const options = rolesData?.data?.reduce((acc: TOption[], item: any) => {
					acc.push({ label: item?.display_name, value: item });
					return acc;
				}, []);
				setRoleOptions(options);
			}
		}
	}, [rolesData]);

	const {
		mutateAsync: createUser,
		data: createUserData,
		error: createUserError,
	} = useCreateCustomerUserQuery();

	useEffect(() => {
		if (createUserData) {
			setLoading(false);
			successHandler({
				message: createUserData.message,
			});
			navigate(URL.USERS);
		}
	}, [createUserData]);

	useEffect(() => {
		setLoading(false);
		if (createUserError != null) {
			errorHandler(createUserError);
		}
	}, [createUserError]);

	const onSubmit = async (data: IUserForm) => {
		setLoading(true);
		const role = data?.subrole;
		delete role?.display_name;
		delete role?.description;
		await createUser({
			customerId: customerId ?? "",
			body: {
				first_name: data.firstName,
				last_name: data.lastName,
				email: data.email,
				...(data?.mobile && data.mobile?.length && { mobile: data.mobile }),
				subrole: data?.subrole,
			},
		});
	};

	return (
		<>
			{permissions[MODULES.CUSTOMER_USER]?.create ? (
				<form onSubmit={handleSubmit(onSubmit)}>
					<div className="pb-12 border-b border-gray-900/10">
						<PageTitle titleText="Create new user" />

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
										labelClassName="mb-2"
										placeholder="Enter mobile number"
										value={getValues().mobile as string}
										error={errors.mobile?.message as string}
										onChange={(val) => {
											setValue("mobile", val as string);
										}}
										className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4"
									/>
								</div>
							</div>
							<div className="sm:col-span-3">
								{/* <label
								htmlFor="last-name"
								className="block text-sm font-medium leading-6 text-gray-900"
							>
								Select role<span style={{ color: "red" }}>*</span>
							</label> */}
								<div className="mt-2">
									<CommonSelect
										label="Select role"
										isRequired={true}
										options={roleOptions}
										uniqueId="code"
										placeholder="Select role..."
										value={getValues().subrole}
										onChange={function (option: TOption): void {
											if (option.value) {
												setValue("subrole", option.value);
											}
										}}
										error={errors?.subrole?.message as string}
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
							isLoading={loading}
							className="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
						>
							Create
						</Button>
					</div>
				</form>
			) : (
				<Navigate to={URL.USERS} />
			)}
		</>
	);
};

export default CreateUsers;
