import React, { useState } from "react";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import { useGetCustomerIntegrationSettingsByCustomerId } from "@/services/queries/customer.query";
import EnhancementFeatures from "./EnhancementFeatures";
import StandardFeatures from "./StandardFeatures";

import { type PlatformType } from "@/constants/Platform";

interface Props {
	customerId: string;
	isDisabled?: boolean;
	title?: string;
	description?: string;
	platform: PlatformType;
	customerType?: "SANDBOX" | "PRODUCTION";
}

const Features: React.FC<Props> = ({
	customerId,
	isDisabled,
	title,
	description,
	platform,
	customerType = "PRODUCTION",
}) => {
	const [activeId, setActiveId] = useState<number>(0);

	const {
		data: customerIntegrationSettingsData,
		refetch: customerIntegrationSettingsRefetch,
		isLoading: customerIntegrationSettingsLoading,
	} = useGetCustomerIntegrationSettingsByCustomerId(customerId);

	const tabs = [
		{
			key: "standard",
			id: 0,
			name: "Standard",
			content: (
				<StandardFeatures
					customerId={customerId}
					isDisabled={isDisabled}
					title={title}
					description={description}
					platform={platform}
					customerType={customerType}
					settingsData={customerIntegrationSettingsData}
					isLoading={customerIntegrationSettingsLoading}
					refetch={async () => {
						await customerIntegrationSettingsRefetch();
					}}
				/>
			),
		},
		// TODO	Uncomment below to implement Customs tab
		// {
		// 	key: "custom",
		// 	id: 1,
		// 	name: "Custom",
		// 	content: <CustomFeatures customerId={customerId} />,
		// },
		...(platform === "admin"
			? [
					{
						key: "enhancements",
						id: 2,
						name: "Enhancements",
						content: <EnhancementFeatures customerId={customerId} />,
					},
				]
			: []),
	];

	return (
		<TabsWithButton
			tabs={tabs}
			activeId={activeId}
			onTabChange={(id: number): void => {
				setActiveId(id);
			}}
		/>
	);
};

export default Features;
