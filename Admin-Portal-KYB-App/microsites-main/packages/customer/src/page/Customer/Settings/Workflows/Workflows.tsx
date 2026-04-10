import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useURLParams } from "@/hooks/useURLParams";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import { getItem } from "@/lib/localStorage";
import WorkflowWizard from "./Wizard/WorkflowWizard";
import WorkflowsDashboard from "./WorkflowsDashboard";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { PLATFORM, type PlatformType } from "@/constants/Platform";

interface WorkflowsProps {
	platform?: PlatformType;
}

const Workflows: React.FC<WorkflowsProps> = ({ platform: propPlatform }) => {
	const { slug } = useParams<{ slug?: string }>();
	const platform = propPlatform ?? (slug ? PLATFORM.admin : PLATFORM.customer);
	const { searchParams, updateParams } = useURLParams();
	const customerId = slug ?? getItem<string>(LOCALSTORAGE.customerId) ?? "";
	const { canWrite } = useWorkflowPermissions();

	const mode = searchParams.get("mode");
	const isEditMode = mode === "edit";
	const isCreateMode = mode === "create";
	const isViewMode = mode === "view";
	const shouldShowWizard =
		isEditMode || isViewMode || (isCreateMode && canWrite);

	useEffect(() => {
		if (isCreateMode && !canWrite) {
			updateParams({ mode: null });
		}
	}, [isCreateMode, canWrite, updateParams]);

	const content = shouldShowWizard ? (
		<WorkflowWizard />
	) : (
		<WorkflowsDashboard customerId={customerId} platform={platform} />
	);

	return <CustomerWrapper>{content}</CustomerWrapper>;
};

export default Workflows;
