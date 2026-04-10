import React, { type FC, useState } from "react";
import { useFlags } from "launchdarkly-react-client-sdk";
import { twMerge } from "tailwind-merge";
import { isAdminSubdomain } from "@/lib/helper";
import useAuthStore from "@/store/useAuthStore";

import FEATURE_FLAGS from "@/constants/FeatureFlags";
import { MODULES } from "@/constants/Modules";

interface FooterProps {
	hasChanges: boolean;
	onDiscard: () => void;
	onSave: () => void;
	isLoading?: boolean;
	showDeleteButton?: boolean;
	onDelete?: () => Promise<void>;
}

const Footer: FC<FooterProps> = ({
	hasChanges,
	onDiscard,
	onSave,
	isLoading,
	showDeleteButton = false,
	onDelete,
}) => {
	const [deleting, setDeleting] = useState(false);
	const permissions = useAuthStore((state) => state.permissions);
	const flags = useFlags();

	const handleDelete = async () => {
		try {
			setDeleting(true);
			await onDelete?.();
		} finally {
			setDeleting(false);
		}
	};

	const shouldShowDeleteButton =
		flags[FEATURE_FLAGS.PAT_779_CREATE_AND_UPDATE_CUSTOM_SUBROLES] &&
		(isAdminSubdomain(window.location.href) ||
			!!permissions[MODULES.ROLES]?.create) &&
		showDeleteButton;

	return (
		<div
			className={twMerge(
				"flex items-center justify-between mt-6",
				!shouldShowDeleteButton && "justify-end",
			)}
		>
			{/* Delete Role */}
			{shouldShowDeleteButton && (
				<button
					onClick={handleDelete}
					disabled={deleting}
					className="w-[122px] h-[40px] rounded-lg border border-x-gray-300 text-red-600 px-5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{deleting ? "Deleting..." : "Delete Role"}
				</button>
			)}

			<div className="flex gap-2">
				{/* Discard Changes */}
				<button
					className={`w-[161px] h-[40px] rounded-lg border px-5 py-2 text-sm font-medium ${
						hasChanges
							? "text-[#2563EB] border-gray-300"
							: "opacity-50 text-[#2563EB] border-gray-300 cursor-not-allowed"
					}`}
					disabled={!hasChanges}
					onClick={onDiscard}
					type="button"
				>
					Discard Changes
				</button>

				{/* Save Changes */}
				<button
					type="button"
					className={`w-[142px] h-[40px] rounded-lg px-5 py-2 text-sm font-medium ${
						hasChanges && !isLoading
							? "bg-[#2563EB] text-white"
							: "bg-[#2563EB] text-white opacity-50 cursor-not-allowed"
					}`}
					disabled={!hasChanges || isLoading}
					onClick={() => {
						if (!hasChanges || isLoading) return;
						onSave();
					}}
				>
					{isLoading ? "Saving..." : "Save Changes"}
				</button>
			</div>
		</div>
	);
};

export default Footer;
