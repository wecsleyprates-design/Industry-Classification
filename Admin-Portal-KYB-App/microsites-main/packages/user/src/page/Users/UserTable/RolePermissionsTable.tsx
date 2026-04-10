import React from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { type Permission } from "@/types/roles";

import { Badge } from "@/ui/badge";
import { Tooltip } from "@/ui/tooltip";

interface RolePermissionsTableProps {
	id: string;
	permissions: Permission[];
	isPending?: boolean;
}

const showBadge = (accessLevelLabel: string, type?: string) => {
	if (type && type === "toggle") {
		if (accessLevelLabel === "View") {
			return <Badge variant="success">Enabled</Badge>;
		} else if (accessLevelLabel === "No Access") {
			return <Badge variant="error">Disabled</Badge>;
		}
	}
	return (
		<span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded">
			{accessLevelLabel}
		</span>
	);
};

const PermissionTable = ({
	permissions,
	type,
}: {
	permissions: Permission[];
	type: "admin" | "feature";
}) => {
	return (
		<table className="min-w-full border-collapse table-fixed">
			<colgroup>
				<col style={{ width: "33.33%" }} />
				<col style={{ width: "33.33%" }} />
				<col style={{ width: "33.33%" }} />
			</colgroup>
			<thead>
				<tr className="border-b">
					<th className="px-4 py-2 text-xs font-medium text-left text-gray-600">
						Permission
					</th>
					<th className="px-4 py-2 text-xs font-medium text-left text-gray-600">
						Permission Group
					</th>
					<th className="px-4 py-2 text-xs font-medium text-left text-gray-600">
						Access Level
					</th>
				</tr>
			</thead>
			{permissions
				.filter((permission) => permission.tab_type === type)
				.map((permission) => (
					<tr key={permission.code}>
						<td className="flex items-center gap-1 px-4 py-2 text-sm text-gray-700">
							{permission.label}
							<Tooltip
								trigger={
									<InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-pointer" />
								}
								side="right"
								content={permission.description}
							/>
						</td>
						<td className="px-4 py-2 text-sm text-gray-700">
							{permission.group_label}
						</td>
						<td className="px-4 py-2">
							{showBadge(permission.access_level_label, permission.node_type)}
						</td>
					</tr>
				))}
		</table>
	);
};

const RolePermissionsTable: React.FC<RolePermissionsTableProps> = ({
	id,
	permissions,
}) => {
	if (!permissions || permissions.length === 0) {
		return (
			<div className="mt-3 ml-6 text-sm italic text-gray-500">
				0 permissions
			</div>
		);
	}
	return (
		<div className="mt-3 ml-6 overflow-hidden border-t rounded-lg" key={id}>
			<div key={`${id}-admin`} className="mb-6">
				<h3 className="px-4 py-2 text-sm font-semibold text-gray-800">
					Admin Permissions
				</h3>
				<div>
					<PermissionTable permissions={permissions} type="admin" />
				</div>
			</div>
			<div key={`${id}-feature`} className="mb-6">
				<h3 className="px-4 py-2 text-sm font-semibold text-gray-800">
					Feature Permissions
				</h3>
				<div>
					<PermissionTable permissions={permissions} type="feature" />
				</div>
			</div>
		</div>
	);
};

export default RolePermissionsTable;
