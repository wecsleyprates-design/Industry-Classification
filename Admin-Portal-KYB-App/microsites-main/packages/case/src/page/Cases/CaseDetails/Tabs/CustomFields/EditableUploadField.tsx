import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { UpdateBadge } from "@/components/EditableField/components/UpdateBadge";
import type { SaveStatus } from "@/components/EditableField/types";
import type { CustomFieldKey } from "./hooks";

import { downloadFile } from "@/helpers/documents";
import { DisplayFieldValue } from "@/page/Cases/CaseDetails/components";
import type { FieldSource } from "@/page/Cases/CaseDetails/components/fieldSource.types";
import { Button } from "@/ui/button";

interface EditableUploadFieldProps {
	fieldId: string;
	/** File names corresponding to each URL in the form value, matched by index */
	initialFileNames: string[];
	editingEnabled: boolean;
	saveStatus: SaveStatus;
	originalValue: string;
	onEditComplete: (
		fieldKey: CustomFieldKey,
		originalValue: string,
		newValue: string,
	) => void;
	fieldSource?: FieldSource;
}

function parseFileUrls(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw || "[]");
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return raw ? [raw] : [];
	}
}

export const EditableUploadField: React.FC<EditableUploadFieldProps> = ({
	fieldId,
	initialFileNames,
	editingEnabled,
	saveStatus,
	originalValue,
	onEditComplete,
	fieldSource,
}) => {
	const { setValue } = useFormContext();
	const rawValue = (useWatch({ name: fieldId }) as string) ?? "";
	const fileUrls = useMemo(() => parseFileUrls(rawValue), [rawValue]);

	const [fileNames, setFileNames] = useState<string[]>(initialFileNames);

	useEffect(() => {
		setFileNames(initialFileNames);
	}, [initialFileNames]);

	const files = useMemo(
		() =>
			fileUrls.map((url, idx) => ({
				fileName: fileNames[idx] ?? "",
				signedUrl: url,
			})),
		[fileUrls, fileNames],
	);

	const [loadingStates, setLoadingStates] = useState<boolean[]>([]);

	useEffect(() => {
		if (loadingStates.length !== files.length) {
			setLoadingStates(Array(files.length).fill(false));
		}
	}, [files.length, loadingStates.length]);

	const handleDownload = useCallback(
		async (idx: number, signedUrl: string, fileName: string) => {
			setLoadingStates((prev) => {
				const next = [...prev];
				next[idx] = true;
				return next;
			});
			try {
				await downloadFile(signedUrl, fileName);
			} finally {
				setLoadingStates((prev) => {
					const next = [...prev];
					next[idx] = false;
					return next;
				});
			}
		},
		[],
	);

	const handleRemoveFile = useCallback(
		(index: number) => {
			if (!editingEnabled) return;
			const updatedUrls = fileUrls.filter((_, i) => i !== index);
			const updatedNames = fileNames.filter((_, i) => i !== index);
			const newValue = JSON.stringify(updatedUrls);
			setValue(fieldId, newValue, { shouldDirty: true });
			setFileNames(updatedNames);
			onEditComplete(fieldId, originalValue, newValue);
		},
		[
			editingEnabled,
			fileUrls,
			fileNames,
			fieldId,
			setValue,
			originalValue,
			onEditComplete,
		],
	);

	if (files.length === 0) {
		return <span className="text-sm text-gray-500">No files uploaded</span>;
	}

	return (
		<div>
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
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="text-blue-600 rounded-full"
									onClick={async () => {
										await handleDownload(
											idx,
											file.signedUrl,
											file.fileName,
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
								{editingEnabled && (
									<Button
										variant="ghost"
										size="icon"
										className="text-gray-400 rounded-full hover:text-red-500 hover:bg-red-50"
										onClick={() => handleRemoveFile(idx)}
										aria-label={`Remove ${file.fileName}`}
									>
										<XMarkIcon className="size-5" />
									</Button>
								)}
							</div>
						</div>
					);
				})}
			</div>
			<UpdateBadge saveStatus={saveStatus} showUpdatedBadge />
		</div>
	);
};
