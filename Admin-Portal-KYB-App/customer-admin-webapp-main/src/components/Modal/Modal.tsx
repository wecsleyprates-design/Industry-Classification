import type { ReactNode } from "react";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { twMerge } from "tailwind-merge";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	cardColorClass?: string;
	type?: string;
	customWidth?: string;
	closeOnBackdropClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
	type = "Warning",
	isOpen,
	onClose,
	children,
	cardColorClass = "bg-white",
	customWidth = "w-[95%] sm:w-[75%] max-w-2xl",
	closeOnBackdropClick = true,
}) => {
	const handleClose = () => {
		if (closeOnBackdropClick) onClose();
	};

	return (
		<Dialog open={isOpen} onClose={handleClose} className="relative z-50">
			<DialogBackdrop
				transition
				className="fixed inset-0 bg-gray-500/75 transition-opacity duration-300 ease-out data-closed:opacity-0 data-enter:ease-out data-leave:ease-in data-leave:duration-200"
			/>

			<div className="fixed inset-0 z-10 w-screen overflow-y-auto">
				<div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
					<DialogPanel
						transition
						className={twMerge(
							"relative transform overflow-hidden rounded-lg px-4 pb-4 pt-5 text-left transition-all duration-300 ease-out data-closed:translate-y-4 data-closed:opacity-0 data-closed:sm:translate-y-0 data-closed:sm:scale-95 data-enter:ease-out data-leave:ease-in data-leave:duration-200",
							type === "Warning"
								? "w-full sm:my-8 sm:w-full sm:max-w-lg sm:p-6"
								: `sm:my-8 ${customWidth}`,
							cardColorClass,
						)}
					>
						{children}
					</DialogPanel>
				</div>
			</div>
		</Dialog>
	);
};

export default Modal;
