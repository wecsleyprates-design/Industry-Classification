import React, { type ReactNode, useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { DisplayFieldValue } from "./DisplayFieldValue";
import type { FieldSource } from "./fieldSource.types";

export interface CardListItemProps {
	label?: ReactNode;
	action?: ReactNode;
	value?: ReactNode;
	tooltip?: string | ReactNode;
	badge?: ReactNode;
	fieldSource?: FieldSource;
	children?: never;
	hasEncryptedValue?: boolean;
	getDecryptedValue?: () => Promise<string | undefined>;
}

export const CardListItem: React.FC<CardListItemProps> = ({
	label,
	action,
	value,
	tooltip: _tooltip,
	badge,
	fieldSource,
	hasEncryptedValue = false,
	getDecryptedValue,
}) => {
	const [viewToggle, setToggle] = useState(false);
	const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
	return (
		<div
			className={`py-4 sm:grid sm:grid-cols-3 sm:gap-4 min-h-[56px] sm:items-center justify-between`}
		>
			{(label ?? action) && (
				<dt className="text-sm font-medium text-gray-500 sm:col-span-1">
					{label}
					{action}
				</dt>
			)}
			{value && (
				<dd className="mt-1 text-sm text-gray-900 sm:col-span-1 sm:mt-0">
					<div className="flex items-center gap-2">
						<DisplayFieldValue
							value={
								viewToggle && decryptedValue
									? decryptedValue
									: value
							}
							fieldSource={fieldSource}
						/>
						{hasEncryptedValue ? (
							<div
								onClick={async () => {
									setToggle(!viewToggle);
									if (!decryptedValue && getDecryptedValue) {
										const decrypted =
											await getDecryptedValue();
										if (decrypted)
											setDecryptedValue(decrypted);
									}
								}}
								className="inset-y-0 right-0 flex items-center pl-1 cursor-pointer"
							>
								{viewToggle ? (
									<EyeIcon
										className="w-5 h-5 text-blue-600"
										aria-hidden="true"
									/>
								) : (
									<EyeSlashIcon
										className="w-5 h-5 text-blue-600"
										aria-hidden="true"
									/>
								)}
							</div>
						) : null}
					</div>
				</dd>
			)}
			{badge && (
				<dd className="mt-1 ml-auto text-sm text-right sm:col-span-1 sm:mt-0">
					{badge}
				</dd>
			)}
		</div>
	);
};
