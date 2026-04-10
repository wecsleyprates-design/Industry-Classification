import React, { useEffect } from "react";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import {
	useGetCoreBetaSettings,
	useUpdateCustomerBetaSettings,
} from "@/services/queries/customer.query";
import { type FeatureKeyType } from "@/types/customer";
import BetaOptInToggle from "./BetaOptInToggle";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { useBetaSettings } from "@/providers/BetaSettingsProvider";

interface BetaSetting {
	title: string;
	description: string;
	featureKey: FeatureKeyType;
	value: boolean;
	isVisible: boolean;
}
const BetaSettings = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { successHandler } = useCustomToast();
	const [settings, setSettings] = React.useState<BetaSetting[]>([
		{
			title: "Case Management 2.0",
			description: "Discover what’s new and improved",
			featureKey: "case_management_v2",
			value: false,
			isVisible: false,
		},
	]);

	const { data: coreBetaSettings } = useGetCoreBetaSettings();

	const {
		mutateAsync: updateCustomerSettings,
		data: updateCustomerSettingsData,
	} = useUpdateCustomerBetaSettings();

	const { data: customerBetaSettings, refetch: fetchBetaSettings } =
		useBetaSettings();

	useEffect(() => {
		if (customerBetaSettings) {
			const updatedSettings = settings.map((setting) => {
				const betaSetting = customerBetaSettings.data.find(
					(beta) => beta.feature === setting.featureKey,
				);
				const coreSetting = coreBetaSettings?.data.find(
					(core) => core.code === setting.featureKey,
				);
				return {
					...setting,
					value: betaSetting ? betaSetting.is_enabled : false,
					isVisible: coreSetting ? coreSetting.is_enabled : false,
				};
			});
			setSettings(updatedSettings);
		}
	}, [customerBetaSettings, coreBetaSettings]);

	const handleOnChange = async (featureKey: FeatureKeyType, value: boolean) => {
		await updateCustomerSettings({
			customerId,
			body: {
				feature: featureKey,
				is_enabled: value,
			},
		});
		setSettings((settings) => {
			return settings.map((setting) => {
				if (setting.featureKey === featureKey) {
					return { ...setting, value };
				}
				return setting;
			});
		});
	};

	useEffect(() => {
		if (updateCustomerSettingsData) {
			successHandler({
				message:
					updateCustomerSettingsData?.message ||
					"Settings updated successfully.",
			});
			void fetchBetaSettings();
		}
	}, [updateCustomerSettingsData]);

	return (
		<>
			{settings
				.filter((item) => item.isVisible)
				.map((setting) => (
					<BetaOptInToggle
						key={setting.featureKey}
						title={setting.title}
						description={setting.description}
						featureKey={setting.featureKey}
						value={setting.value}
						onChange={handleOnChange}
					/>
				))}
		</>
	);
};

export default BetaSettings;
