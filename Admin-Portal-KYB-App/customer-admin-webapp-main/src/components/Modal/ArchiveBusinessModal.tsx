import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Modal from "@/components/Modal";
import useCustomToast from "@/hooks/useCustomToast";
import { useArchiveBusiness } from "@/services/queries/businesses.query";
import Button from "../Button";

import { URL } from "@/constants/URL";

const ArchiveBusinessModal = ({
	isArchiveBusiness,
	setIsArchiveBusiness,
	businessId,
}: {
	isArchiveBusiness: boolean;
	setIsArchiveBusiness: React.Dispatch<React.SetStateAction<boolean>>;
	businessId: string;
}) => {
	const navigate = useNavigate();
	const { successHandler, errorHandler } = useCustomToast();

	const {
		mutateAsync: archiveBusiness,
		isPending: archiveBusinessLoading,
		error: archiveBusinessError,
	} = useArchiveBusiness();

	useEffect(() => {
		if (archiveBusinessError) {
			errorHandler(archiveBusinessError);
		}
	}, [archiveBusinessError, errorHandler]);

	if (!businessId) return null;

	const onSubmit = async () => {
		try {
			await archiveBusiness([businessId]);
			successHandler({
				message: "Business archived successfully.",
			});
			setIsArchiveBusiness(false);
			navigate(URL.BUSINESSES);
		} catch (err: any) {
			errorHandler(err);
		}
	};

	return (
		<Modal
			isOpen={isArchiveBusiness}
			onClose={() => {
				setIsArchiveBusiness(false);
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
					<span className="ml-1 text-base font-semibold">Archive Business</span>
					<div className="mt-2 text-sm">
						Are you sure you want to archive this business?
					</div>
				</div>
			</div>
			<div className="flex justify-end p-4 border-t rounded-b-lg">
				<Button
					className="h-10 mr-3 text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg cursor-pointer"
					onClick={() => {
						setIsArchiveBusiness(false);
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
					isLoading={archiveBusinessLoading}
				>
					Archive
				</Button>
			</div>
		</Modal>
	);
};

export default ArchiveBusinessModal;
