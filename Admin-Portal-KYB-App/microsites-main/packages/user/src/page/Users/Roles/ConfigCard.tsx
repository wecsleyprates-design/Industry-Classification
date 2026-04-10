import React, { type FC, useState } from "react";
import { twMerge } from "tailwind-merge";
import { getBadge } from "@/lib/helper";
import usePermissionStore from "@/store/usePermissionStore";
import { type SubroleConfig } from "@/types/roles";
import PermissionDropdown from "./PermissionDropdown";
import PermissionToggle from "./PermissionToggle";

import Cards from "@/ui/Cards";

type ConfigCardProps = {
	config?: SubroleConfig;
	setTabValue?: (tab: "admin" | "features") => void;
};

const ConfigCard: FC<ConfigCardProps> = ({ config, setTabValue }) => {
	const permissions = usePermissionStore((state) => state.permissions);

	if (!config?.children?.length) return null;

	return (
		<div className="space-y-5">
			{config.children.map(
				({ label, description, children, is_enabled: isEnabled }) => (
					<Cards
						key={label}
						title={label}
						subtitle={description}
						badge={getBadge(children, permissions)}
						disabled={!isEnabled}
						disabledText={"Currently only available for Admin Roles"}
					>
						{children.map((child) => (
							<ConfigNode
								key={child.label}
								node={child}
								setTabValue={setTabValue}
							/>
						))}
					</Cards>
				),
			)}
		</div>
	);
};

const ConfigNode: FC<{
	node: SubroleConfig;
	setTabValue?: (tab: "admin" | "features") => void;
}> = ({ node, setTabValue }) => {
	const {
		label,
		description,
		permission_code: permissionCode,
		node_type: nodeType,
		access_level: accessLevel,
		children,
		actions,
	} = node;

	// Use first action as fallback when permissionCode is not provided.
	// This ensures data-permission-code and id attributes are always set when possible,
	// allowing navigation functions to find these elements even when permissionCode is null/undefined.
	const effectivePermissionCode =
		permissionCode ?? (actions && actions.length > 0 ? actions[0] : null);

	const showDropdown = nodeType === "access";

	const [expanded, setExpanded] = useState(
		nodeType === "text" || (nodeType === "toggle" && !permissionCode),
	);

	const showToggle =
		nodeType !== "text" &&
		((!!permissionCode && nodeType === "toggle") ||
			(!accessLevel && nodeType !== "access"));

	return (
		<div
			className="pl-4"
			data-permission-code={effectivePermissionCode ?? undefined}
			id={
				effectivePermissionCode
					? `permission-${label.toLowerCase()}`
					: undefined
			}
		>
			<div className="flex items-center justify-between w-full py-2">
				<div className="flex flex-col w-full">
					<p
						className={twMerge(
							"text-sm font-medium text-gray-900",
							nodeType === "text" && "uppercase text-[12px] text-gray-500 mt-3",
						)}
					>
						{label}
					</p>

					{nodeType === "text" && (
						<div className="w-full mt-1 mb-2 border-b border-gray-200" />
					)}

					{nodeType !== "text" && (
						<p className="text-sm font-normal leading-5 text-gray-600">
							{description}
						</p>
					)}
				</div>

				{showDropdown && (
					<PermissionDropdown
						actions={actions}
						permissionCode={effectivePermissionCode}
						setTabValue={setTabValue}
					/>
				)}

				{showToggle && (
					<PermissionToggle
						expanded={expanded}
						setExpanded={setExpanded}
						actions={actions}
						permissionCode={effectivePermissionCode}
						childs={children}
						setTabValue={setTabValue}
					/>
				)}
			</div>

			{expanded && children?.length > 0 && (
				<div className="bg-[#F9FAFB] rounded-xl p-1 mt-1">
					{children.map((child) => (
						<ConfigNode
							key={child.label}
							node={child}
							setTabValue={setTabValue}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default ConfigCard;
