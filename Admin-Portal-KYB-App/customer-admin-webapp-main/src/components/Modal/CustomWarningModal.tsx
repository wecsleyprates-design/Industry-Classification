import React from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import Modal from "./Modal";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	type: "success" | "danger" | "dark";
	onSucess: () => void;
	cardColorClass?: string;
	title: string;
	description: string;
	buttons?: React.JSX.Element;
	buttonComponent?: React.ReactNode;
};

const CustomWarningModal: React.FC<Props> = ({
	isOpen,
	onClose,
	type,
	title,
	description,
	buttons,
}) => {
	let icon;

	switch (type) {
		case "success":
			icon = (
				<div className="w-10 h-10 bg-[#F0FDF4] rounded-full items-center justify-center flex">
					<CheckCircleIcon className="w-5 h-5 text-[#16A34A]" />
				</div>
			);
			break;
		case "danger":
			icon = (
				<div className="bg-[#FEFCE8] rounded-full h-10 w-10 items-center justify-center flex">
					<ExclamationTriangleIcon className="w-5 h-5 text-[#CA8A04]" />
				</div>
			);
			break;
		case "dark":
			break;
		default:
			icon = <CheckCircleIcon />;
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			cardColorClass="bg-white rounded-xl"
		>
			<div className="divide-y ">
				<div className="flex pb-6">
					<div className="items-center content-center w-10 h-10 text-center align-middle">
						{icon}
					</div>
					<div className="mt-1 ml-4 text-[#1F2937] ">
						<h2 className="text-base font-bold">{title}</h2>
						<p className="text-sm font-normal">{description}</p>
					</div>
				</div>
				<div className="pt-3">{buttons}</div>
			</div>
		</Modal>
	);
};

export default CustomWarningModal;
