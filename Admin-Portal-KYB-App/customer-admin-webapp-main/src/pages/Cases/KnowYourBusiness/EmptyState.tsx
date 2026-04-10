import { CursorArrowRaysIcon } from "@heroicons/react/20/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { type UseMutateAsyncFunction } from "@tanstack/react-query";
import { twMerge } from "tailwind-merge";
import { type BusinessVerificationEntityRecord } from "@/types/businessEntityVerification";

export const EmptyState = ({
	handleSubmit,
	loading = false,
}: {
	handleSubmit: UseMutateAsyncFunction<
		BusinessVerificationEntityRecord,
		unknown,
		void,
		unknown
	>;
	loading: boolean;
}) => (
	<div className="text-center">
		<ExclamationTriangleIcon
			className="w-12 h-12 mx-auto text-gray-700"
			aria-hidden="true"
		/>

		<h3 className="mt-2 text-sm font-semibold text-gray-900">
			Missing Business Verification Details
		</h3>
		<p className="mt-1 text-sm text-gray-500">
			Let's fix this by submitting an order to verify the business
		</p>
		<div className="mt-6">
			<button
				type="button"
				onClick={async () => {
					await handleSubmit();
				}}
				disabled={loading}
				className={twMerge(
					"inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
					loading && "opacity-50 cursor-wait bg-indigo-400 hover:bg-indigo-400",
				)}
			>
				<CursorArrowRaysIcon
					className="-ml-0.5 mr-1.5 h-5 w-5"
					aria-hidden="true"
				/>
				Submit Order
			</button>
		</div>
	</div>
);
