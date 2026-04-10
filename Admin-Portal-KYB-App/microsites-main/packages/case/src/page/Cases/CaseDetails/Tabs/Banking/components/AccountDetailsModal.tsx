import React, { useState } from "react";
import {
	ClipboardDocumentCheckIcon,
	ClipboardIcon,
	EyeIcon,
	EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { useCustomToast } from "@/hooks/useCustomToast";
import { isBankAccount } from "@/lib/assertions";
import type { AccountDisplayValue, BankAccount, CreditCard } from "../types";
import { AccountBadges } from "./AccountBadges";

import { maskValue } from "@/helpers";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@/ui/modal";

type Props = {
	account?: BankAccount | CreditCard;
	isOpen: boolean;
	onClose: () => void;
};

export const AccountDetailsModal: React.FC<Props> = ({
	account,
	isOpen,
	onClose,
}) => {
	const [visibleValues, setVisibleValues] = useState<boolean[]>([]);
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
	const { defaultToast } = useCustomToast();

	const copyToClipboard = async (
		text: string,
		index: number,
		label: string,
	) => {
		await navigator.clipboard.writeText(text).then(() => {
			setCopiedIndex(index);
			defaultToast(`${label} copied.`, {
				className: "w-fit",
			});
			setTimeout(() => {
				setCopiedIndex(null);
			}, 2000);
		});
	};
	const toggleValueVisibility = (index: number) => {
		setVisibleValues((prev) => {
			const newArray = [...prev];
			newArray[index] = !newArray[index];
			return newArray;
		});
	};

	const handleClose = () => {
		setVisibleValues([]);
		setCopiedIndex(null);
		onClose();
	};

	const DisplayValue = ({
		index,
		displayValue,
	}: {
		index: number;
		displayValue: AccountDisplayValue;
	}) => {
		const { label, value, mask } = displayValue;
		return (
			<div className="flex flex-row items-center justify-between w-full pt-4 first:pt-0">
				<div className="text-sm text-gray-500 font-medium tracking-[.5px]">
					{label}
				</div>
				<div className="text-sm text-gray-800 font-medium tracking-[.5px]">
					{mask && value !== "--" ? (
						<div className="flex flex-row items-center gap-2">
							<span className="break-all ml-4">
								{visibleValues?.[index]
									? value
									: maskValue(value)}
							</span>

							<div
								onClick={() => {
									toggleValueVisibility(index);
								}}
							>
								{visibleValues?.[index] ? (
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
							{copiedIndex === index ? (
								<ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-600 cursor-pointer" />
							) : (
								<ClipboardIcon
									className="h-6 w-6 text-blue-600 cursor-pointer"
									onClick={async () => {
										await copyToClipboard(
											String(value),
											index,
											label,
										);
									}}
								/>
							)}
						</div>
					) : (
						<span className="break-all ml-4">{value}</span>
					)}
				</div>
			</div>
		);
	};

	if (!account) return null;

	return (
		<Modal open={isOpen} onOpenChange={handleClose}>
			<ModalContent className="gap-0 p-0 w-full min-w-[574px]">
				<ModalHeader
					onClose={handleClose}
					description="Account Details"
					className="border-b border-gray-200 p-5"
					title="Account Details"
					subtitle={
						<div className="flex flex-col gap-2">
							{isBankAccount(account) && (
								<AccountBadges account={account} />
							)}
						</div>
					}
				/>
				<ModalBody className="flex flex-col items-center gap-4 w-full p-5 divide-y">
					{Object.entries(account.displayValues).map(
						([key, value], index) => (
							<DisplayValue
								key={key}
								displayValue={value}
								index={index}
							/>
						),
					)}
				</ModalBody>
			</ModalContent>
		</Modal>
	);
};
