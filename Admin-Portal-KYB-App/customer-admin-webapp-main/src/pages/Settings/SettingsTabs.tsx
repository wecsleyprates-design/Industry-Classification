import React, { Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useFlags } from "launchdarkly-react-client-sdk";
import SkeletonLoader from "@/components/Loader/SkeletonLoader";
import QueryProviderWrapper from "@/components/MFE/QueryProviderWrapper";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import { TabWithUiComponent } from "@/components/Tabs";
import useCustomToast from "@/hooks/useCustomToast";
import { getRemoteComponent } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { useGetCustomerById } from "@/services/queries/customer.query";
import FeatureSetting from "./Feature/FeatureSetting";
import AdvancedSettings from "./Advancing";
import DesignAndBranding from "./DesignAndBranding";
import GeneralSettings from "./GeneralSettings";
import IntegrationsSettings from "./Integrations";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

const CustomerRiskMonitoringScoring = React.lazy(async () => {
	const module = await getRemoteComponent(
		"customer",
		"CustomerRiskMonitoringScoring",
	);
	return { default: module.default };
}) as React.ComponentType;

const Notifications = React.lazy(async () => {
	const module = await getRemoteComponent("customer", "CustomerNotifications");
	return { default: module.default };
}) as React.ComponentType;

// Centralized tab ID constants to avoid magic numbers (review feedback)
const TAB_IDS = {
	GENERAL: 1,
	BRANDING: 2, // dynamically injected based on white_label_onboarding
	FEATURES: 3,
	SCORING: 4,
	NOTIFICATIONS: 5,
	ADVANCED: 6,
	INTEGRATIONS: 7,
};

const initialTabs = [
	{
		id: TAB_IDS.GENERAL,
		name: "General",
		content: (
			<div className="mt-8">
				<GeneralSettings />
			</div>
		),
	},
	{
		id: TAB_IDS.FEATURES,
		name: "Features",
		content: (
			<div>
				<FeatureSetting />
			</div>
		),
	},
	{
		id: TAB_IDS.SCORING,
		name: "Scoring & Alerts",
		content: (
			<div>
				<CustomerRiskMonitoringScoring />
			</div>
		),
	},
	{
		id: TAB_IDS.NOTIFICATIONS,
		name: "Notifications",
		content: (
			<Suspense
				fallback={
					<SkeletonLoader loading={true} className="w-full h-20 rounded-lg" />
				}
			>
				<QueryProviderWrapper>
					<Notifications />
				</QueryProviderWrapper>
			</Suspense>
		),
	},
	{
		id: TAB_IDS.ADVANCED,
		name: "Advanced",
		content: (
			<div>
				<AdvancedSettings />
			</div>
		),
	},
	{
		id: TAB_IDS.INTEGRATIONS,
		name: "Integrations",
		content: (
			<div>
				<IntegrationsSettings />
			</div>
		),
	},
];

const SettingsTabs = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<number>(TAB_IDS.GENERAL);
	const [tabs, setTabs] = useState(initialTabs);
	const [tabAdded, setTabAdded] = useState<boolean>(false);
	const { errorHandler } = useCustomToast();
	const flags = useFlags();
	const showUpdatedUI = flags[FEATURE_FLAGES.PAT_805_CUSTOMER_MICROSITE];

	const location = useLocation();

	const handleChangeTab = (val: number) => {
		setActiveTab(val);
		switch (val) {
			case TAB_IDS.GENERAL:
				navigate(URL.GENERAL_SETTINGS);
				break;
			case TAB_IDS.BRANDING:
				navigate(URL.BRANDING_SETTINGS);
				break;
			case TAB_IDS.NOTIFICATIONS:
				navigate(URL.NOFITICATIONS_SETTINGS);
				break;
			case TAB_IDS.SCORING:
				navigate(URL.SCORING_SETTING);
				break;
			case TAB_IDS.ADVANCED:
				navigate(URL.ADVANCED_SETTINGS);
				break;
			case TAB_IDS.INTEGRATIONS:
				navigate(URL.INTEGRATIONS_SETTINGS);
				break;
			case TAB_IDS.FEATURES:
				navigate(URL.FEATURE_SETTINGS);
				break;
			default:
				navigate(URL.GENERAL_SETTINGS);
				break;
		}
	};

	const {
		data: customerApiData,
		error: customerError,
		isLoading: customerDataLoading,
	} = useGetCustomerById(customerId ?? "");

	useEffect(() => {
		let newTabs = [...tabs];

		if (!showUpdatedUI) {
			newTabs = newTabs.filter((tab) => tab.id !== TAB_IDS.SCORING);
			setTabs(newTabs);
		}

		if (
			showUpdatedUI &&
			customerApiData?.data?.settings?.white_label_onboarding &&
			!tabAdded
		) {
			newTabs.splice(1, 0, {
				id: TAB_IDS.BRANDING,
				name: "Design & Branding",
				content: (
					<div>
						<DesignAndBranding />
					</div>
				),
			});
			setTabs(newTabs);
			setTabAdded(true);
		}

		const scoringTabIndex = newTabs.findIndex(
			(tab) => tab.id === TAB_IDS.SCORING,
		);
		if (scoringTabIndex !== -1) {
			newTabs[scoringTabIndex] = {
				...newTabs[scoringTabIndex],
				content: (
					<Suspense
						fallback={
							<SkeletonLoader
								loading={true}
								className="w-full h-20 rounded-lg"
							/>
						}
					>
						<div>
							<CustomerRiskMonitoringScoring />
						</div>
					</Suspense>
				),
			};
		}
		setTabs(newTabs);
	}, [customerApiData, showUpdatedUI]);

	useEffect(() => {
		if (customerError) errorHandler(customerError);
	}, [customerError]);

	useEffect(() => {
		setActiveTab(TAB_IDS.BRANDING);
	}, []);

	useEffect(() => {
		if (location.pathname) {
			const moduleName = location.pathname.split("/").slice(-1)[0];
			const search = location.search;
			switch (moduleName) {
				case "general":
					setActiveTab(TAB_IDS.GENERAL);
					navigate(`${URL.GENERAL_SETTINGS}${search}`);
					break;
				case "branding":
					setActiveTab(TAB_IDS.BRANDING);
					navigate(`${URL.BRANDING_SETTINGS}${search}`);
					break;
				case "notifications":
					setActiveTab(TAB_IDS.NOTIFICATIONS);
					navigate(`${URL.NOFITICATIONS_SETTINGS}${search}`);
					break;
				case "scoring":
					setActiveTab(TAB_IDS.SCORING);
					navigate(`${URL.SCORING_SETTING}${search}`);
					break;
				case "advanced":
					setActiveTab(TAB_IDS.ADVANCED);
					navigate(`${URL.ADVANCED_SETTINGS}${search}`);
					break;
				case "integrations":
					setActiveTab(TAB_IDS.INTEGRATIONS);
					navigate(`${URL.INTEGRATIONS_SETTINGS}${search}`);
					break;
				case "features":
					setActiveTab(TAB_IDS.FEATURES);
					navigate(`${URL.FEATURE_SETTINGS}${search}`);
					break;
				default:
					setActiveTab(TAB_IDS.GENERAL);
					navigate(`${URL.GENERAL_SETTINGS}${search}`);
					break;
			}
		}
	}, [location.pathname]);

	// console.log(activeTab, moduleName);

	return customerDataLoading ? (
		<FullPageLoader />
	) : (
		<div>
			<div className="bg-white px-8 pt-6 -mx-8 -mt-6">
				<h2 className="text-[#111827] text-lg font-semibold">Settings</h2>
			</div>

			<TabWithUiComponent
				tabs={tabs}
				activeId={activeTab}
				onTabChange={(val: number) => {
					handleChangeTab(val);
				}}
				headerContent={<></>}
				fullWidth
			/>
			{/* <p>setting tab</p> */}
		</div>
	);
};

export default SettingsTabs;
