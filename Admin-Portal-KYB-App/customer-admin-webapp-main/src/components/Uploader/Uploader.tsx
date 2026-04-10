import React from "react";
import Dropzone, { type FileError } from "react-dropzone";
import {
	type Control,
	Controller,
	type FieldErrors,
	type UseFormGetValues,
	type UseFormSetValue,
	type UseFormTrigger,
} from "react-hook-form";
import {
	ArrowUpTrayIcon,
	DocumentTextIcon,
	InformationCircleIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { ReactCustomTooltip } from "@/components/Tooltip";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToBytes } from "@/lib/helper";
import { type Field } from "@/types/auth";

type Props = {
	f: Field;
	control: Control<Record<string, any>, any>;
	errors: FieldErrors<Record<string, any>>;
	formValues?: Record<string, any>;
	loader?: boolean;
	setLoader?: React.Dispatch<React.SetStateAction<boolean>>;
	tooltip?: string;
	getValues: UseFormGetValues<Record<string, any>>;
	setValue: UseFormSetValue<Record<string, any>>;
	trigger: UseFormTrigger<Record<string, any>>;
};

const Uploader: React.FC<Props> = ({
	f,
	control,
	errors,
	tooltip,
	getValues,
	setValue,
	trigger,
}) => {
	const { warningHandler } = useCustomToast();
	const rule = f?.rules?.find((val) => val.rule === "fileType");
	const fileTypes: string[] =
		rule?.value.split(",").map((type: string) => type.trim()) ?? [];

	const accepted = fileTypes.reduce<Record<string, string[]>>((acc, type) => {
		if (type === "pdf") {
			acc["application/pdf"] = [];
		} else {
			acc[`image/${type}`] = [];
		}
		return acc;
	}, {});

	const acceptString = fileTypes
		.map((type) => (type === "pdf" ? "application/pdf" : `image/${type}`))
		.join(",");

	// onDrop handler to handle the dropped file
	const handleDrop = (acceptedFiles: File[]) => {
		if (
			!getValues(f.internalName)?.find((file: any) => file.fileName === null)
		) {
			warningHandler({
				message:
					"You can upload up to " +
					String(
						f.rules?.find((rule) => rule.rule === "maxNumFiles")?.value ?? 1,
					) +
					" file(s) only.",
			});
		} else if (
			getValues(f.internalName)?.find(
				(file: any) =>
					JSON.stringify(file.fileName) === JSON.stringify(acceptedFiles[0]),
			)
		) {
			warningHandler({ message: "This file has already been uploaded." });
			return;
		}

		// Get the current array of files
		const currentFiles = getValues(f.internalName) || [];

		// Find the first file object where fileName is empty
		const updatedFiles = [...currentFiles]; // Create a copy of the current file array

		const firstEmptyFileIndex = updatedFiles.findIndex(
			(file) => file.fileName === "" || file.fileName === null,
		);

		if (firstEmptyFileIndex !== -1 && acceptedFiles.length > 0) {
			const newFile = acceptedFiles[0];

			// Update the first empty file object
			updatedFiles[firstEmptyFileIndex] = {
				fileName: newFile,
				value_id: updatedFiles[firstEmptyFileIndex]?.value_id ?? null, // Create a unique value_id (or use any logic you prefer)
			};

			// Update the form state with the new file list
			setValue(f.internalName, updatedFiles, {
				shouldDirty: true,
				shouldValidate: true,
			});
			void trigger(f.internalName);
		}
	};

	const validator:
		| (<T extends File>(file: T) => FileError | FileError[] | null)
		| undefined = (file) => {
		if (
			Number(file?.size) >
			Number(
				convertToBytes(
					String(f.rules?.find((rule) => rule.rule === "maxFileSize")?.value),
				) ?? 0,
			)
		) {
			warningHandler({
				message: `File size exceeds the limit of ${String(
					f.rules?.find((rule) => rule.rule === "maxFileSize")?.value,
				)}`,
			});
			return {
				code: "file-too-large",
				message: `File size exceeds the limit`,
			};
		} else if (
			fileTypes.length &&
			!fileTypes.includes(file.type.split("/")[1])
		) {
			warningHandler({
				message:
					"Invalid file type. Please upload a " +
					Object.values(fileTypes).slice(0, -1).join(", ").toUpperCase() +
					(Object.values(fileTypes).length > 1 ? " or " : "") +
					Object.values(fileTypes)?.slice(-1)[0]?.toUpperCase(),
			});
			return {
				code: "file-type-invalid",
				message: `File type iis invalid`,
			};
		} else return null;
	};

	return (
		<>
			{/** No need to show when these conditionas met */}
			<div key={f.internalName}>
				<label className="text-xs font-medium leading-6 text-gray-900 font-Inter">
					{f.label ?? ""}
					{tooltip && (
						<ReactCustomTooltip id={f.internalName} tooltip={<>{tooltip}</>}>
							<InformationCircleIcon className="min-w-3.5 max-w-3.5 text-gray-500 mx-1" />
						</ReactCustomTooltip>
					)}
					{!!f.rules?.find((rule) => rule.rule === "required") && (
						<span className="text-sm text-red-600">*</span>
					)}
				</label>
				<Controller
					control={control}
					name={f.internalName}
					render={({ field: { value } }) => (
						<>
							<Dropzone
								multiple={false}
								accept={accepted}
								onDrop={(acceptedFiles) => {
									handleDrop(acceptedFiles);
								}}
								maxSize={
									convertToBytes(
										String(
											f.rules?.find((rule) => rule.rule === "maxFileSize")
												?.value ?? "",
										),
									) ?? undefined
								}
								validator={validator}
							>
								{({ getRootProps, getInputProps }) => (
									<div
										{...getRootProps()}
										className="flex gap-1 my-2.5 flex-col"
									>
										<input
											{...getInputProps()}
											// onChange={onChange}
											accept={acceptString}
										/>
										<div className="flex h-[200px] flex-col items-center justify-center w-full py-2 bg-white border-2 border-gray-300 border-dashed rounded-lg border-spacing-10">
											<div className="flex flex-col items-center justify-center">
												<div className="flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl">
													<ArrowUpTrayIcon className="h-[26px] text-gray-800" />
												</div>
												<p className="mt-4 mb-1 text-base font-medium">
													Drag Your File Here or Browse
												</p>
												{fileTypes?.length ? (
													<p className="text-sm font-normal text-gray-500 ">
														{Object.values(fileTypes)
															.slice(0, -1)
															.join(", ")
															.toUpperCase() +
															(Object.values(fileTypes).length > 1
																? " or "
																: "") +
															Object.values(fileTypes)
																?.slice(-1)[0]
																?.toUpperCase()}
														{" files Accepted."}
													</p>
												) : null}
											</div>
										</div>
									</div>
								)}
							</Dropzone>

							<p className="text-sm text-red-600" id="email-error">
								{errors?.[f.internalName] &&
									String(errors?.[f.internalName]?.message)}
							</p>
							<div
								className={twMerge(
									getValues(f.internalName)?.filter((val: any) => val.fileName)
										.length && "border border-gray-200 rounded-xl",
								)}
							>
								{getValues(f.internalName)?.map(
									(fileObject: any, index: number) => (
										<div
											className={twMerge(
												"w-full",
												index !== 0 && "border-t",
												fileObject.fileName === null && "hidden",
											)}
											key={index}
										>
											<div className="flex flex-row items-center justify-start px-4 py-2 min-h-16">
												<div className="flex items-center justify-center h-10 mr-4 border border-gray-200 rounded-lg min-w-10">
													<DocumentTextIcon className="w-5 h-5 text-gray-500" />
												</div>
												{typeof fileObject?.fileName === "string"
													? fileObject?.fileName
													: (fileObject?.fileName?.name ?? "")}
												<div
													onClick={() => {
														const currentFiles =
															getValues(f.internalName) || [];
														const updatedFiles = [...currentFiles];
														updatedFiles[index] = {
															fileName: null,
															value_id: updatedFiles[index].value_id,
														};
														setValue(f.internalName, updatedFiles, {
															shouldValidate: true,
														});
													}}
													className="flex items-center justify-center h-10 ml-auto rounded-lg cursor-pointer min-w-10 hover:bg-gray-100"
												>
													<TrashIcon className="w-5 h-5" />
												</div>
											</div>
										</div>
									),
								)}
							</div>
						</>
					)}
				/>
			</div>
		</>
	);
};

export default Uploader;
