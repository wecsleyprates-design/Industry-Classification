import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { UserWrapper } from "@/layouts/UserWrapper";
import { getItem } from "@/lib/localStorage";
import { useGetCustomerUser } from "@/services/queries/user.query";
import { UserDetail } from "./UserDetail";

import { URL } from "@/constants";
import { ToastProvider } from "@/providers/ToastProvider";

const CustomerUserDetail: React.FC<{ platformType?: "customer" | "admin" }> = ({
	platformType = "customer",
}) => {
	const { slug: routeCustomerId, id: userId = "" } = useParams<{
		slug: string;
		id: string;
	}>();
	const customerId = routeCustomerId ?? getItem<string>("customerId") ?? "";
	const { data, error, isLoading, refetch } = useGetCustomerUser(
		customerId,
		userId,
	);

	const navigate = useNavigate();

	useEffect(() => {
		if (error) {
			toast.error("Error fetching user data");
			navigate(URL.USERS);
		}
	}, [error]);

	return (
		<UserWrapper>
			<ToastProvider />
			<UserDetail
				user={data?.data}
				customerId={customerId}
				userId={userId}
				backNavigateTo={URL.USERS}
				isLoading={isLoading}
				refetch={refetch}
				platformType={platformType}
			/>
		</UserWrapper>
	);
};

export default CustomerUserDetail;
