import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { EyeIcon } from "@heroicons/react/24/outline";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import Button from "@/components/Button";
import { Skeleton } from "@/components/Skeleton";
import { type ESignTemplateResponseData } from "@/types/case";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface TemplateCardProps {
	doc: ESignTemplateResponseData;
	isSelected?: boolean;
	onToggle: (docId: string) => void; // emits only template_id
	onPreview?: (url: string) => void;
}

const TemplateCard = ({
	doc,
	isSelected,
	onToggle,
	onPreview,
}: TemplateCardProps) => {
	const [hover, setHover] = useState(false);

	return (
		<div
			className={[
				"relative border rounded-xl p-3 shadow-sm bg-white transition hover:shadow-md group",
				isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-200",
			].join(" ")}
			onMouseEnter={() => {
				setHover(true);
			}}
			onMouseLeave={() => {
				setHover(false);
			}}
		>
			{/* Preview overlay */}
			{doc.url?.signedRequest && (
				<button
					type="button"
					className="absolute top-2 right-2 bg-[#444444] rounded-lg p-1 shadow z-10"
					onClick={() => onPreview?.(doc.url.signedRequest)}
					title="Preview"
				>
					<EyeIcon className="h-5 w-5 text-white" />
				</button>
			)}

			{/* Thumbnail */}
			<div className="aspect-[4/3] w-full overflow-hidden border-b">
				<div className="w-full overflow-hidden">
					<Document
						file={doc?.url?.signedRequest}
						loading={<Skeleton className="h-[195px] w-full rounded-lg" />}
						error={
							<div className="text-center text-red-500">
								Failed to load PDF.
							</div>
						}
					>
						<Page
							pageNumber={1}
							width={225}
							renderAnnotationLayer={false}
							renderTextLayer={false}
						/>
					</Document>
				</div>
			</div>

			{/* Title */}
			<h4 className="text-sm font-medium text-gray-900 my-2 truncate">
				{doc.name?.replace?.(".pdf", "") ?? "-"}
			</h4>

			{/* Tags */}
			<div className="flex flex-wrap gap-1 mb-3 items-center">
				<span className="text-xs text-gray-400">Tags:</span>
				{doc.tags?.length ? (
					<>
						{doc.tags.map((tag) => (
							<span
								key={tag}
								className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700"
							>
								{tag}
							</span>
						))}
					</>
				) : (
					<span className="text-xs text-gray-400">None</span>
				)}
			</div>

			{/* Action Button with hover behavior for selected */}
			{isSelected ? (
				<Button
					outline={hover}
					color={hover ? "danger" : "blue"}
					className={`w-full ${hover ? "" : "text-white"}`}
					onClick={() => {
						onToggle(doc.template_id);
					}}
				>
					{hover ? "Remove" : "Selected"}
				</Button>
			) : (
				<Button
					outline
					color="grey"
					className="w-full"
					onClick={() => {
						onToggle(doc.template_id);
					}}
				>
					Select
				</Button>
			)}
		</div>
	);
};

export default TemplateCard;
