import React from "react";

interface Step {
	id: number;
	label: string;
}

interface WizardStepperProps {
	steps: Step[];
	currentStep: number;
	onStepClick: (stepId: number) => void;
}

export const WizardStepper: React.FC<WizardStepperProps> = ({
	steps,
	currentStep,
	onStepClick,
}) => {
	return (
		<div className="flex justify-center mb-8">
			<div className="inline-flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
				{steps.map((step) => (
					<button
						type="button"
						key={step.id}
						onClick={() => {
							onStepClick(step.id);
						}}
						className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
							currentStep === step.id
								? "bg-blue-600 text-white shadow-sm"
								: "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
						}`}
					>
						{step.label}
					</button>
				))}
			</div>
		</div>
	);
};
