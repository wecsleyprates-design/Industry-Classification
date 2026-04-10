import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { type ActionToastParams, type ToastParams } from "@/types/toast";

export const useCustomToast = () => {
	const errorToast = (
		error: unknown | any,
		callback?: () => void,
		options?: Partial<ToastParams>,
	) => {
		let message: string;

		if (typeof error === "string") {
			message = error;
		} else if (axios.isAxiosError(error)) {
			message = error?.response?.data?.message ?? "Something went wrong";
		} else {
			message = error?.message ?? "Something went wrong";
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

	const undoToast = (
		message: any,
		options?: Partial<ToastParams>,
		callback?: () => void,
	) => {
		toast(message, {
			position: options?.position,
			duration: options?.time,
			className: cn("bg-gray-100 text-gray-700", options?.className),
			id: options?.toastId,
			style: {
				height: "auto",
				backgroundColor: "white",
				borderRadius: "12px",
			},
			dismissible: true,
		});
		callback?.();
	};

	const persistentToast = (options: Partial<ToastParams>) => {
		const content = (
			<div className="flex items-center gap-3">
				{options?.icon && (
					<div className="flex-shrink-0">{options.icon}</div>
				)}
				<div className="flex flex-col gap-1 flex-1">
					{options?.title && (
						<div className="font-semibold text-sm text-gray-900">
							{options.title}
						</div>
					)}
					{options?.subtitle && (
						<div className="text-xs text-gray-600">
							{options.subtitle}
						</div>
					)}
				</div>
				{options?.dismissible && (
					<button
						type="button"
						onClick={() => {
							toast.dismiss(options?.toastId);
							options?.onDismiss?.();
						}}
						className="flex-shrink-0 text-gray-800 hover:text-gray-950 transition-colors"
					>
						<XIcon className="h-5 w-5" />
					</button>
				)}
			</div>
		);

		toast(content, {
			position: options?.position ?? "bottom-right",
			duration: Infinity,
			className: cn(
				"bg-white border border-gray-200",
				options?.className,
			),
			id: options?.toastId,
			style: {
				height: "auto",
				backgroundColor: "white",
				borderRadius: "12px",
				padding: "16px",
			},
			dismissible: false,
		});
	};

	const actionToast = (options: ActionToastParams) => {
		const content = (
			<div className="flex flex-row">
				<div className="flex items-center gap-3 pl-4 py-4 pr-2">
					{options?.icon && (
						<div className="flex-shrink-0">{options.icon}</div>
					)}
					<div className="flex flex-col gap-1 flex-1">
						{options?.title && (
							<div className="font-semibold text-sm text-gray-900">
								{options.title}
							</div>
						)}
						{options?.subtitle && (
							<div className="text-xs text-gray-600">
								{options.subtitle}
							</div>
						)}
					</div>
				</div>

				<div className="flex flex-col border-l border-gray-200 divide-y divide-gray-200">
					{options.actions.map((action, index) => (
						<button
							key={index}
							type="button"
							onClick={() => {
								action.onClick?.();
							}}
							className={cn(
								"flex-1 px-4 py-2 transition-colors whitespace-nowrap",
								(action.variant ?? "primary") === "primary"
									? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
									: "text-gray-600 hover:text-gray-700 hover:bg-gray-50",
							)}
						>
							{action.label}
						</button>
					))}
				</div>
			</div>
		);

		toast(content, {
			position: options?.position ?? "bottom-right",
			duration: Infinity,
			className: cn(
				"bg-white border border-gray-200",
				options?.className,
			),
			id: options?.toastId,
			style: {
				height: "auto",
				backgroundColor: "white",
				borderRadius: "12px",
				// Padding is handled by the content itself
				padding: "0px",
			},
			dismissible: false,
		});
	};

	return {
		errorToast,
		successToast,
		warningToast,
		infoToast,
		defaultToast,
		undoToast,
		persistentToast,
		actionToast,
	};
};
