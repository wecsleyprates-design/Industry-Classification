import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { useCustomToast } from "@/hooks/useCustomToast";
import { useURLParams } from "@/hooks/useURLParams";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { CustomerWrapper } from "@/layouts/CustomerWrapper";
import { getItem } from "@/lib/localStorage";
import { WorkflowWizardFormSchema } from "@/lib/validation";
import {
	useCreateWorkflow,
	useGetAttributesCatalog,
	useGetWorkflow,
	useUpdateWorkflow,
} from "@/services/queries/workflows.query";
import {
	GET_ATTRIBUTES_CATALOG_FOR_RULE_BUILDER,
	type WorkflowWizardForm,
} from "@/types/workflows";
import type { RuleValidationError } from "./components/RuleBuilder/types";
import {
	transformPayloadToRules,
	transformRulesToPayload,
	validateRules,
} from "./components/RuleBuilder/utils";
import { WizardStepper } from "./components/WizardStepper";
import ConfigureStep from "./Steps/ConfigureStep";
import PreviewStep from "./Steps/PreviewStep";
import WorkflowStep from "./Steps/WorkflowStep";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

enum WizardStep {
	WORKFLOW = 0,
	CONFIGURE = 1,
	PREVIEW = 2,
}

interface LocationState {
	skipLoading: boolean;
}

const isLocationState = (state: unknown): state is LocationState =>
	state !== null && typeof state === "object" && "skipLoading" in state;

