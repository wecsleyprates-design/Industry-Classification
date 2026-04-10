import { type FC, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useCustomToast } from "@/hooks";
import { extractPermissionsFromConfig } from "@/lib/helper";
import usePermissionStore from "@/store/usePermissionStore";
import { type SubroleConfigResponse } from "@/types/roles";
import ConfigCard from "./ConfigCard";
import Footer from "./Footer";

import {
	dependencyMapping,
	normalizeDependentPermissions,
} from "@/constants/Roles";
import {
	SubTabs,
	SubTabsContent,
	SubTabsList,
	SubTabsTrigger,
} from "@/ui/tabs";

interface SubroleInfoSchema {
	name: string;
	description?: string;
}

const subroleInfoSchema = yup.object().shape({
	name: yup.string().required("Role name is required"),
	description: yup.string().optional(),
});

interface ManageRolesProps {
	data?: SubroleConfigResponse;
	onSubmit: (roleData: any) => Promise<void>;
	isLoading?: boolean;
	pageTitle?: string;
	showDeleteButton?: boolean;
	onDelete?: () => Promise<void>;
}

const ManageRoles: FC<ManageRolesProps> = ({
	data,
	onSubmit,
	isLoading,
	pageTitle,
	showDeleteButton,
	onDelete,
}) => {
	const navigate = useNavigate();
	const permissions = usePermissionStore((state) => state.permissions);
	const setPermissions = usePermissionStore((state) => state.setPermissions);

	const { errorToast } = useCustomToast();
	const form = useForm<SubroleInfoSchema>({
		defaultValues: {
			name: "",
			description: "",
		},
		resolver: yupResolver(subroleInfoSchema) as any,
	});
	const [tabValue, setTabValue] = useState("admin");
	const [initialPermissions, setInitialPermissions] = useState<string[]>([]);
	const hasPermissionsChanged =
		permissions.join(",") !== initialPermissions.join(",");

	const hasChanges = form.formState.isDirty || hasPermissionsChanged;

	// Fill default values from data.subrole_configs only once when present
	// Use ref to track if we've already initialized to prevent infinite loops
	const hasInitialized = useRef(false);
	const prevSubroleId = useRef<string | undefined>(undefined);

	useEffect(() => {
		const subroleId = data?.data?.subrole?.id;
		const subroleChanged = subroleId !== prevSubroleId.current;

		if (data?.data?.subrole && (subroleChanged || !hasInitialized.current)) {
			form.reset({
				name: data?.data.subrole.label || "",
				description: data?.data.subrole.description || "",
			});
			prevSubroleId.current = subroleId;
		}

		if (
			data?.data?.subrole_configs &&
			(subroleChanged || !hasInitialized.current)
		) {
			const perms = extractPermissionsFromConfig(data.data.subrole_configs);
			const dependencyKeys = Object.keys(dependencyMapping);

			const additionalPermissions: string[] = [];
			dependencyKeys.forEach((parentKey) => {
				if (perms.includes(parentKey)) {
					const dependents = dependencyMapping[parentKey] ?? [];
					const normalizedDependents =
						normalizeDependentPermissions(dependents);

					// Only automatically add non-editable dependent permissions
					// For editable permissions, only add if they're already in the loaded permissions
					// (meaning the user didn't manually remove them)
					normalizedDependents.forEach((dep) => {
						if (!dep.editable) {
							// Non-editable: always add if parent is present
							additionalPermissions.push(dep.permission);
						} else {
							// Editable: only add if it's already in the loaded permissions
							// This respects the user's choice to manually remove it
							if (perms.includes(dep.permission)) {
								additionalPermissions.push(dep.permission);
							}
						}
					});
				}
			});

			const finalPermissions = [
				...new Set([...perms, ...additionalPermissions]),
			];

			setPermissions(finalPermissions);
			setInitialPermissions(finalPermissions);
			hasInitialized.current = true;
		}
	}, [data?.data?.subrole?.id, data?.data?.subrole_configs]);

	const onDiscard = () => {
		if (data?.data?.subrole) {
			// Edit mode
			form.reset(
				{
					name: data.data.subrole.label || "",
					description: data.data.subrole.description || "",
				},
				{ keepDirty: false },
			);
			setPermissions(initialPermissions);
		} else {
			// Create mode
			form.reset(
				{
					name: "",
					description: "",
				},
				{ keepDirty: false },
			);
			setPermissions(initialPermissions);
		}
	};

	const handleSave = form.handleSubmit(async (values) => {
		// Prevent multiple submissions
		if (isLoading) return;

		if (permissions.length === 0) {
			errorToast({ message: "At least one permission must be selected" });
			return;
		}
		const roleData = {
			code: values.name.trim().toLowerCase().replace(/\s+/g, "_"),
			label: values.name,
			description: values.description,
			permissions,
		};

		try {
			await onSubmit(roleData);
			setInitialPermissions(permissions);
		} catch (error) {
			errorToast(error);
		}
	});

	return (
		<div className="w-full min-h-screen bg-gray-100">
			{/* Toolbar */}
			<div className="w-full h-[76px] flex items-center border border-gray-200 bg-white px-6">
				<div className="flex items-center gap-3 w-[169px] h-[44px]">
					<button
						type="button"
						onClick={() => {
							navigate(-1);
						}}
						className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded hover:bg-gray-50"
					>
						<ChevronLeftIcon className="w-6 h-6 text-gray-600" />
					</button>
					<span className="text-lg font-medium text-gray-900">
						{pageTitle ?? "Manage Role"}
					</span>
				</div>
			</div>

			{/* Card Section */}
			<div className="max-h-full px-6 py-6">
				<div className="w-full max-w-full p-6 bg-white border border-gray-200 shadow-md rounded-xl">
					<div className="w-full h-6 flex items-center gap-1.5 px-1 rounded">
						<span className="font-inter font-semibold text-[16px] leading-6 text-[#1F2937]">
							General Details
						</span>
					</div>

					<div className="w-full mt-6">
						<label
							htmlFor="name"
							className="px-1 block font-inter text-[12px] leading-[18px] text-[#1F2937] mb-1"
						>
							Name*
						</label>
						<input
							id="name"
							type="text"
							required
							placeholder="Enter Name"
							{...form.register("name")}
							className="w-full h-10 px-3 text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
						{form.formState.errors.name && (
							<p className="mt-1 text-sm text-red-600">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>

					{/* Description */}
					<div className="w-full mt-6">
						<label
							htmlFor="description"
							className="flex items-center gap-1 px-1 font-inter text-[12px] leading-[18px] text-[#1F2937] mb-1"
						>
							Description
							<InformationCircleIcon
								className="w-4 h-4 text-gray-400 cursor-pointer"
								title="More info about this"
							/>
						</label>
						<input
							id="description"
							type="text"
							placeholder="Enter Description"
							{...form.register("description")}
							className="w-full h-10 px-3 text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					{/* Divider */}
					<div className="w-full h-full mt-6 bg-gray-300"></div>

					{/* Permissions */}
					<div className="w-full h-6 flex items-center gap-1.5 px-1 py-3 rounded">
						<span className="font-inter font-semibold text-[16px] leading-6 mt-11 text-[#1F2937]">
							Permissions
						</span>
					</div>
					<p className="mt-7 px-1 text-[14px] text-[#6B7280]">
						Customize what permissions are included in this role.
					</p>

					<SubTabs
						value={tabValue}
						onValueChange={setTabValue}
						className="mt-4"
					>
						<SubTabsList className="flex gap-5 pb-3">
							<SubTabsTrigger value="admin">Admin</SubTabsTrigger>
							<SubTabsTrigger value="features">Features</SubTabsTrigger>
						</SubTabsList>

						<SubTabsContent value="admin">
							<ConfigCard
								config={data?.data?.subrole_configs.find(
									(config) => config.label === "Admin",
								)}
								setTabValue={setTabValue}
							/>
						</SubTabsContent>
						<SubTabsContent value="features">
							<ConfigCard
								config={data?.data?.subrole_configs.find(
									(config) => config.label === "Feature",
								)}
								setTabValue={setTabValue}
							/>
						</SubTabsContent>
					</SubTabs>

					<Footer
						hasChanges={hasChanges}
						onDiscard={onDiscard}
						onSave={handleSave}
						isLoading={isLoading}
						showDeleteButton={showDeleteButton}
						onDelete={onDelete}
					/>
				</div>
			</div>
		</div>
	);
};

export default ManageRoles;
