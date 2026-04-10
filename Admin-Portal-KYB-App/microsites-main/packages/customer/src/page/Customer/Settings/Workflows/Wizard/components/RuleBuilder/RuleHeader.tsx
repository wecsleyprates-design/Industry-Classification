import React, { useCallback, useState } from "react";
import {
	EllipsisHorizontalIcon,
	ExclamationCircleIcon,
	FlagIcon,
	PencilIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { useWorkflowPermissions } from "@/hooks/useWorkflowPermissions";
import { cn } from "@/lib/utils";

interface RuleHeaderProps {
	name: string;
	onNameChange: (name: string) => void;
	onDelete: () => void;
	canDelete?: boolean;
	hasError?: boolean;
}

export const RuleHeader: React.FC<RuleHeaderProps> = ({
	name,
	onNameChange,
	onDelete,
	canDelete = true,
	hasError = false,
}) => {
	const { canWrite } = useWorkflowPermissions();
	const isReadOnly = !canWrite;
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(name);
	const [showMenu, setShowMenu] = useState(false);

	const handleStartEdit = useCallback(() => {
		setEditValue(name);
		setIsEditing(true);
		setShowMenu(false);
	}, [name]);

	const handleSave = useCallback(() => {
		const trimmedValue = editValue.trim();
		if (trimmedValue) {
			onNameChange(trimmedValue);
		}
		setIsEditing(false);
	}, [editValue, onNameChange]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleSave();
			} else if (e.key === "Escape") {
				setEditValue(name);
				setIsEditing(false);
			}
		},
		[handleSave, name],
	);

	const handleBlur = useCallback(() => {
		handleSave();
	}, [handleSave]);

	return (
		<div
			className={cn(
				"flex items-center justify-between py-3 px-4 rounded-t-lg border-b",
				hasError ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200",
			)}
		>
			<div className="flex items-center gap-2">
				{hasError ? (
					<ExclamationCircleIcon className="h-5 w-5 text-red-500" />
				) : (
					<FlagIcon className="h-5 w-5 text-blue-600" />
				)}

				{isEditing ? (
					<input
						type="text"
						value={editValue}
						onChange={(e) => {
							setEditValue(e.target.value);
						}}
						onKeyDown={handleKeyDown}
						onBlur={handleBlur}
						autoFocus
						className="text-base font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 outline-none px-1 py-0.5"
					/>
				) : (
					<h3
						className={cn(
							"text-base font-semibold",
							hasError ? "text-red-800" : "text-gray-900",
						)}
					>
						{name}
					</h3>
				)}
			</div>

			{!isReadOnly && (
				<div className="flex items-center gap-1">
					<div className="relative">
						<button
							type="button"
							onClick={() => {
								setShowMenu(!showMenu);
							}}
							className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
						>
							<EllipsisHorizontalIcon className="h-5 w-5" />
						</button>

						{showMenu && (
							<>
								<div
									className="fixed inset-0 z-10"
									onClick={() => {
										setShowMenu(false);
									}}
								/>
								<div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
									<button
										type="button"
										onClick={handleStartEdit}
										className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
									>
										<PencilIcon className="h-4 w-4" />
										Rename
									</button>
								</div>
							</>
						)}
					</div>

					{canDelete && (
						<button
							type="button"
							onClick={onDelete}
							className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
							title="Delete rule"
						>
							<TrashIcon className="h-5 w-5" />
						</button>
					)}
				</div>
			)}
		</div>
	);
};
