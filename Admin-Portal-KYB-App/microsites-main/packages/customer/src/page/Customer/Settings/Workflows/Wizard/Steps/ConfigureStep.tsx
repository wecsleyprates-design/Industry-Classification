import React, { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useParams } from "react-router-dom";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { getItem } from "@/lib/localStorage";
import { useGetAttributesCatalog } from "@/services/queries/workflows.query";
import {
	GET_ATTRIBUTES_CATALOG_FOR_RULE_BUILDER,
	type WorkflowWizardForm,
} from "@/types/workflows";
import { RuleBuilder } from "../components/RuleBuilder";
import type { RuleValidationError } from "../components/RuleBuilder/types";
import { WizardStepFooter } from "../components/WizardStepFooter";
import { WizardStepHeader } from "../components/WizardStepHeader";
import StepLayout from "../StepLayout";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface ConfigureStepProps {
	form: UseFormReturn<WorkflowWizardForm>;
	onBack: () => void;
	onNext: () => void;
	onSaveDraft: () => void;
	isSavingDraft: boolean;
	showValidationErrors: boolean;
	validationErrors: RuleValidationError[];
	onValidate: () => boolean;
	isEditMode?: boolean;
	isLoadingWorkflow?: boolean;
}

const ConfigureStep: React.FC<ConfigureStepProps> = ({
	form,
	onBack,
	onNext,
	onSaveDraft,
	isSavingDraft,
	showValidationErrors,
	validationErrors,
	onValidate,
	isEditMode = false,
	isLoadingWorkflow = false,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const { slug } = useParams<{ slug?: string }>();
	const customerId = slug ?? getItem<string>(LOCALSTORAGE.customerId) ?? "";
	const isValidCustomerId = customerId.trim().length > 0;
	const {
		data: catalogResponse,
		isLoading: isLoadingCatalog,
		isError,
	} = useGetAttributesCatalog(
		isValidCustomerId ? customerId : undefined,
		true,
		GET_ATTRIBUTES_CATALOG_FOR_RULE_BUILDER,
	);

	const catalog = catalogResponse?.data ?? {};

	const handleNext = useCallback(() => {
		const isValid = onValidate();
		if (isValid) {
			onNext();
		}
	}, [onValidate, onNext]);

	const handleSaveDraft = useCallback(() => {
		const isValid = onValidate();
		if (isValid) {
			onSaveDraft();
		}
	}, [onValidate, onSaveDraft]);

	if (isError) {
		return (
			<StepLayout>
				<WizardStepHeader
					title="Configure Rules"
					description="Build your workflow using conditions."
				/>
				<div className="flex flex-col items-center justify-center py-12 text-center">
					<p className="text-red-600 font-medium mb-2">
						Failed to load attributes catalog
					</p>
					<p className="text-gray-500 text-sm">
						Please try again later or contact support if the problem persists.
					</p>
				</div>
			</StepLayout>
		);
	}

	return (
		<StepLayout>
			<WizardStepHeader
				title="Configure Rules"
				description="Build your workflow using conditions. Use AND to connect must-pass gates, and OR for acceptable alternatives within a group."
			/>

			<div className="mb-6">
				<RuleBuilder
					form={form}
					catalog={catalog}
					isLoading={isLoadingCatalog}
					showValidationErrors={showValidationErrors}
					validationErrors={validationErrors}
				/>
			</div>

			<WizardStepFooter
				title={
					isReadOnly
						? "Viewing rule configuration."
						: "Ready to Preview and Publish?"
				}
				description={
					isReadOnly
						? "Navigate to preview to see the complete workflow."
						: "Your configuration has been saved. Next, you'll review all details before publishing"
				}
				onBack={onBack}
				backLabel="Back"
				primaryActionLabel="Continue to preview"
				onPrimaryAction={handleNext}
				showSaveDraft={true}
				onSaveDraft={handleSaveDraft}
				isSavingDraft={isSavingDraft}
				disableSaveDraft={isReadOnly}
			/>
		</StepLayout>
	);
};

export default ConfigureStep;
