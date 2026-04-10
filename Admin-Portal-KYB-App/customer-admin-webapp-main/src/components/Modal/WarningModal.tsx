import React from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import classNames from "classnames";
import Button from "../Button";
import Modal from "./Modal";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	cardColorClass?: string;
	onSucess: () => void;
	title: string;
	description: string;
	buttonText: string;
	buttonComponent?: React.ReactNode;
	type: "success" | "warning" | "danger" | "dark";
	hideIcon?: string;
	showIcon?: boolean;
	showCancel?: boolean;
	isLoading?: boolean;
};

const WarningModal = ({
	title,
	description,
	buttonText,
	isOpen,
	type,
	onClose,
	onSucess,
	buttonComponent,
	showIcon = true,
	showCancel = true,
	isLoading = false,
}: Props) => {
	const getIcon = () => {
		switch (type) {
			case "success":
				return (
					<>
						<div className="flex justify-center h-10 mr-2 text-green-600 bg-green-100 border-green-600 rounded-full min-w-10">
							<CheckCircleIcon className="self-center w-ful h-6 text-center text-[#16A34A] " />
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
		<Modal isOpen={isOpen} onClose={onClose} cardColorClass="bg-transparent">
			<div>
				<div className="flex flex-col justify-center flex-1 min-h-full px-3 py-6 rounded-t-lg bg-slate-50 sm:px-6 lg:px-8">
					<div className="flex">
						{showIcon ? getIcon() : null}
						<div className="mt-2">
							<span className="mt-2 font-bold text-base text-[#1F2A37]">
								{title}
							</span>
							<div className="mt-4 text-sm">{description}</div>
						</div>
					</div>
				</div>
				<div className="w-full p-4 flex justify-end bg-[#F2F2F2] rounded-b-lg">
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
							color={type === "success" ? "dark" : type}
							onClick={() => {
								if (!isLoading) {
									onSucess();
									onClose();
								}
							}}
							disabled={isLoading} // Disable button when loading
							className={classNames(
								"text-white text-sm",
								type === "dark" ? "px-8" : "",
							)}
						>
							{isLoading ? "Loading..." : buttonText} {/* Show loading state */}
						</Button>
					)}
				</div>
			</div>
		</Modal>
	);
};

export default WarningModal;
