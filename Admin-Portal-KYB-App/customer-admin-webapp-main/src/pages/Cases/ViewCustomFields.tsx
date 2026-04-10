import { useEffect, useMemo, useState } from "react";
import {
	ArrowDownTrayIcon,
	DocumentTextIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { TitleLeftDivider } from "@/components/Dividers";
import {
	fileDownloader,
	fileNameFormater,
	formatSensitiveField,
} from "@/lib/helper";

export const parse = (value: string) => {
	try {
		const res = JSON.parse(value);
		return res;
	} catch (error) {
		// console.error(error);
		return "";
	}
};

type ViewCustomFieldsProps = {
	applicantData: Record<string, any>;
};
type CheckboxProperty = {
	label: string;
	value: string;
	icon: string;
	icon_position: string;
	checked: boolean;
	checkbox_type: string;
};

const ViewCustomFields: React.FC<ViewCustomFieldsProps> = ({
	applicantData,
}) => {
	const [customFieldArray, setCustomFieldArray] = useState<
		Array<Record<string, any>>
	>([]);
	const [Stepfields, setFields] = useState<Array<Record<string, any>>>([]);
	// const [customFieldFilesArray, setCustomFieldFilesArray] = useState<
	// 	Array<Record<string, any>>
	// >([]);

	const [viewSSNs, setViewSSNs] = useState(
		new Array(customFieldArray.length).fill(false),
	);

	const hasNonApplicantFiller = useMemo(() => {
		return applicantData.custom_fields.some((field: any) => {
			return (
				field.value &&
				field?.user &&
				(field.user?.role !== "applicant" ||
					(field.user?.first_name === "Guest" &&
						field.user?.last_name === "Owner" &&
						field.user?.email.includes("guest+")))
			);
		});
	}, [JSON.stringify(applicantData.custom_fields)]);

	const toggleSSNVisibility = (index: number) => {
		const newViewSSNs = [...viewSSNs];
		newViewSSNs[index] = !newViewSSNs[index];
		setViewSSNs(newViewSSNs);
	};

	useEffect(() => {
		if (applicantData?.custom_fields) {
			const fieldsArray: any = [];
			const filesArray: any = [];
			const fieldObject: any = {};

			applicantData?.custom_fields?.forEach((row?: any) => {
				// if values present then update reset object
				if (row?.value) {
					if (row?.property === "dropdown")
						fieldObject[row.internalName] = row?.value?.trim() ?? "";
					else if (row?.property === "boolean")
						fieldObject[row.internalName] =
							row?.value === "Yes" ? "TRUE" : "FALSE";
					else {
						fieldObject[row.internalName] = row?.value ?? "";
					}
				}
			});

			applicantData?.custom_fields?.forEach((field: any) => {
				if (field?.id) {
					if (field.type === "file" && field?.value?.length !== 0) {
						filesArray.push(field);
					} else {
						fieldsArray.push(field);
					}
				}
			});
			setCustomFieldArray(fieldsArray);
			setViewSSNs(new Array(fieldsArray?.length).fill(false));
			// setCustomFieldFilesArray(filesArray);
			const GroupFields: any = {};
			// grouping custom fields based on step names

			applicantData?.custom_fields?.forEach((field: any) => {
				let showField = true;
				if (field.type === "file" && field?.filename?.trim() !== "") {
					showField = false;
				}
				fieldsArray.push({ ...field, showField });

				field.CheckboxValue = [];
				// logic for get values of checkbox type input fields

				if (field.property === "checkbox") {
					let itemvalue: any = JSON.parse(field.value);

					itemvalue =
						typeof itemvalue === "object" && itemvalue !== null
							? itemvalue?.map((checkValue: CheckboxProperty) => {
									return {
										label: checkValue.label,
										value: checkValue.icon
											? checkValue.icon_position === "first"
												? `${checkValue?.icon}${checkValue?.value ?? ""}`
												: `${checkValue.value ?? ""}${checkValue.icon}`
											: checkValue.value,
										checked: checkValue.checked,
										type: checkValue.checkbox_type,
									};
								})
							: [];
					field.CheckboxValue = itemvalue;
				}

				GroupFields[field.step_name] = GroupFields[field.step_name] ?? [];
				GroupFields[field.step_name].push({ ...field, showField });
			});
			const reordered: any = {};
			const keys = Object.keys(GroupFields);
			keys.forEach((key) => {
				if (key !== "") {
					reordered[key] = GroupFields?.[key];
				}
			});
			if (GroupFields[""]) {
				reordered[""] = GroupFields[""];
			}
			setFields(reordered);
		}
	}, [applicantData]);

	return (
		<>
			{customFieldArray?.length > 0 ? (
				<>
					<div className="px-2 text-lg font-bold text-gray-800">
						<h1>Additional info</h1>
					</div>
					<div className="container mx-auto">
						{Object.keys(Stepfields).map((stepName: any, index: number) => {
							const showTitle = Stepfields?.[stepName].some(
								(f: any) => f.showField,
							);

							return (
								<div key={`${String(stepName)}${index}`}>
									{showTitle ? (
										<div className="py-2">
											<TitleLeftDivider text={stepName} />
										</div>
									) : null}
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 ">
										{Stepfields[stepName]?.map(
											(data: Record<string, any>, index: number) => {
												const isNotApplicant =
													data.user &&
													(data.user.role !== "applicant" ||
														(data.user?.first_name === "Guest" &&
															data.user?.last_name === "Owner" &&
															data.user?.email.includes("guest+")));

												return (
													<div
														key={`${String(data.label)}-${index}`}
														className={twMerge(
															data.type === "file" && "col-span-2",
														)}
													>
														{data.type === "file" && data?.value?.length ? (
															<div className="p-4" key={index}>
																<p className="py-2 text-xs font-medium tracking-tight text-gray-500 break-words">
																	{String(data?.label)}
																</p>
																<div
																	className={twMerge(
																		"w-full border border-gray-200 rounded-xl",
																		isNotApplicant && "bg-blue-50",
																	)}
																>
																	{data?.value?.map(
																		(file: any, index: number) => {
																			return (
																				<div
																					key={index}
																					className={twMerge(
																						"flex items-center justify-between w-full overflow-hidden p-4 gap-x-4",
																						index !== data.value?.length - 1 &&
																							"border-b border-gray-200",
																					)}
																				>
																					<div className="flex items-center justify-center text-gray-800 border border-gray-200 rounded-lg min-h-10 max-w-10 min-w-10">
																						<DocumentTextIcon
																							height={20}
																							className="text-gray-500"
																						/>
																					</div>

																					<div className="flex-grow overflow-hidden">
																						<span className="block w-full break-words">
																							{fileNameFormater(
																								data?.fileName[index],
																							)}
																							{isNotApplicant && (
																								<NotFilledByApplicant
																									user={data.user}
																								/>
																							)}
																						</span>
																					</div>

																					<div className="h-10 rounded-lg cursor-pointer min-w-10 hover:bg-gray-50 max-w-10">
																						<div
																							className={twMerge(
																								"flex items-center justify-center w-10 h-10",
																							)}
																							onClick={async () => {
																								await fileDownloader(
																									file,
																									data?.fileName[index],
																								);
																							}}
																						>
																							<ArrowDownTrayIcon height={20} />
																						</div>
																					</div>
																				</div>
																			);
																		},
																	)}
																</div>
															</div>
														) : data?.showField ? (
															<div className="p-4 pt-0" key={data.id}>
																<p className="py-2 text-xs font-normal tracking-tight text-gray-500 break-words">
																	{String(data?.label)}
																</p>
																{data.property === "checkbox" ? (
																	data?.CheckboxValue?.length > 0 ? (
																		data?.CheckboxValue?.map(
																			(checkbox: any, index: number) => {
																				return checkbox.checked ? (
																					<div
																						key={`${String(
																							checkbox.label,
																						)}${index}`}
																						className={twMerge(
																							isNotApplicant && "bg-blue-50",
																						)}
																					>
																						{checkbox.value ? (
																							<span className="text-sm font-medium tracking-tight break-words break-all text-slate-800 gap-x-2">
																								{checkbox.value
																									? `${String(checkbox.value)}`
																									: "NA"}
																							</span>
																						) : (
																							<span className="text-sm font-medium tracking-tight break-words break-all text-slate-800 gap-x-2">
																								{checkbox.label}
																							</span>
																						)}
																						{isNotApplicant && (
																							<NotFilledByApplicant
																								user={data.user}
																							/>
																						)}
																					</div>
																				) : null;
																			},
																		)
																	) : (
																		"NA"
																	)
																) : (
																	<p className="flex py-2 text-sm font-medium tracking-tight break-words break-all text-slate-800 gap-x-2">
																		<span
																			className={twMerge(
																				isNotApplicant &&
																					"bg-blue-50 px-1 py-0.5",
																			)}
																		>
																			{String(
																				data.is_sensitive
																					? formatSensitiveField(
																							data?.value,
																							viewSSNs[index],
																						)
																					: data?.value?.trim() !== ""
																						? (data?.value ?? "NA")
																						: "NA",
																			)}
																			{isNotApplicant && (
																				<NotFilledByApplicant
																					user={data.user}
																				/>
																			)}
																		</span>
																		{data.is_sensitive ? (
																			<div
																				onClick={() => {
																					toggleSSNVisibility(index);
																				}}
																				className=" inset-y-0 right-0 flex items-center pl-0.5"
																			>
																				{viewSSNs[index] ? (
																					<EyeIcon
																						className="w-5 h-5"
																						aria-hidden="true"
																					/>
																				) : (
																					<EyeSlashIcon
																						className="w-5 h-5"
																						aria-hidden="true"
																					/>
																				)}
																			</div>
																		) : null}
																	</p>
																)}
															</div>
														) : null}
													</div>
												);
											},
										)}
									</div>
								</div>
							);
						})}
					</div>
				</>
			) : (
				<div
					style={{ display: "flex", justifyContent: "center" }}
					className="py-2 text-base font-normal tracking-tight text-center text-gray-500"
				>
					{"Data not found"}
				</div>
			)}
			{hasNonApplicantFiller && (
				<div className="flex flex-row p-4 font-normal tracking-tight font-inter">
					<div className="flex items-center justify-center h-10 text-sm bg-blue-50 min-w-10">
						†
					</div>
					<div className="ml-4 text-xs ">
						Denotes fields that were filled out internally. These fields are
						only visible to applicants on documents that required an e-signature
						and have been mapped accordingly. For additional information, please
						reach out to your Worth representative.
					</div>
				</div>
			)}
		</>
	);
};

const NotFilledByApplicant = ({ user }: { user: Record<string, any> }) => {
	return <span className="m-1 font-medium align-super">†</span>;
};

export default ViewCustomFields;
