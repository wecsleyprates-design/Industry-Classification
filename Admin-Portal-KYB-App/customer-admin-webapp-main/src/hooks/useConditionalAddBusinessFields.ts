import { useEffect, useState } from "react";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import {
	useGetCustomerOnboardingStages,
	useGetOnboardingSetup,
} from "@/services/queries/case.query";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

export const useConditionalAddBusinessFields = () => {
	const { errorHandler } = useCustomToast();
	const [customerId] = useState(getItem(LOCALSTORAGE?.customerId));
	const [equifaxEnabled, setEquifaxEnabled] = useState(false);
	const [ssnRequired, setSsnRequired] = useState(false);
	const [eSignEnabled, setESignEnabled] = useState(false);

	const {
		data: onboardingSetupData,
		isLoading: onboardingSetupLoading,
		error: onboardingSetupError,
	} = useGetOnboardingSetup(customerId ?? "");

	const isModifyPagesFeatureEnabled = onboardingSetupData?.data.find(
		(item) => item.code === "modify_pages_fields_setup",
	)?.is_enabled;

	const {
		data: onboardingStagesData,
		isInitialLoading: onboardingStagesLoading,
		error: onboardingStagesError,
	} = useGetCustomerOnboardingStages(
		customerId ?? "",
		!!isModifyPagesFeatureEnabled, // This should control whether the hook fetches data
		{
			setupType: "modify_pages_fields_setup",
		},
	);

	const areFieldsLoading = onboardingSetupLoading || onboardingStagesLoading;

	useEffect(() => {
		if (onboardingSetupData) {
			setEquifaxEnabled(
				Boolean(
					onboardingSetupData?.data?.find(
						(element) => element.code === "equifax_credit_score_setup",
					)?.is_enabled,
				),
			);
		}
	}, [onboardingSetupData]);

	useEffect(() => {
		if (onboardingStagesData) {
			const stage = onboardingStagesData.data?.find(
				(stage) => stage.stage_code === "ownership",
			);
			const fieldData =
				stage?.config?.fields?.find((field) => {
					return field?.name === "Social Security Number";
				}) ?? null;
			if (fieldData) {
				if (
					fieldData?.status === "Always Required" ||
					fieldData?.status === "Required"
				) {
					setSsnRequired(true);
				} else {
					setSsnRequired(false);
				}
			}

			// Check if eSign Enabled
			const esignStage = onboardingStagesData.data?.find(
				(stage) => stage.stage_code === "review",
			);
			const eSignfieldData =
				esignStage?.config?.fields?.find((field) => {
					return field?.name === "eSign Documents";
				}) ?? null;
			if (eSignfieldData && eSignfieldData.status === true) {
				setESignEnabled(true);
			} else {
				setESignEnabled(false);
			}
		}
	}, [onboardingStagesData]);

	useEffect(() => {
		if (onboardingStagesError) {
			setSsnRequired(true);
		}
	}, [onboardingStagesError]);

	useEffect(() => {
		if (onboardingSetupError) errorHandler(onboardingSetupError);
	}, [onboardingSetupError]);

	return {
		equifaxEnabled: equifaxEnabled,
		ssnRequired: ssnRequired,
		eSignEnabled: eSignEnabled,
		isLoading: areFieldsLoading,
	};
};
