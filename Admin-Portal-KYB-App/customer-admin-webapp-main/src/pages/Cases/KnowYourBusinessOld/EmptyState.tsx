import { CursorArrowRaysIcon } from "@heroicons/react/20/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { type UseMutateAsyncFunction } from "@tanstack/react-query";
import { type BusinessVerificationEntityRecord } from "@/types/businessEntityVerification";

export const EmptyState = ({
	handleSubmit,
}: {
	handleSubmit: UseMutateAsyncFunction<
		BusinessVerificationEntityRecord,
		unknown,
		void,
		unknown
	>;
}) => (
	<div className="text-center">
		<ExclamationTriangleIcon
			className="h-12 w-12 text-gray-700 mx-auto"
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
				className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
