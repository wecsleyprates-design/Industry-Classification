import React from "react";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import { getItem } from "@/lib/localStorage";
import Features from "../Features";

import { LOCALSTORAGE } from "@/constants";
import { FeaturesConstants } from "@/constants/FeaturesConstansts";
import { PLATFORM } from "@/constants/Platform";

const CustomerFeature = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const customerType = getItem(LOCALSTORAGE.customerType) ?? "";
	return (
		<CustomerWrapper>
			<Features
				customerId={customerId}
				isDisabled={true}
				title={FeaturesConstants.customer.title}
				description={FeaturesConstants.customer.description}
				platform={PLATFORM.customer}
				customerType={customerType as "SANDBOX" | "PRODUCTION"}
			/>
		</CustomerWrapper>
	);
};

export default CustomerFeature;
