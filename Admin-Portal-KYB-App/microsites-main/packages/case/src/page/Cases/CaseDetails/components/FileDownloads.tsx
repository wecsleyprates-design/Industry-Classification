import { useEffect, useState } from "react";
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { DisplayFieldValue } from "./DisplayFieldValue";
import type { FieldSource } from "./fieldSource.types";

import { downloadFile } from "@/helpers/documents";
import { Button } from "@/ui/button";

export const FileDownloads: React.FC<{
	files: Array<{ fileName: string; signedUrl: string; filePath?: string }>;
	fieldSource?: FieldSource;
}> = ({ files, fieldSource }) => {
	const [loadingStates, setLoadingStates] = useState<boolean[]>([]);

	useEffect(() => {
		if (loadingStates.length !== files.length) {
			setLoadingStates(Array(files.length).fill(false));
		}
	}, [files.length, loadingStates.length]);

	const handleDownload = async (
		idx: number,
		signedUrl: string,
		fileName: string,
		filePath?: string,
	) => {
		setLoadingStates((prev) => {
			const next = [...prev];
			next[idx] = true;
			return next;
		});

		try {
			await downloadFile(signedUrl, fileName, filePath);
		} finally {
			setLoadingStates((prev) => {
				const next = [...prev];
				next[idx] = false;
				return next;
			});
		}
	};

	return (
		<div className="flex flex-col border divide-y rounded-xl">
			{files.map((file, idx) => {
				const isLoading = loadingStates[idx];

				return (
					<div
						key={idx}
						className="flex items-center justify-between p-4"
					>
						<div className="flex items-center gap-3">
							<span className="flex items-center justify-center bg-gray-100 rounded-full min-w-10 min-h-10">
								<DocumentTextIcon className="text-gray-800 size-5" />
							</span>
							<DisplayFieldValue
								value={file.fileName}
								fieldSource={fieldSource}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon"
							className="text-blue-600 rounded-full"
							onClick={async () => {
								await handleDownload(
									idx,
									file.signedUrl,
									file.fileName,
									file.filePath,
								);
							}}
							disabled={!file.signedUrl || isLoading}
						>
							{isLoading ? (
								<span className="animate-spin size-5 border-[3px] border-blue-600 border-t-transparent rounded-full" />
							) : (
								<ArrowDownTrayIcon className="size-5" />
							)}
						</Button>
					</div>
				);
			})}
		</div>
	);
};
