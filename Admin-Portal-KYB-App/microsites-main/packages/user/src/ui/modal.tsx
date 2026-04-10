import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const Modal = ({
	children,
	...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Root>) => (
	<Dialog.Root {...props}>{children}</Dialog.Root>
);

const ModalContent = ({
	children,
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content>) => {
	return (
		<Dialog.Portal container={document.getElementById("portal-root")}>
			<Dialog.Overlay
				className="fixed inset-0 z-[100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
				style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0 }}
			/>
			<Dialog.Content
				className={cn(
					"fixed left-[50%] top-[40%] z-[100] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
					className,
				)}
				{...props}
			>
				{children}
			</Dialog.Content>
		</Dialog.Portal>
	);
};

interface ModalHeaderProps {
	className?: string;
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	onClose?: () => void;
	description?: string;
}

const ModalHeader = ({
	className,
	title,
	subtitle,
	onClose,
	description = "",
	...props
}: ModalHeaderProps) => (
	<div className={cn("flex flex-col p-4 gap-2", className)} {...props}>
		<div className="flex flex-row items-center justify-between">
			<Dialog.Title className="text-lg font-medium">{title}</Dialog.Title>
			{onClose && (
				<Dialog.Close
					onClick={onClose}
					className="hover:bg-transparent p-0 w-5 h-5"
				>
					<XMarkIcon className="text-gray-800" />
				</Dialog.Close>
			)}
		</div>
		{subtitle && <div>{subtitle}</div>}
		<Dialog.Description className="sr-only">{description}</Dialog.Description>
	</div>
);
const ModalBody = ({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex flex-col gap-4 p-2", className)} {...props}>
		{children}
	</div>
);

const ModalFooter = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
			className,
		)}
		{...props}
	/>
);

export { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter };
