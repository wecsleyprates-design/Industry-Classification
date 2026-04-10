import { useMemo, useState } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { type ESignTemplateResponseData } from "@/types/case";
import TemplateCard from "./TemplateCard";

interface Props {
	isOpen: boolean;
	templateList: ESignTemplateResponseData[];
	selectedTemplateIds: string[]; // controlled by parent
	onClose: () => void;
	onSave: (selectedIds: string[]) => void; // emits ONLY IDs
}

const TemplateSelectionModal = ({
	isOpen,
	templateList,
	selectedTemplateIds,
	onClose,
	onSave,
}: Props) => {
	// local copy so Cancel discards, Save commits
	const [localSelected, setLocalSelected] =
		useState<string[]>(selectedTemplateIds);
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return templateList;
		return templateList.filter((t) => t.name?.toLowerCase().includes(q));
	}, [templateList, search]);

	const toggle = (id: string) => {
		setLocalSelected((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			cardColorClass="sm:p-0 p-0 m-0 bg-white rounded-xl w-[840px] sm:max-w-[840px]"
		>
			{/* Header */}
			<div className="h-[60px] border-b px-6 border-gray-200 flex items-center justify-between">
				<div className="text-base font-semibold">Select Documents</div>
				<XMarkIcon height={20} className="cursor-pointer" onClick={onClose} />
			</div>

			{/* Search */}
			<div className="relative p-4 flex flex-1 w-full bg-gray-100">
				<label htmlFor="search-field" className="sr-only">
					Search
				</label>
				<MagnifyingGlassIcon
					className="absolute w-4 h-8 ml-3 text-gray-400 "
					aria-hidden="true"
				/>
				<input
					id="search-field-unique"
					className="w-screen focus:outline-none bg-white h-8 text-gray-900 text-xs rounded-lg block py-2.5 pl-8"
					placeholder={"Search"}
					value={search}
					type="text"
					onChange={(e) => {
						setSearch(e.target.value);
					}}
					name="search-unique"
				/>
			</div>

			{/* Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 p-6 gap-5 max-h-[60vh] overflow-y-auto bg-gray-100">
				{filtered.map((doc) => (
					<TemplateCard
						key={doc.template_id}
						doc={doc}
						isSelected={localSelected.includes(doc.template_id)}
						onToggle={() => {
							toggle(doc.template_id);
						}}
						onPreview={(url) => window.open(url, "_blank")}
					/>
				))}
			</div>

			{/* Footer */}
			<div className="flex items-center justify-end gap-3 p-4 border-t">
				<Button
					color="transparent"
					outline
					onClick={onClose}
					className="px-3 py-2.5"
				>
					Cancel
				</Button>
				<Button
					color="dark"
					onClick={() => {
						onSave(localSelected); // ✅ emit ONLY IDs
						onClose();
					}}
				>
					Save
				</Button>
			</div>
		</Modal>
	);
};

export default TemplateSelectionModal;
