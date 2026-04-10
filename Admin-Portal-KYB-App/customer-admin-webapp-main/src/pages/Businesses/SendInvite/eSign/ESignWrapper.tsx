import { forwardRef, useImperativeHandle, useState } from "react";
import Button from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { getItem } from "@/lib/localStorage";
import { useGetESignTemplate } from "@/services/queries/case.query";
import { type ESignTemplateResponseData } from "@/types/case";
import TemplateListItem from "./TemplateListItem";
import TemplateSelectionModal from "./TemplateSelectionModal";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

interface ESignProps {
	onTemplatesSave: (ids: string[]) => void;
	selectedTemplateIds: string[];
}

export interface ESignRef {
	discard: () => void;
}

const ESignWrapper = forwardRef<ESignRef, ESignProps>(
	({ onTemplatesSave, selectedTemplateIds }, ref) => {
		const [customerId] = useState(getItem(LOCALSTORAGE?.customerId));

		// Fetch customer templates
		const { data, isLoading } = useGetESignTemplate(customerId ?? "");

		const allTemplates: ESignTemplateResponseData[] = data?.data ?? [];

		// Modal open state
		const [isModalOpen, setModalOpen] = useState(false);

		// Actions
		const onRemoveRow = (id: string) => {
			const updatedSelectedTemplateIds = selectedTemplateIds.filter(
				(x) => x !== id,
			);
			onTemplatesSave(updatedSelectedTemplateIds);
		};

		const handleDiscard = () => {
			onTemplatesSave([]);
		};

		useImperativeHandle(ref, () => ({
			discard: handleDiscard,
		}));

		// Early return for loading state
		if (isLoading) {
			return <Skeleton className="h-11 w-36" />;
		}

		return (
			<div className="w-full space-y-3">
				{/* Template List */}
				{selectedTemplateIds.length > 0 && (
					<div className="bg-transparent border border-gray-200 rounded-lg overflow-hidden">
						{selectedTemplateIds.map((id) => {
							const doc = allTemplates.find((t) => t.template_id === id);
							if (!doc) return null;
							return (
								<TemplateListItem
									key={doc.template_id}
									doc={doc}
									onPreview={(url) => window.open(url, "_blank")}
									onRemove={onRemoveRow} // emits only id
								/>
							);
						})}
					</div>
				)}

				<Button
					outline
					type="button"
					color="blue"
					className="rounded-md border-0 ring-inset ring-1 ring-gray-300 text-blue-600"
					onClick={() => {
						setModalOpen(true);
					}}
				>
					Add Documents
				</Button>
				{/* Modal */}
				{isModalOpen && (
					<TemplateSelectionModal
						isOpen={isModalOpen}
						templateList={allTemplates}
						selectedTemplateIds={selectedTemplateIds}
						onClose={() => {
							setModalOpen(false);
						}}
						onSave={(ids) => {
							onTemplatesSave(ids); // ✅ only IDs
							setModalOpen(false);
						}}
					/>
				)}
			</div>
		);
	},
);

ESignWrapper.displayName = "ESign";
export default ESignWrapper;
