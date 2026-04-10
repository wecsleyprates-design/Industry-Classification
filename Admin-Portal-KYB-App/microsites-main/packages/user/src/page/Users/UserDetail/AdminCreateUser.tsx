import React from "react";
import { useParams } from "react-router";
import { UserWrapper } from "@/layouts/UserWrapper";
import CreateUser from "./CreateUser";

import { ToastProvider } from "@/providers/ToastProvider";

const AdminCreateUser = () => {
	const { slug: customerId } = useParams();
	return (
		<UserWrapper>
			<ToastProvider />
			<CreateUser customerId={customerId ?? ""} platformType="admin" />
		</UserWrapper>
	);
};

export default AdminCreateUser;
