import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import TabsWithButton from "@/components/Tabs/TabsWithButton";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import {
	useGetEmailConfig,
	useUpdateEmailConfig,
} from "@/services/queries/notification.query";
import ApplicationNotifications from "./ApplicationNotifications";
import MyNotifications from "./MyNotifications";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const Notifications = () => {
	const [searchParams, setSearchParams] = useSearchParams();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const [activeId, setActiveId] = useState<number>(0);

	const tab: "my-notifications" | "applicant-notifications" = searchParams.get(
		"tab",
	) as "my-notifications" | "applicant-notifications";

	// const [isModuleLoad, setIsModuleLoad] = useState(false); // commenting suspecting redundent variable
	const { errorHandler } = useCustomToast();

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
		if (emailConfigError) {
			errorHandler(emailConfigError);
		}
	}, [emailConfigError]);

	useEffect(() => {
		if (updateEmailConfigError) {
			errorHandler(updateEmailConfigError);
		}
	}, [updateEmailConfigError]);

	useEffect(() => {
		if (updateEmailConfigData) {
			void refetchEmailConfig();
		}
	}, [updateEmailConfigData]);

	const toggleChecked = async (
		index: number,
		modules: Array<{
			icon: React.JSX.Element;
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
		await updateEmailConfig({
			configs: configValues,
		});
		return newModules;
	};

	useEffect(() => {
		if (tab) {
			const activeTab = tabs.find((item) => item.key === tab)?.id ?? 0;
			setActiveId(activeTab);
			setSearchParams({ tab: tabs[activeTab].key });
		}
	}, [searchParams]);

	const tabs = [
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
				setSearchParams({ tab: tabs[id].key });
			}}
		/>
	);
};

export default Notifications;
