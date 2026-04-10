import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { generatePath, Navigate, useNavigate, useParams } from "react-router";
import { yupResolver } from "@hookform/resolvers/yup";
// import { URL } from "constants/URL";
import Button from "@/components/Button";
import CommonSelect from "@/components/Dropdown/SelectMenu";
import { Input } from "@/components/Input";
import { PhoneNumberInput } from "@/components/PhoneInput";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import PageTitle from "@/components/Title";
import useCustomToast from "@/hooks/useCustomToast";
import { getSlugReplacedURL } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { editUserSchema } from "@/lib/validation";
import {
	useGetRolesQuery,
	useGetUserDetailsByIdQuery,
	useUpdateCustomerUserQuery,
} from "@/services/queries/user.query";
import useAuthStore from "@/store/useAuthStore";
import { type TOption } from "@/types/common";
import { type IUserForm, type IUserFormBoolean } from "@/types/users";

import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";

const EditUsers = () => {
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);
	const [customerId] = useState(getItem("customerId"));
	const backPressHandler = () => {
		navigate(-1);
	};
	const { successHandler, errorHandler, warningHandler } = useCustomToast();

	const {
		register,
		handleSubmit,
		setValue,
		getValues,
		control,
		formState: { errors, dirtyFields },
	} = useForm<IUserForm>({
		resolver: yupResolver(editUserSchema) as any,
	});

	const { slug: userId } = useParams<{ slug: string }>();

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

	// get user and bind data to inputs
	const {
		data: getUserData,
		error: getUserError,
		isLoading: getUserLoading,
	} = useGetUserDetailsByIdQuery(customerId ?? "", userId ?? "");

	useEffect(() => {
		if (getUserData) {
			if (getUserData?.data?.subrole?.code === "owner")
				navigate(getSlugReplacedURL(URL.USER_DETAILS, userId ?? ""), {
					replace: true,
				});
			else {
				const obj = getUserData?.data;
				setValue("firstName", obj.first_name);
				setValue("lastName", obj.last_name);
				setValue("email", obj.email);
				setValue("mobile", obj.mobile);
				const role = obj?.subrole;
				delete role?.role_id;
				setValue("subrole", role);
			}
		}
	}, [getUserData]);

	useEffect(() => {
		if (getUserError != null) {
			errorHandler(getUserError);
		}
	}, [getUserError]);

	/*****************************************************************************
																UPDATE USER DATA
	 ****************************************************************************/
	const {
		mutateAsync: updateUserAsync,
		data: updateUserData,
		error: updateUserError,
		isPending: updateUserLoading,
	} = useUpdateCustomerUserQuery();

	useEffect(() => {
		if (updateUserData?.status === "success") {
			successHandler({
				message: updateUserData.message,
			});
			const newUserId = updateUserData?.data?.user_id ?? userId; // in case of existing user
			navigate(
				generatePath(URL.USER_DETAILS, {
					slug: newUserId,
				}),
				{ replace: true },
			);
		}
	}, [updateUserData]);

	useEffect(() => {
		if (updateUserError) {
			if (updateUserError != null) {
				errorHandler(updateUserError);
			}
		}
	}, [updateUserError]);

	const onSubmit = async (data: IUserForm, editedFields: IUserFormBoolean) => {
		const isMobileChanged = data.mobile !== getUserData?.data?.mobile;
		const isRoleChanged =
			data.subrole?.code !== getUserData?.data?.subrole?.code;
		if (
			Object.keys(editedFields).length === 0 &&
			!isMobileChanged &&
			!isRoleChanged
		) {
			warningHandler({
				message:
					"You haven't updated any data. Please edit atleast one input before saving",
			});
		} else {
			const role = data?.subrole;
			delete role?.display_name;
			delete role?.description;
			await updateUserAsync({
				customerId: customerId ?? "",
				userId: userId ?? "",
				body: {
					...(editedFields.firstName && { first_name: data.firstName }),
					...(editedFields.lastName && { last_name: data.lastName }),
					...(editedFields.email && { email: data.email }),
					...(isMobileChanged && { mobile: data.mobile ?? "" }),
					...(isRoleChanged && { subrole: role }),
				},
			});
		}
	};

	const onSubmitHandler = async (data: IUserForm) => {
		await onSubmit(data, dirtyFields);
	};

	return (
		<>
			{getUserLoading || updateUserLoading ? (
				<FullPageLoader />
			) : permissions[MODULES.CUSTOMER_USER]?.write ? (
				<form onSubmit={handleSubmit(onSubmitHandler)}>
					<div className="pb-12 border-b border-gray-900/10">
						<PageTitle titleText={`Edit user (${userId ?? ""})`} />
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
										disabled={
											!(
												getUserData?.data?.status === "INVITED" ||
												getUserData?.data?.status === "INVITE_EXPIRED"
											)
										}
										label="Email address"
										isRequired
										className={`w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4 ${
											!(
												getUserData?.data?.status === "INVITED" ||
												getUserData?.data?.status === "INVITE_EXPIRED"
											)
												? "bg-gray-100"
												: ""
										}`}
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
										className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4"
									/>
								</div>
							</div>
							<div className="sm:col-span-3">
								<div className="mt-2">
									<CommonSelect
										label="Select role"
										options={roleOptions}
										placeholder="Select role..."
										value={getValues().subrole}
										isRequired={true}
										uniqueId="code"
										onChange={function (option: TOption): void {
											if (option.value) {
												setValue("subrole", option.value);
											}
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
							type="reset"
							onClick={backPressHandler}
							color="transparent"
						>
							<span className="text-sm font-medium text-slate-700">Cancel</span>
						</Button>
						<Button
							type="submit"
							className="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2"
						>
							Save
						</Button>
					</div>
				</form>
			) : (
				<Navigate to={URL.USERS} replace={true} />
			)}
		</>
	);
};

export default EditUsers;
