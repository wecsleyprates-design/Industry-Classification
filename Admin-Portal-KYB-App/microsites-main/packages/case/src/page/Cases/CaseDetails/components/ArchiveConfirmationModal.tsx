import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { Button } from "@/ui/button";
import {
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
} from "@/ui/modal";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
};

const ArchiveConfirmationModal: React.FC<Props> = ({
	isOpen,
	onClose,
	onSuccess,
}) => {
	return (
		<Modal open={isOpen} onOpenChange={onClose}>
			<ModalContent className="gap-0 px-4 py-2">
				<ModalHeader
					onClose={onClose}
					description="Archive Case"
					className="px-2"
					title={
						<div className="flex flex-row items-center gap-2 justify-between">
							<ExclamationTriangleIcon className="text-red-600 size-5" />
							Archive Case
						</div>
					}
				/>
				<ModalBody>
					Are you sure you want to archive this case?
				</ModalBody>
				<ModalFooter className="flex flex-row items-center justify-end p-2">
					<Button
						variant="secondary"
						className="bg-gray-100"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onSuccess}>
						Archive
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
};

export default ArchiveConfirmationModal;