const WorkflowWizard: React.FC = () => {
	const { slug } = useParams<{ slug?: string }>();
	const { updateParams, searchParams } = useURLParams();
	const location = useLocation();
	const navigate = useNavigate();
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const skipLoading = isLocationState(location.state)
		? location.state.skipLoading
		: false;
	const customerId = slug ?? getItem<string>(LOCALSTORAGE.customerId) ?? "";
	const workflowId = searchParams.get("workflowId") ?? undefined;
	const isEditMode = !!workflowId;
	const [currentStep, setCurrentStep] = useState<WizardStep>(
		WizardStep.WORKFLOW,
	);
	const [populatedWorkflowId, setPopulatedWorkflowId] = useState<
		string | undefined
	>(undefined);

	const form = useForm<WorkflowWizardForm>({
		mode: "all",
		defaultValues: {
			name: "",
			description: "",
			trigger: "",
			rules: [],
			default_action: undefined,
		},
		resolver: yupResolver(WorkflowWizardFormSchema),
	});

	// Fetch workflow data when in edit mode
	const {
		data: workflowResponse,
		isLoading: isLoadingWorkflow,
		isError: isWorkflowError,
	} = useGetWorkflow(workflowId);

	const { data: catalogResponse, isLoading: isLoadingCatalog } =
		useGetAttributesCatalog(
			customerId,
			true,
			GET_ATTRIBUTES_CATALOG_FOR_RULE_BUILDER,
		);
	const catalog = catalogResponse?.data ?? {};

	const { mutateAsync: createWorkflow, isPending: isCreating } =
		useCreateWorkflow();
	const { mutateAsync: updateWorkflow, isPending: isUpdating } =
		useUpdateWorkflow();
	const { successToast, errorToast } = useCustomToast();
	const isSaving = isCreating || isUpdating;

	useEffect(() => {
		setPopulatedWorkflowId(undefined);
	}, [workflowId]);

	useEffect(() => {
		if (!skipLoading || !workflowId) return;

		setPopulatedWorkflowId(workflowId);
		navigate(location.pathname + location.search, {
			replace: true,
			state: null,
		});
	}, [skipLoading, workflowId, navigate, location.pathname, location.search]);

	useEffect(() => {
		if (
			skipLoading ||
			!isEditMode ||
			!workflowResponse?.data ||
			isLoadingCatalog ||
			populatedWorkflowId === workflowId
		) {
			return;
		}

		const workflowData = workflowResponse.data;
		const currentVersion = workflowData.current_version;
		const transformedRules = currentVersion.rules
			? transformPayloadToRules(currentVersion.rules, catalog)
			: [];

		form.reset({
			name: workflowData.name,
			description: workflowData.description ?? "",
			trigger: currentVersion.trigger_id,
			rules: transformedRules,
			default_action: currentVersion.default_action ?? undefined,
		});

		setPopulatedWorkflowId(workflowId);
	}, [
		isEditMode,
		workflowResponse,
		catalog,
		isLoadingCatalog,
		workflowId,
		populatedWorkflowId,
		form,
		skipLoading,
	]);

	// Handle workflow fetch error
	useEffect(() => {
		if (isWorkflowError) {
			errorToast("Workflow not found");
			updateParams({ mode: null, workflowId: null });
		}
	}, [isWorkflowError, errorToast, updateParams]);

	const [showRuleValidationErrors, setShowRuleValidationErrors] =
		useState(false);
	const [ruleValidationErrors, setRuleValidationErrors] = useState<
		RuleValidationError[]
	>([]);

	const validateWorkflowStep = async (): Promise<boolean> => {
		return await form.trigger(["name", "description", "trigger"]);
	};

	const validateConfigureStep = useCallback((): boolean => {
		const currentRules = form.getValues("rules");
		const errors = validateRules(currentRules);
		setRuleValidationErrors(errors);
		setShowRuleValidationErrors(true);
		return errors.length === 0;
	}, [form]);

	const handleNext = async () => {
		const isValid = await validateWorkflowStep();
		if (isValid && currentStep < WizardStep.PREVIEW) {
			setCurrentStep(currentStep + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > WizardStep.WORKFLOW) {
			setCurrentStep(currentStep - 1);
		}
	};

	const handleGoBack = () => {
		updateParams({ mode: null, workflowId: null });
	};

	const handleStepClick = async (stepId: number) => {
		if (stepId === currentStep) return;

		if (stepId < currentStep) {
			setCurrentStep(stepId);
			return;
		}

		if (currentStep === WizardStep.WORKFLOW) {
			const isWorkflowValid = await validateWorkflowStep();
			if (!isWorkflowValid) return;

			if (stepId === WizardStep.PREVIEW) {
				if (!validateConfigureStep()) {
					setCurrentStep(WizardStep.CONFIGURE);
					return;
				}
			}
		}

		if (currentStep === WizardStep.CONFIGURE && stepId === WizardStep.PREVIEW) {
			const isValid = validateConfigureStep();
			if (!isValid) return;
		}

		setCurrentStep(stepId);
	};

	const handleSaveDraft = async () => {
		const formValues = form.getValues();

		if (!formValues.name || formValues.name.trim() === "") {
			await validateWorkflowStep();
			return;
		}

		const transformedRules = transformRulesToPayload(formValues.rules);
		const hasRules = transformedRules.length > 0;
		const hasDefaultAction = !!formValues.default_action;

		const payload = {
			name: formValues.name,
			description: formValues.description,
			trigger_id: formValues.trigger,
			...(hasRules && { rules: transformedRules }),
			...(hasDefaultAction && {
				default_action: formValues.default_action,
			}),
		};

		try {
			if (workflowId) {
				await updateWorkflow({ workflowId, payload });
				successToast("Workflow updated successfully");
			} else {
				const response = await createWorkflow({ customerId, payload });
				const newWorkflowId = response.data.workflow_id;
				const newSearch = new URLSearchParams(searchParams);
				newSearch.set("mode", "edit");
				newSearch.set("workflowId", newWorkflowId);
				navigate(`${location.pathname}?${newSearch.toString()}`, {
					replace: true,
					state: { skipLoading: true },
				});
				successToast("Workflow created successfully");
			}
		} catch (error) {
			errorToast(error);
		}
	};

	const handlePublishWorkflow = async (): Promise<void> => {
		if (!validateConfigureStep()) return;

		const formValues = form.getValues();
		const transformedRules = transformRulesToPayload(formValues.rules);

		const payload = {
			name: formValues.name,
			description: formValues.description,
			trigger_id: formValues.trigger,
			rules: transformedRules,
			default_action: formValues.default_action,
			auto_publish: true,
		};

		try {
			if (workflowId) {
				await updateWorkflow({ workflowId, payload });
			} else {
				await createWorkflow({ customerId, payload });
			}
			successToast("Workflow activated and published successfully");
			handleGoBack();
		} catch (error) {
			errorToast(error);
		}
	};

	const renderStep = () => {
		switch (currentStep) {
			case WizardStep.WORKFLOW:
				return (
					<WorkflowStep
						form={form}
						onNext={handleNext}
						onBack={handleGoBack}
						onSaveDraft={handleSaveDraft}
						isSavingDraft={isSaving}
					/>
				);
			case WizardStep.CONFIGURE:
				return (
					<ConfigureStep
						form={form}
						onBack={handleBack}
						onNext={handleNext}
						onSaveDraft={handleSaveDraft}
						isSavingDraft={isSaving}
						showValidationErrors={showRuleValidationErrors}
						validationErrors={ruleValidationErrors}
						onValidate={validateConfigureStep}
						isEditMode={isEditMode}
						isLoadingWorkflow={isLoadingWorkflow}
					/>
				);
			case WizardStep.PREVIEW:
				return (
					<PreviewStep
						form={form}
						onBack={handleBack}
						customerId={customerId}
						workflowId={workflowId}
						onPublish={handlePublishWorkflow}
						isPublishing={isSaving}
					/>
				);
			default:
				return null;
		}
	};

	const steps = [
		{ id: WizardStep.WORKFLOW, label: "Workflows" },
		{ id: WizardStep.CONFIGURE, label: "Configure" },
		{ id: WizardStep.PREVIEW, label: "Preview" },
	];

	// Show loading state when fetching workflow data and catalog in edit mode
	const isFormAlreadyPopulated =
		skipLoading || populatedWorkflowId === workflowId;
	const isLoading =
		isEditMode &&
		!isFormAlreadyPopulated &&
		(isLoadingWorkflow || isLoadingCatalog);

	// Get version status for display
	const versionStatus = workflowResponse?.data?.current_version?.status;

	const loadingContent = (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-white border-b border-gray-200 px-8 py-4 mb-8">
				<div className="max-w-5xl mx-auto flex items-center gap-4">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-6 w-48" />
				</div>
			</div>
			<div className="max-w-5xl mx-auto px-4 sm:px-8">
				<div className="flex justify-center gap-8 mb-8">
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
				</div>
				<div className="bg-white rounded-lg p-6 space-y-4">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			</div>
		</div>
	);

	const content = (
		<div className="min-h-screen bg-gray-50">
			<div className="bg-white border-b border-gray-200 px-8 py-4 mb-8">
				<div className="max-w-5xl mx-auto flex items-center gap-4">
					<Button
						variant="ghost"
						size="icon"
						onClick={handleGoBack}
						className="text-gray-500 hover:text-gray-900 -ml-2"
					>
						<ArrowLeftIcon className="w-5 h-5" />
					</Button>
					<h1 className="text-xl font-semibold text-gray-900">
						{isReadOnly
							? "View Workflow"
							: isEditMode
								? "Edit Workflow"
								: "Custom Workflows"}
					</h1>
					{isReadOnly && (
						<span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
							Read Only
						</span>
					)}
					{isEditMode && versionStatus && !isReadOnly && (
						<span
							className={`px-2 py-1 text-xs font-medium rounded-full ${
								versionStatus === "draft"
									? "bg-yellow-100 text-yellow-800"
									: "bg-green-100 text-green-800"
							}`}
						>
							{versionStatus === "draft" ? "Draft" : "Published"}
						</span>
					)}
				</div>
			</div>

			<WizardStepper
				steps={steps}
				currentStep={currentStep}
				onStepClick={handleStepClick}
			/>

			<div className="px-4 sm:px-8">{renderStep()}</div>
		</div>
	);

	return (
		<CustomerWrapper>{isLoading ? loadingContent : content}</CustomerWrapper>
	);
};

export default WorkflowWizard;
