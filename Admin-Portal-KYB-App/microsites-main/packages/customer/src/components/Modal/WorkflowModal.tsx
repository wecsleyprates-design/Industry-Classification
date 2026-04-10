import React from "react";
import Button from "../Button";

import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";

interface WorkflowModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSucess: () => void | Promise<void>;
	title: string;
	description: string | React.ReactNode;
	buttonText: string;
	isLoading?: boolean;
	showCancel?: boolean;
}

const WorkflowModal: React.FC<WorkflowModalProps> = ({
	isOpen,
	onClose,
	onSucess,
	title,
	description,
	buttonText,
	isLoading = false,
	showCancel = true,
}) => {
	const [isProcessing, setIsProcessing] = React.useState(false);

	const handleConfirm = async () => {
		if (isLoading || isProcessing) return;

		setIsProcessing(true);
		try {
			await onSucess();
			onClose();
		} catch (error) {
			console.error("Error in workflow modal:", error);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<ModalContent className="gap-0 p-0 min-w-[200px]">
				<div className="text-gray-800 bg-white rounded-lg">
					<ModalHeader
						title={title}
						onClose={onClose}
						className="py-4 px-6 border-b border-gray-200"
					/>
					<ModalBody className="text-sm p-6">{description}</ModalBody>
					<ModalFooter className="flex justify-end gap-2 py-4 px-5">
						{showCancel ? (
							<Button
								type="button"
								color="white"
								onClick={onClose}
								disabled={isLoading || isProcessing}
								className="text-xs font-medium text-blue-600 py-2 px-4 rounded-lg"
							>
								Cancel
							</Button>
						) : null}
						<Button
							type="button"
							color="blue"
							onClick={handleConfirm}
							disabled={isLoading || isProcessing}
							className="text-xs font-medium text-white py-2 px-4 rounded-lg"
						>
							{isLoading || isProcessing ? "Loading..." : buttonText}
						</Button>
					</ModalFooter>
				</div>
			</ModalContent>
		</Modal>
	);
};

export default WorkflowModal;
