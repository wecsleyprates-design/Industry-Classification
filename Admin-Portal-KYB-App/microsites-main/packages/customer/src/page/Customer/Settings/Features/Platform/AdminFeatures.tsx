import React from "react";
import { useParams } from "react-router";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import Features from "../Features";

import { FeaturesConstants } from "@/constants/FeaturesConstansts";
import { PLATFORM } from "@/constants/Platform";
import { ToastProvider } from "@/providers/ToastProvider";

interface AdminFeaturesProps {
	customerType?: "SANDBOX" | "PRODUCTION";
}

const AdminFeatures: React.FC<AdminFeaturesProps> = ({ customerType }) => {
	const { slug } = useParams<{ slug?: string }>();
	return (
		<CustomerWrapper>
			<ToastProvider />
			<Features
				customerId={slug ?? ""}
				isDisabled={false}
				title={FeaturesConstants.admin.title}
				description={FeaturesConstants.admin.description}
				platform={PLATFORM.admin}
				customerType={customerType}
			/>
		</CustomerWrapper>
	);
};

export default AdminFeatures;
