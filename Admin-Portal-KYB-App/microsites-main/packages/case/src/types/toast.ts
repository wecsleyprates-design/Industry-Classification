import { type ReactNode } from "react";

export interface ToastParams {
	message: string;
	title?: string | ReactNode;
	subtitle?: string | ReactNode;
	icon?: ReactNode;
	dismissible?: boolean;
	onDismiss?: () => void;
	time?: number;
	position?:
		| "top-right"
		| "top-center"
		| "top-left"
		| "bottom-right"
		| "bottom-center"
		| "bottom-left";
	className?: string;
	toastId?: string;
}

export interface ToastAction {
	label: string;
	onClick?: () => void;
	variant?: "primary" | "secondary";
}

export interface ActionToastParams extends Partial<
	Omit<ToastParams, "dismissible">
> {
	actions: ToastAction[];
}
