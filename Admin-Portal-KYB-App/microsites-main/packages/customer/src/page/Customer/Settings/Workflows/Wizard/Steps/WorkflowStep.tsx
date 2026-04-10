import React, { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { BoltIcon } from "@heroicons/react/24/solid";
import CustomWorkflowIcon from "@/assets/CustomWorkflowIcon";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { useGetTriggers } from "@/services/queries/workflows.query";
import { type WorkflowWizardForm } from "@/types/workflows";
import { WizardCard } from "../components/WizardCard";
import { WizardStepFooter } from "../components/WizardStepFooter";
import { WizardStepHeader } from "../components/WizardStepHeader";
import StepLayout from "../StepLayout";

import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/ui/form";
import { Input } from "@/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";

interface WorkflowStepProps {
	form: UseFormReturn<WorkflowWizardForm>;
	onNext: () => void;
	onBack: () => void;
	onSaveDraft: () => void;
	isSavingDraft: boolean;
}

const WorkflowStep: React.FC<WorkflowStepProps> = ({
	form,
	onNext,
	onBack,
	onSaveDraft,
	isSavingDraft,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const { data: triggersData } = useGetTriggers();

	const triggers = triggersData?.data?.triggers ?? [];
	const triggerOptions = triggers.map((trigger) => ({
		value: trigger.id,
		label: trigger.name,
	}));

	const selectedTrigger = triggerOptions.find(
		(option) => option.value === form.watch("trigger"),
	) ?? { value: "", label: "" };

	useEffect(() => {
		const firstTrigger = triggers[0];
		if (!firstTrigger) return;

		form.setValue("trigger", firstTrigger.id, { shouldValidate: true });
	}, [triggers, form]);

	return (
		<StepLayout>
			<WizardStepHeader
				title="Workflow Details"
				description="Customize your personal and business details."
			/>

			<Form {...form}>
				<WizardCard className="mb-6">
					<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6">
						<div className="flex items-start gap-3 sm:max-w-[420px]">
							<div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 flex-shrink-0">
								<CustomWorkflowIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="flex-1 min-w-0">
								<h2 className="text-sm text-gray-800 font-medium mb-1">
									Workflow Name
								</h2>
								<p className="text-sm text-gray-500">
									Configure when this workflow should be triggered.
								</p>
							</div>
						</div>

						<div className="sm:ml-4 w-full sm:flex-1 sm:max-w-[450px] space-y-6">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormControl>
											<Input
												label="Name"
												placeholder="Enter workflow name"
												maxLength={100}
												disabled={isReadOnly}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Description</FormLabel>
										<FormControl>
											<textarea
												placeholder="Enter workflow description"
												maxLength={500}
												rows={4}
												disabled={isReadOnly}
												className="flex min-h-[80px] w-full rounded-md border border-solid border-gray-200 bg-transparent p-2 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 resize-y"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-6 mt-6 pt-6 border-t border-gray-200">
						<div className="flex items-start gap-3 sm:max-w-[420px]">
							<div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-50 flex-shrink-0">
								<BoltIcon className="w-6 h-6 text-blue-600" />
							</div>
							<div className="flex-1 min-w-0">
								<h2 className="text-sm text-gray-800 font-medium mb-1">
									Trigger
								</h2>
								<p className="text-sm text-gray-500">
									Edit and manage the details of your business.
								</p>
							</div>
						</div>

						<div className="sm:ml-4 w-full sm:flex-1 sm:max-w-[450px]">
							<FormField
								control={form.control}
								name="trigger"
								render={({ field }) => (
									<FormItem>
										<div className="flex gap-1 items-center">
											<FormLabel>Trigger</FormLabel>
											<Popover>
												<PopoverTrigger>
													<InformationCircleIcon className="size-4 text-gray-400 hover:text-gray-600" />
												</PopoverTrigger>
												<PopoverContent side="top" className="w-64">
													<p className="text-sm leading-normal m-0 p-0">
														The trigger is automatically selected from available
														triggers.
													</p>
												</PopoverContent>
											</Popover>
										</div>
										<FormControl>
											<div className="w-full pointer-events-none opacity-60">
												<SelectComponent
													value={selectedTrigger}
													options={triggerOptions}
													defaultValue={{ value: "", label: "" }}
													onChange={() => {}}
													customStyles={{
														control: (provided: any, state: any) => ({
															...provided,
															height: 45,
															fontSize: "14px",
															fontWeight: 500,
															borderRadius: "8px",
															borderColor: state.isFocused
																? "#4B5563"
																: "#e5e7e8",
															boxShadow: "none",
															backgroundColor: "#f9fafb",
															cursor: "not-allowed",
															"&:hover": {
																borderColor: "#e5e7e8",
															},
														}),
													}}
												/>
											</div>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>
				</WizardCard>
			</Form>

			<WizardStepFooter
				title={
					isReadOnly
						? "Viewing workflow details."
						: "These workflow details will be saved."
				}
				description={
					isReadOnly
						? "Navigate through the steps to view the full configuration."
						: "You'll configure triggers and actions next."
				}
				onBack={onBack}
				backLabel="Back"
				primaryActionLabel="Continue to configure"
				onPrimaryAction={onNext}
				showSaveDraft={true}
				onSaveDraft={onSaveDraft}
				isSavingDraft={isSavingDraft}
				disableSaveDraft={isReadOnly}
			/>
		</StepLayout>
	);
};

export default WorkflowStep;
