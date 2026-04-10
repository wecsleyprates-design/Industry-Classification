import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Modal from "@/components/Modal";
import useCustomToast from "@/hooks/useCustomToast";
import { usePurgeBusiness } from "@/services/queries/businesses.query";
import Button from "../Button";

import { URL } from "@/constants/URL";

const PurgeBusinessModal = ({
	isPurgeBusiness,
	setIsPurgeBusiness,
	businessId,
}: {
	isPurgeBusiness: boolean;
	setIsPurgeBusiness: any;
	businessId: string;
}) => {
	const navigate = useNavigate();
	const { successHandler, errorHandler } = useCustomToast();
	const [comment, setComment] = useState("");
	const commentHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.value === "DELETE") setError(false);
		setComment(e.target.value);
	};
	const [error, setError] = useState(false);

	const {
		mutateAsync: purgeBusiness,
		isPending: purgeBusinessLoading,
		error: purgeBusinessError,
	} = usePurgeBusiness();

	const onSubmit = async () => {
		if (comment === "DELETE") {
			await purgeBusiness([businessId]).then(() => {
				successHandler({
					message: "Business purged successfully",
				});
				navigate(URL.BUSINESSES);
			});
		} else {
			setError(true);
		}
	};

	useEffect(() => {
		if (purgeBusinessError) {
			errorHandler(purgeBusinessError);
		}
	}, [purgeBusinessError]);

	return (
		<Modal
			isOpen={isPurgeBusiness}
			onClose={() => {
				setIsPurgeBusiness(false);
			}}
			cardColorClass="bg-white"
			type="Endpoint"
			customWidth="max-w-[480px] p-0 sm:max-w-[480px]"
		>
			<div className="flex flex-row justify-center flex-1 min-h-full px-8 pt-8 pb-8 rounded-t-lg font-inter gap-x-3">
				<div className="flex justify-center w-10 h-10 px-2 text-red-600 rounded-full bg-red-50">
					<ExclamationTriangleIcon className="self-center w-6 h-6" />
				</div>
				<div className="text-gray-950">
					<span className="ml-1 text-base font-semibold">Confirm Deletion</span>
					<div className="mt-2 text-sm">
						Please type DELETE in the box below. Please note that this action
						will delete all records for this business and cannot be undone.
					</div>
					<div className="mt-5">
						<input
							type="text"
							id="purge-button"
							name="purge-button"
							placeholder="Please Type “DELETE” to continue"
							className="w-full h-12 px-4 text-sm border border-gray-200 rounded-lg placeholder:text-gray-500 textarea focus-visible:none font-Inter focus:outline-none focus:ring-0"
							value={comment}
							onChange={commentHandler}
						/>
						{error && (
							<p className="mt-2 text-sm text-red-600" id="email-error">
								Please Type DELETE to continue
							</p>
						)}
					</div>
				</div>
			</div>
			<div className="flex justify-end p-4 border-t rounded-b-lg">
				<Button
					className="h-10 mr-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg cursor-pointer"
					onClick={() => {
						setIsPurgeBusiness(false);
					}}
					outline
					color="transparent"
				>
					Cancel
				</Button>

				<Button
					color="danger"
					className="h-10 text-sm font-medium text-white rounded-lg"
					onClick={onSubmit}
					isLoading={purgeBusinessLoading}
					disabled={purgeBusinessLoading || comment !== "DELETE"}
				>
					Delete
				</Button>
			</div>
		</Modal>
	);
};

export default PurgeBusinessModal;
