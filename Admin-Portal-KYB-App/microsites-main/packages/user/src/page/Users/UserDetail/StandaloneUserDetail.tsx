import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useGetUser } from "@/services/queries/user.query";
import { UserDetail } from "./UserDetail";

import { URL } from "@/constants";

export const StandaloneUserDetail: React.FC = () => {
	const { id: userId = "" } = useParams();
	const { data, error, isLoading, refetch } = useGetUser(userId);

	const navigate = useNavigate();

	useEffect(() => {
		if (error) {
			toast.error("Error fetching user data");
			navigate(URL.STANDALONE_USERS);
		}
	}, [error]);

	return (
		<UserDetail
			platformType="admin"
			user={data ?? null}
			customerId={""}
			userId={userId ?? ""}
			backNavigateTo={URL.STANDALONE_USERS}
			isLoading={isLoading}
			refetch={refetch}
		/>
	);
};

export default StandaloneUserDetail;
