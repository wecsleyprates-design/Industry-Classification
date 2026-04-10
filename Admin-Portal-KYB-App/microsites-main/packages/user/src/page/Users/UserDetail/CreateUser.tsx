import React, { useEffect } from "react";
import { useCustomToast } from "@/hooks";
import { usePostCustomerUserQuery } from "@/services/queries/user.query";
import { type PatchCustomerUserRequest } from "@/types/PatchCustomerUser";
import ManageUser from "./ManageUser";

const CreateUser: React.FC<{
	customerId: string;
	platformType?: "customer" | "admin";
}> = ({ customerId, platformType }) => {
	const { errorToast } = useCustomToast();
	const { mutateAsync: createUser, error: createUserError } =
		usePostCustomerUserQuery();
	const handleSubmit = async (data?: PatchCustomerUserRequest) => {
		if (!data) return;
		await createUser({
			customerId: customerId ?? "",
			body: data,
		});
	};

	useEffect(() => {
		if (createUserError) {
			errorToast(createUserError);
		}
	}, [createUserError, errorToast]);

	return (
		<ManageUser
			type="create"
			user={undefined}
			handleSubmitCallback={handleSubmit}
			platformType={platformType}
			customerId={customerId}
		/>
	);
};

export default CreateUser;
