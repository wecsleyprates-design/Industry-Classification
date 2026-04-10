import React, { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import CustomWorkflowIcon from "@/assets/CustomWorkflowIcon";
import WarningModal from "@/components/Modal/WarningModal";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import type { WorkflowWizardForm } from "@/types/workflows";
import { RuleCard } from "../components/Preview/RuleCard";
import { transformRulesToPreview } from "../components/RuleBuilder/utils";
import { TestWorkflowModal } from "../components/TestWorkflow";
import { WizardCard } from "../components/WizardCard";
import { WizardStepFooter } from "../components/WizardStepFooter";
import StepLayout from "../StepLayout";

import { Button } from "@/ui/button";

interface PreviewStepProps {
	form: UseFormReturn<WorkflowWizardForm>;
	onBack: () => void;
	customerId: string;
	workflowId?: string;
	onPublish: () => Promise<void>;
	isPublishing: boolean;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
	form,
	onBack,
	customerId,
	workflowId,
	onPublish,
	isPublishing,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const [isTestModalOpen, setIsTestModalOpen] = useState(false);
	const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

	const rules = form.watch("rules");
	const defaultAction = form.watch("default_action");

	const previewData = useMemo(() => {
		const transformedRules = transformRulesToPreview(rules);

		return {
			rules: transformedRules.map((rule, index) => ({
				id: `rule-${index}`,
				priority: index + 1,
				...rule,
			})),
			default_action: defaultAction,
		};
	}, [rules, defaultAction]);

	const handleOpenPublishModal = () => {
		setIsPublishModalOpen(true);
	};

	const handleClosePublishModal = () => {
		setIsPublishModalOpen(false);
	};

	return (
		<StepLayout>
			<WizardCard className="mb-6 min-h-[106px] flex items-center justify-between">
				<div className="flex flex-col justify-center">
					<h2 className="text-lg font-semibold text-gray-900 mb-1">
						Workflow Preview
					</h2>
					<p className="text-sm text-gray-500">
						{isReadOnly
							? "View the workflow configuration"
							: "Review your workflow logic before publishing"}
					</p>
				</div>
				{!isReadOnly && (
					<div className="bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-xs font-semibold border border-green-100">
						Ready to Publish
					</div>
				)}
				{isReadOnly && (
					<div className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-200">
						View Only
					</div>
				)}
			</WizardCard>

			<div className="mb-4 px-1">
				<h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
					<CustomWorkflowIcon
						className="text-blue-600 w-6 h-6 fill-blue-600"
						strokeWidth={0}
					/>
					Workflow Rules
				</h3>
			</div>

			<div className="space-y-4 mb-10">
				{previewData.rules.map((rule) => (
					<RuleCard key={rule.id} rule={rule} />
				))}

				{previewData.default_action && (
					<>
						<div className="flex justify-center py-1 relative">
							<div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200 -z-0" />
							<span className="bg-orange-400 text-white px-4 py-1 rounded-full text-xs font-bold z-10 uppercase shadow-sm tracking-wider">
								OTHERWISE
							</span>
						</div>

						<RuleCard
							rule={{
								name: "Default Action",
								actions: [previewData.default_action],
							}}
							isDefault={true}
						/>
					</>
				)}
			</div>

			<WizardStepFooter
				title={
					isReadOnly
						? "Workflow Preview Complete"
						: "Ready to Publish your Workflow?"
				}
				description={
					isReadOnly
						? "You are viewing this workflow in read-only mode."
						: "This workflow will be published and activated immediately. It will start processing new applications right away."
				}
				onBack={onBack}
				backLabel="Back"
				primaryActionLabel="Publish Workflow"
				onPrimaryAction={handleOpenPublishModal}
				showSaveDraft={false}
				disablePrimaryAction={isReadOnly}
				secondaryActions={
					<Button
						variant="outline"
						onClick={() => {
							setIsTestModalOpen(true);
						}}
						disabled={isReadOnly}
						className="bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Test Workflow
					</Button>
				}
			/>

			<TestWorkflowModal
				isOpen={isTestModalOpen}
				onClose={() => {
					setIsTestModalOpen(false);
				}}
				customerId={customerId}
				workflowId={workflowId}
			/>

			<WarningModal
				isOpen={isPublishModalOpen}
				onClose={handleClosePublishModal}
				onSucess={onPublish}
				title="Publish Workflow?"
				description="This workflow will be published and activated immediately. It will start processing new applications right away."
				buttonText="Publish"
				type="success"
				isLoading={isPublishing}
			/>
		</StepLayout>
	);
};

export default PreviewStep;
