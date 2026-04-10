import {
	DocumentTextIcon,
	EyeIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import Button from "@/components/Button";
import ReactCustomTooltip from "@/components/Tooltip/ReactCustomTooltip";
import { type ESignTemplateResponseData } from "@/types/case";

const TemplateListItem = ({
	doc,
	onPreview,
	onRemove,
}: {
	doc: ESignTemplateResponseData;
	onPreview: (url: string) => void;
	onRemove: (id: string) => void; // emits only template_id
}) => {
	return (
		<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-white">
			<div className="flex items-center gap-3 min-w-0">
				<div className="p-2 bg-gray-100 rounded-full">
					<DocumentTextIcon className="h-6 w-6 text-gray-800 shrink-0" />
				</div>
				<span className="text-sm font-medium truncate text-gray-800">
					{doc.name?.replace?.(".pdf", "") ?? "-"}
				</span>
			</div>

			<div className="flex gap-2">
				<ReactCustomTooltip
					id={`preview-tooltip`}
					tooltip={<>{"Preview"}</>}
					place="top"
					tooltipStyle={{
						maxWidth: "400px",
						zIndex: 1000,
						fontSize: "12px",
					}}
				>
					<Button
						color="transparent"
						className="p-2 border border-gray-300 rounded-lg"
						title="Preview"
						type="button"
						onClick={() => {
							if (doc.url?.signedRequest) {
								onPreview(doc.url.signedRequest);
							}
						}}
					>
						<EyeIcon className="h-5 w-5 text-gray-800" />
					</Button>
				</ReactCustomTooltip>

				<ReactCustomTooltip
					id={`remove-tooltip`}
					tooltip={<>{"Remove"}</>}
					place="top"
					tooltipStyle={{
						maxWidth: "400px",
						zIndex: 1000,
						fontSize: "12px",
					}}
				>
					<Button
						color="transparent"
						className="p-2 border border-gray-300 rounded-lg"
						title="Remove"
						type="button"
						onClick={() => {
							onRemove(doc.template_id);
						}}
					>
						<TrashIcon className="h-5 w-5 text-red-700" />
					</Button>
				</ReactCustomTooltip>
			</div>
		</div>
	);
};

export default TemplateListItem;
