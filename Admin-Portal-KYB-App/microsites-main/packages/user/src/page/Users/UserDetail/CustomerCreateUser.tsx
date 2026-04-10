import React from "react";
import { UserWrapper } from "@/layouts/UserWrapper";
import { getItem } from "@/lib/localStorage";
import CreateUser from "./CreateUser";

import { LOCALSTORAGE } from "@/constants";
import { ToastProvider } from "@/providers/ToastProvider";

const CustomerCreateUser = () => {
	const customerId: string = getItem<string>(LOCALSTORAGE.customerId) ?? "";
	return (
		<UserWrapper>
			<ToastProvider />
			<CreateUser customerId={customerId} platformType="customer" />
		</UserWrapper>
	);
};

export default CustomerCreateUser;
