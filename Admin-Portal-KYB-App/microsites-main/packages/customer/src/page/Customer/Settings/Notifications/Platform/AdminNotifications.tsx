import React from "react";
import { useParams } from "react-router";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import Notifications from "../Notifications";

import { PLATFORM } from "@/constants/Platform";
import { ToastProvider } from "@/providers/ToastProvider";

const AdminNotifications: React.FC = () => {
	const { slug } = useParams<{ slug?: string }>();
	return (
		<CustomerWrapper>
			<ToastProvider />
			<Notifications customerId={slug ?? ""} platform={PLATFORM.admin} />
		</CustomerWrapper>
	);
};

export default AdminNotifications;
