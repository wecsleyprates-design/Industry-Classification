import { toast } from "react-toastify";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import { type ToastParams } from "@/types/toast";

import { log } from "@/Logger";

interface CustomToastProps {
	message: string;
	icon: React.JSX.Element;
	bgColor: string;
	textColor: string;
}

const CustomToast = ({
	message,
	icon,
	bgColor,
	textColor,
}: CustomToastProps) => (
	<div
		className={`flex items-center justify-between w-full p-2 px-2 ${bgColor}`}
	>
		<div className="flex items-center">
			<div className="w-fit">{icon}</div>
			<span className={`ml-4 ${textColor} text-sm font-medium`}>{message}</span>
		</div>
		<div className="ml-2 w-fit">
			<svg
				width="14"
				height="14"
				viewBox="0 0 14 14"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M8.41152 7L13.6952 1.71628C13.7906 1.62419 13.8666 1.51404 13.919 1.39225C13.9713 1.27046 13.9988 1.13947 14 1.00692C14.0011 0.874375 13.9759 0.742926 13.9257 0.620245C13.8755 0.497564 13.8013 0.386108 13.7076 0.29238C13.6139 0.198652 13.5024 0.124529 13.3798 0.0743358C13.2571 0.0241431 13.1256 -0.0011141 12.9931 3.76909e-05C12.8605 0.00118949 12.7295 0.0287274 12.6078 0.0810446C12.486 0.133362 12.3758 0.209411 12.2837 0.304753L7 5.58848L1.71628 0.304753C1.528 0.122915 1.27584 0.0222964 1.01411 0.0245708C0.752369 0.0268452 0.501997 0.13183 0.316913 0.316913C0.13183 0.501997 0.0268452 0.752369 0.0245708 1.01411C0.0222964 1.27584 0.122915 1.528 0.304753 1.71628L5.58848 7L0.304753 12.2837C0.209411 12.3758 0.133362 12.486 0.0810446 12.6078C0.0287274 12.7295 0.00118949 12.8605 3.76909e-05 12.9931C-0.0011141 13.1256 0.0241431 13.2571 0.0743358 13.3798C0.124529 13.5024 0.198652 13.6139 0.29238 13.7076C0.386108 13.8013 0.497564 13.8755 0.620245 13.9257C0.742926 13.9759 0.874375 14.0011 1.00692 14C1.13947 13.9988 1.27046 13.9713 1.39225 13.919C1.51404 13.8666 1.62419 13.7906 1.71628 13.6952L7 8.41152L12.2837 13.6952C12.472 13.8771 12.7242 13.9777 12.9859 13.9754C13.2476 13.9732 13.498 13.8682 13.6831 13.6831C13.8682 13.498 13.9732 13.2476 13.9754 12.9859C13.9777 12.7242 13.8771 12.472 13.6952 12.2837L8.41152 7Z"
					fill="#6B7280"
				/>
			</svg>
		</div>
	</div>
);

const CustomSuccessToast = ({ message }: { message: string }) => (
	<CustomToast
		message={message}
		icon={
			<svg
				width="20"
				height="20"
				viewBox="0 0 20 20"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M7 10.75L9.25 13L13 7.75M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z"
					stroke="#22C55E"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		}
		bgColor="bg-white"
		textColor="text-gray-800"
	/>
);

const CustomWarningToast = ({ message }: { message: string }) => (
	<CustomToast
		message={message}
		icon={<ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />}
		bgColor="bg-white"
		textColor="text-gray-800"
	/>
);

const CustomErrorToast = ({ message }: { message: string }) => (
	<CustomToast
		message={message}
		icon={
			<svg
				width="20"
				height="20"
				viewBox="0 0 20 20"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M10 7V10.75M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10ZM10 13.75H10.0075V13.7575H10V13.75Z"
					stroke="#EF4444"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		}
		bgColor="bg-white"
		textColor="text-gray-800"
	/>
);

// Hook for custom toast functionality
const useCustomToast = () => {
	const errorHandler = (
		error: unknown | any,
		callback?: () => void,
		options?: Partial<ToastParams>,
	) => {
		const message = axios.isAxiosError(error)
			? error?.response?.data?.message
			: (error?.message ?? "Something went wrong");

		if (error instanceof Error) {
			log.error(error, `Toast error message: ${message}`);
		} else {
			log.error(`Toast error message: ${message}`, { error: error });
		}

		toast(<CustomErrorToast message={message} />, {
			position: options?.position || "bottom-right",
			autoClose: options?.time || 5000,
			className: options?.className,
			hideProgressBar: true,
			closeButton: false,
			toastId: options?.toastId ?? error.toastId,
		});

		callback?.();
	};

	const successHandler = (params: ToastParams, callback?: () => void) => {
		toast(<CustomSuccessToast message={params.message} />, {
			position: params?.position || "bottom-right",
			autoClose: params?.time || 5000,
			className: params?.className,
			hideProgressBar: true,
			closeButton: false,
			toastId: params?.toastId,
		});

		callback?.();
	};

	const warningHandler = (params: ToastParams, callback?: () => void) => {
		toast(<CustomWarningToast message={params.message} />, {
			position: params?.position || "bottom-right",
			autoClose: params?.time || 5000,
			className: params?.className,
			hideProgressBar: true,
			closeButton: false,
			toastId: params?.toastId,
		});

		callback?.();
	};

	return { errorHandler, successHandler, warningHandler };
};

export default useCustomToast;
