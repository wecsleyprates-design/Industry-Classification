import React, { useEffect } from "react";
import { useCustomToast } from "@/hooks";
import {
	usePatchCustomerUserQuery,
	useResendUserInviteQuery,
} from "@/services/queries/user.query";
import { type PatchCustomerUserRequest } from "@/types/PatchCustomerUser";
import { type User } from "@/types/User";
import ManageUser from "./ManageUser";

type UserDetailProps = {
	user: User | null | undefined;
	isLoading?: boolean;
	backNavigateTo?: string;
	refetch: () => void;
	customerId: string;
	userId: string;
	platformType: "customer" | "admin";
};

export const UserDetail: React.FC<UserDetailProps> = ({
	user,
	customerId,
	userId,
	refetch,
	platformType,
}) => {
	const { errorToast, successToast } = useCustomToast();

	const { mutateAsync: patchCustomerUser, error: patchCustomerUserError } =
		usePatchCustomerUserQuery();

	const { mutateAsync: resendUserInvite, error: resendUserInviteError } =
		useResendUserInviteQuery();

	useEffect(() => {
		if (patchCustomerUserError) {
			errorToast(patchCustomerUserError);
		}
	}, [patchCustomerUserError, errorToast]);

	useEffect(() => {
		if (resendUserInviteError) {
			errorToast(resendUserInviteError);
		}
	}, [resendUserInviteError, errorToast]);

	const handleResendUserInvite = async () => {
		await resendUserInvite({
			customerId: customerId ?? "",
			userId: userId ?? "",
		});
		successToast("User invite resent successfully");
	};

	const handleSubmit = async (data?: PatchCustomerUserRequest) => {
		if (!data) return;

		await patchCustomerUser({
			customerId: customerId ?? "",
			userId: userId ?? "",
			body: data,
		});
		refetch();
	};

	return (
		<ManageUser
			type="edit"
			user={user}
			handleSubmitCallback={handleSubmit}
			handleResendUserInvite={handleResendUserInvite}
			platformType={platformType}
			customerId={customerId}
		/>
	);
};

export default UserDetail;
