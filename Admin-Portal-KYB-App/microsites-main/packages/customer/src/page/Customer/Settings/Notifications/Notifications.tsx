import React, { useEffect, useState } from "react";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import { useCustomToast } from "@/hooks";
import {
	useGetEmailConfig,
	useUpdateEmailConfig,
} from "@/services/queries/notification.query";
import ApplicationNotifications from "./ApplicationNotifications";
import MyNotifications from "./MyNotifications";

import { type PlatformType } from "@/constants/Platform";

interface NotificationsProps {
	customerId: string;
	platform: PlatformType;
}

const Notifications: React.FC<NotificationsProps> = ({
	customerId,
	platform,
}) => {
	const setTab = platform === "customer" ? 0 : 1;
	const [activeId, setActiveId] = useState<number>(setTab);
	const { errorToast } = useCustomToast();

	const {
		data: emailConfigData,
		isLoading: emailConfigLoading,
		error: emailConfigError,
		refetch: refetchEmailConfig,
		isRefetching: refetchingEmailConfig,
	} = useGetEmailConfig(customerId);

	const {
		data: updateEmailConfigData,
		error: updateEmailConfigError,
		mutateAsync: updateEmailConfig,
	} = useUpdateEmailConfig();

	useEffect(() => {
		if (emailConfigError) errorToast(emailConfigError);
	}, [emailConfigError]);

	useEffect(() => {
		if (updateEmailConfigError) errorToast(updateEmailConfigError);
	}, [updateEmailConfigError]);

	useEffect(() => {
		if (updateEmailConfigData) void refetchEmailConfig();
	}, [updateEmailConfigData]);

	const toggleChecked = async (
		index: number,
		modules: Array<{
			icon: React.ReactElement;
			title: string;
			description: string;
			key: string;
			isChecked: boolean;
		}>,
	) => {
		const newModules = [...modules];
		newModules[index] = {
			...newModules[index],
			isChecked: !newModules[index].isChecked,
		};
		const configValues = newModules.map((item) => ({
			customer_id: customerId,
			notification_code: item.key,
			is_enabled: item.isChecked,
		}));
		await updateEmailConfig({ configs: configValues });
		return newModules;
	};

	const tabs = [
		...(platform === "customer"
			? [
					{
						key: "my-notifications",
						id: 0,
						name: "My Notifications",
						content: (
							<MyNotifications
								loading={emailConfigLoading && refetchingEmailConfig}
								emailConfigData={emailConfigData}
								toggleChecked={toggleChecked}
							/>
						),
					},
				]
			: []),
		{
			key: "applicant-notifications",
			id: 1,
			name: "Applicant Notifications",
			content: (
				<ApplicationNotifications
					loading={emailConfigLoading && refetchingEmailConfig}
					emailConfigData={emailConfigData}
					toggleChecked={toggleChecked}
				/>
			),
		},
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

export default Notifications;
