import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Modal from "@/components/Modal";
import UpdatePasswordForm from "./UpdatePasswordForm";

interface Props {
	open: boolean;
	handleCloseModal: () => void;
}

const UpdatePasswordModal: React.FC<Props> = ({ open, handleCloseModal }) => {
	const successHandler = () => {
		handleCloseModal();
	};
	return (
		<Modal isOpen={open} onClose={handleCloseModal}>
			<div className="absolute right-4 top-4 hidden pr-4 pt-4 sm:block">
				<button
					type="button"
					className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none active:ring-2 active:ring-indigo-500 active:ring-offset-2"
					onClick={handleCloseModal}
				>
					<span className="sr-only">Close</span>
					<XMarkIcon className="h-6 w-6" aria-hidden="true" />
				</button>
			</div>
			<UpdatePasswordForm successHandler={successHandler} />
		</Modal>
	);
};

export default UpdatePasswordModal;
