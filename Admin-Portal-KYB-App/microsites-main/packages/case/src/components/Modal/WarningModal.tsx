import React from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";

import { Button } from "@/ui/button";
import { Modal, ModalContent } from "@/ui/modal";

interface WarningModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	title: string;
	description: string;
	buttonText: string;
	buttonComponent?: React.ReactNode;
	type: "success" | "warning" | "danger" | "dark";
	hideIcon?: string;
	showIcon?: boolean;
	showCancel?: boolean;
}

export const WarningModal: React.FC<WarningModalProps> = ({
	isOpen,
	onClose,
	onSuccess,
	title,
	description,
	buttonText,
	buttonComponent,
	type,
	showIcon,
	showCancel,
}) => {
	const getIcon = () => {
		switch (type) {
			case "success":
				return (
					<>
						<div className="flex justify-center h-10 mr-2 text-green-600 bg-green-100 border-green-600 rounded-full min-w-10">
							<CheckCircleIcon className="self-center w-full h-6 text-center text-[#16A34A] " />
						</div>
					</>
				);
			case "danger":
				return (
					<>
						<div className="flex justify-center w-10 h-10 mr-2 text-red-600 border-red-600 rounded-full bg-red-50">
							<ExclamationTriangleIcon className="self-center w-6 h-6 text-center bg-red " />
						</div>
					</>
				);
			case "dark":
				return (
					<>
						<div className="flex justify-center w-10 h-10 mr-2 text-yellow-600 border-yellow-600 rounded-full bg-yellow-50">
							<ExclamationTriangleIcon className="self-center w-6 h-6 text-center bg-red " />
						</div>
					</>
				);
			default:
				return (
					<>
						<div className="flex justify-center w-10 h-10 mr-2 text-yellow-600 border-yellow-600 rounded-full bg-yellow-50">
							<ExclamationTriangleIcon className="self-center w-6 h-6 text-center bg-red " />
						</div>
					</>
				);
		}
	};
	return (
		<Modal open={isOpen} onOpenChange={onClose}>
			<ModalContent className="min-w-[200px] gap-0 p-0">
				<div className="flex flex-col justify-center flex-1 min-h-full p-4 px-3 py-6 rounded-t-lg bg-slate-50 sm:px-6 lg:px-8">
					<div className="flex">
						{showIcon ? getIcon() : null}
						<div className="">
							<span className="font-bold text-base text-[#1F2A37]">
								{title}
							</span>
							<div className="mt-3 text-sm">{description}</div>
						</div>
					</div>
				</div>
				<div className="flex justify-end w-full p-2  bg-[#F2F2F2]  rounded-b-lg">
					{showCancel ? (
						<span
							className="px-4 py-2 my-auto mr-3 font-medium text-gray-900 bg-white rounded cursor-pointer"
							onClick={onClose}
						>
							Cancel
						</span>
					) : null}
					{buttonComponent ?? (
						<Button
							onClick={() => {
								onSuccess();
								onClose();
							}}
							className={twMerge(
								"text-sm bg-black text-white hover:bg-gray-800 focus:ring-4 focus:ring-gray-300 font-medium rounded-lg px-5 py-2.5 mr-2 mb-2",
								type === "dark" ? "px-8" : "",
							)}
						>
							{buttonText}
						</Button>
					)}
				</div>
			</ModalContent>
		</Modal>
	);
};

export default WarningModal;
