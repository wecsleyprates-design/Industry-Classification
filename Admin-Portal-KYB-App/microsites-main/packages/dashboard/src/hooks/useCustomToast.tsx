import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import { toast } from "sonner";
import { type ToastParams } from "@/lib/types/toast";
import { cn } from "@/lib/utils";

export const useCustomToast = () => {
	const errorToast = (
		error: unknown | string,
		callback?: () => void,
		options?: Partial<ToastParams>,
	) => {
		let message: string;

		if (typeof error === "string") {
			message = error;
		} else if (axios.isAxiosError(error)) {
			message = error?.response?.data?.message ?? "Something went wrong";
		} else {
			message = (error as any)?.message ?? "Something went wrong";
		}

		toast(message, {
			icon: <XCircleIcon className="h-5 w-5" />,
			position: options?.position ?? "bottom-right",
			duration: options?.time,
			className: cn("toast-error", options?.className),
			id: options?.toastId,
		});

		callback?.();
	};

	const successToast = (
		message: string,
		callback?: () => void,
		options?: Partial<ToastParams>,
	) => {
		toast(message, {
			icon: <CheckCircleIcon className="h-5 w-5" />,
			position: options?.position ?? "bottom-right",
			duration: options?.time,
			className: cn("toast-success", options?.className),
		});
		callback?.();
	};

	const warningToast = (
		message: string,
		options?: Partial<ToastParams>,
		callback?: () => void,
	) => {
		toast(message, {
			icon: <ExclamationTriangleIcon className="h-5 w-5" />,
			position: options?.position ?? "bottom-right",
			duration: options?.time,
			className: cn("toast-warning", options?.className),
			id: options?.toastId,
		});
		callback?.();
	};

	const infoToast = (
		message: string,
		options?: Partial<ToastParams>,
		callback?: () => void,
	) => {
		toast(message, {
			icon: <InformationCircleIcon className="h-5 w-5" />,
			position: options?.position ?? "bottom-right",
			duration: options?.time,
			className: cn("toast-info", options?.className),
			id: options?.toastId,
		});
		callback?.();
	};

	const defaultToast = (
		message: string,
		options?: Partial<ToastParams>,
		callback?: () => void,
	) => {
		toast(message, {
			position: options?.position ?? "bottom-right",
			duration: options?.time,
			className: cn("toast-default", options?.className),
			id: options?.toastId,
		});
		callback?.();
	};

	return { errorToast, successToast, warningToast, infoToast, defaultToast };
};
