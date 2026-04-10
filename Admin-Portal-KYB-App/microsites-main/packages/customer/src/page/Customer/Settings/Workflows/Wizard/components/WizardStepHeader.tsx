import React from "react";
import { WizardCard } from "./WizardCard";

interface WizardStepHeaderProps {
	title: string;
	description: string;
}

export const WizardStepHeader: React.FC<WizardStepHeaderProps> = ({
	title,
	description,
}) => {
	return (
		<WizardCard className="mb-6 min-h-[106px] flex flex-col justify-center">
			<h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
			<p className="text-sm text-gray-500">{description}</p>
		</WizardCard>
	);
};
