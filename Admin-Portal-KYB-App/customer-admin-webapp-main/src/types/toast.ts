export interface ToastParams {
	message: string;
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
