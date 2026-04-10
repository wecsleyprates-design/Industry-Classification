import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
	ArrowLeftIcon,
	ClipboardIcon,
	PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { type AxiosError } from "axios";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { capitalize, getStatusType, sortEventList } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useDeleteWebhookEndpoint,
	useEditWebhookEndpointEvents,
	useGetWebhookEndpointById,
	useGetWebhookEndpointSecret,
	useGetWebhookEvents,
} from "@/services/queries/webhook.query";
import useAuthStore from "@/store/useAuthStore";
import AddEndpointModal from "./AddEndpointModal";
import WebhookDetailHistory from "./WebhookDetailHistory";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";

const WebhookDetail = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const permissions = useAuthStore((state) => state.permissions);
	const slug = useParams().slug;
	const navigate = useNavigate();
	const [isDelete, setIsDelete] = useState(false);

	const [showModal, setShowModal] = useState<boolean>(false);
	const [itemsAdded, setItemsAdded] = useState<Record<string, boolean>>({});
	const { successHandler, errorHandler } = useCustomToast();

	const {
		data: webHookEventsData,
		error: webHookEventsError,
		isLoading: webhookEventsLoading,
	} = useGetWebhookEvents();

	const {
		data: webhookEndpointData,
		isLoading: webhookEndpointLoading,
		error: webhookEndpointError,
		refetch: webhookEndpointRefetch,
	} = useGetWebhookEndpointById(customerId, String(slug));

	const { data: webhookSecretData, isLoading: WebhookSecretLoading } =
		useGetWebhookEndpointSecret(customerId, String(slug));

	const { mutateAsync: editEndpointEvent, error: editEndpointEventError } =
		useEditWebhookEndpointEvents();

	const { mutateAsync: deleteEndpointEvent, isPending: deleteEndpointLoading } =
		useDeleteWebhookEndpoint();

	const handleSaveChanges = (item: any) => {
		const url = webhookEndpointData?.data?.url ?? "";

		const trueEvents = Object.keys(item).filter((key) => item[key] === true);
		if (trueEvents.length === 0) {
			errorHandler({
				message: "Please add at least 1 event to continue.",
				toastId: "selectEvent",
			});
			return;
		}
		void editEndpointEvent({
			body: { url, events: trueEvents },
			customerId,
			endpointId: String(slug),
		}).then(() => {
			void webhookEndpointRefetch().then(() => {
				setShowModal(false);
				successHandler({
					message: "Event list has been updated!",
					toastId: "editEvent",
				});
			});
		});
	};

	useEffect(() => {
		if (webhookEndpointData && !showModal)
			setItemsAdded(
				Object.fromEntries(
					webhookEndpointData?.data?.events.map((event) => [event, true]),
				) ?? {},
			);
	}, [webhookEndpointData, showModal]);

	useEffect(() => {
		if (editEndpointEventError) {
			errorHandler(editEndpointEventError);
		}
	}, [editEndpointEventError]);

	useEffect(() => {
		if (webHookEventsError) {
			errorHandler(webHookEventsError);
			if ((webHookEventsError as AxiosError)?.response?.status === 405) {
				navigate(URL.DASHBOARD);
			}
		}
	}, [webHookEventsError]);

	useEffect(() => {
		if (webhookEndpointError) {
			errorHandler(webhookEndpointError);
			navigate(URL.DASHBOARD);
		}
	}, [webhookEndpointError]);

	return (
		<>
			{webhookEndpointLoading ||
			WebhookSecretLoading ||
			webhookEventsLoading ? (
				<FullPageLoader />
			) : (
				<>
					<div className="justify-start bg-white rounded-t-3xl">
						<div className="flex items-center px-5 pt-6">
							<ArrowLeftIcon
								className="mr-2 cursor-pointer min-w-fit"
								width={16}
								height={16}
								onClick={() => {
									navigate(URL.MANAGE_ENDPOINTS);
								}}
							/>
							<h3 className="text-base font-semibold text-gray-900">
								{webhookEndpointData?.data?.url}
							</h3>
						</div>
						<div className="items-center block p-6 overflow-y-auto text-gray-500 border-b-2 sm:flex">
							<div className="flex flex-col pr-10 w-fit">
								<span className="mb-2 text-xs font-medium">Status</span>

								<StatusBadge
									type={getStatusType(webhookEndpointData?.data?.status ?? "")}
									text={capitalize(
										webhookEndpointData?.data?.status ?? "",
									)?.replace(/_/g, " ")}
								/>
							</div>

							<div className="flex flex-col w-2/3 pr-10 sm:w-auto">
								<span className="mb-2 text-xs font-medium">Listening for</span>
								<span className="flex items-center p-1 text-xs font-medium text-black bg-gray-100 rounded-md w-fit">
									{webhookEndpointData?.data?.events?.length} Events
									<button
										disabled={!permissions[MODULES.SETTINGS]?.write}
										onClick={() => {
											setShowModal(true);
										}}
									>
										<PencilSquareIcon className="w-[12.5px] h-[12.5px] ml-1 text-black" />
									</button>
								</span>
							</div>

							<div className="flex flex-col">
								<span className="justify-start mb-2 text-xs font-medium">
									Secret Token
								</span>
								<span className="font-mono bg-blue-50 px-2 rounded text-xs font-medium flex text-blue-600 p-0.5 w-fit items-center">
									{webhookSecretData?.data?.secret}
									<button
										onClick={async () => {
											await navigator?.clipboard
												.writeText(webhookSecretData?.data?.secret ?? "")
												.then(() => {
													successHandler({
														message: "Secret token copied!",
														toastId: "secretTokenCopied",
													});
												});
										}}
									>
										<ClipboardIcon className="w-[14px] h-[14px] m-1" />
									</button>
								</span>
							</div>
						</div>
					</div>
					<WebhookDetailHistory />
					{
						<div className="fixed bottom-0 z-50 flex items-center justify-between w-full h-16 -ml-4 bg-white shadow shadow-gray-400 sm:-ml-8">
							<div></div>
							<div className="pr-8 mr-2 space-x-2 border-none sm:mr-10 lg:mr-80 truncate">
								<Button
									color="transparent"
									type="button"
									outline
									className="text-red-600 bg-transparent truncate rounded-lg border-gray-200 hover:bg-red-200"
									onClick={() => {
										setIsDelete(true);
									}}
								>
									Delete Endpoint
								</Button>
							</div>
						</div>
					}
					{isDelete && (
						<WarningModal
							isOpen={isDelete}
							onClose={() => {
								setIsDelete(false);
							}}
							onSucess={async () => {
								await deleteEndpointEvent({
									customerId: String(getItem(LOCALSTORAGE.customerId)),
									endpointId: String(slug),
								})
									.then(() => {
										navigate(URL.MANAGE_ENDPOINTS);
									})
									.catch((error) => {
										errorHandler(error);
									});
							}}
							title={"Delete Endpoint?"}
							description={"This action cannot be undone."}
							buttonText={"Delete"}
							type={"danger"}
							isLoading={deleteEndpointLoading}
						/>
					)}
					{showModal && (
						<AddEndpointModal
							isOpen={showModal}
							onClose={() => {
								setShowModal(false);
							}}
							onSuccess={handleSaveChanges}
							setItems={setItemsAdded}
							itemsAdded={itemsAdded}
							eventList={sortEventList(webHookEventsData?.data)}
							isEdit={true}
						/>
					)}
				</>
			)}
		</>
	);
};

export default WebhookDetail;
