import React from "react";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { WizardCard } from "./WizardCard";

import { Button } from "@/ui/button";

interface WizardStepFooterProps {
	title?: string;
	description?: string;
	onBack: () => void;
	backLabel?: string;
	primaryActionLabel: string;
	onPrimaryAction: () => void;
	onSaveDraft?: () => void;
	secondaryActions?: React.ReactNode;
	showSaveDraft?: boolean;
	isSavingDraft?: boolean;
	disableSaveDraft?: boolean;
	disablePrimaryAction?: boolean;
}

export const WizardStepFooter: React.FC<WizardStepFooterProps> = ({
	title,
	description,
	onBack,
	backLabel = "Back",
	primaryActionLabel,
	onPrimaryAction,
	onSaveDraft,
	secondaryActions,
	showSaveDraft = true,
	isSavingDraft = false,
	disableSaveDraft = false,
	disablePrimaryAction = false,
}) => {
	return (
		<WizardCard className="mt-6 flex items-center justify-between">
			{(title ?? description) ? (
				<div className="max-w-lg">
					{title && (
						<h3 className="text-base font-semibold text-gray-900 mb-1">
							{title}
						</h3>
					)}
					{description && (
						<p className="text-sm text-gray-500">{description}</p>
					)}
				</div>
			) : (
				<br />
			)}

			<div className="flex items-center gap-3">
				<Button
					variant="outline"
					onClick={onBack}
					className="bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 px-4"
				>
					<ArrowLeftIcon className="w-4 h-4 mr-2" />
					{backLabel}
				</Button>

				{secondaryActions}

				{showSaveDraft && (
					<Button
						variant="outline"
						onClick={onSaveDraft}
						disabled={isSavingDraft || disableSaveDraft}
						className="bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isSavingDraft ? "Saving..." : "Save Draft"}
					</Button>
				)}

				<Button
					onClick={onPrimaryAction}
					disabled={disablePrimaryAction}
					className="bg-blue-600 hover:bg-blue-700 text-white px-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-blue-400"
				>
					{primaryActionLabel}
				</Button>
			</div>
		</WizardCard>
	);
};
