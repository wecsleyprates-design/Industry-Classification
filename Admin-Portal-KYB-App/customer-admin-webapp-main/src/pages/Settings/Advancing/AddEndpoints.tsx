import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import {
	ArrowLeftIcon,
	ArrowTopRightOnSquareIcon,
	DocumentTextIcon,
	PlusIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { type AxiosError } from "axios";
import { motion } from "framer-motion";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import { WarningModal } from "@/components/Modal";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { sortEventList } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { createWebhookSchema } from "@/lib/validation";
import {
	useCreateWebhookEndpoint,
	useGetWebhookEvents,
} from "@/services/queries/webhook.query";
import { type IAddWebhook } from "@/types/webhooks";
import AddEndpointModal from "./AddEndpointModal";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

const AddEndpoints = () => {
	const navigate = useNavigate();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { errorHandler, successHandler } = useCustomToast();
	const [showModal, setShowModal] = useState<boolean>(false);
	const [discardSaveModal, setDiscardSaveModal] = useState<boolean>(false);
	const [itemsAdded, setItemsAdded] = useState<Record<string, boolean>>({});

	const {
		register,
		handleSubmit,
		getValues,
		watch,
		setValue,
		formState: { errors, isDirty },
	} = useForm<IAddWebhook>({
		resolver: yupResolver(createWebhookSchema),
	});

	const {
		mutateAsync: createWebhookEndpoint,
		error: createWebhookEndpointError,
	} = useCreateWebhookEndpoint();

	const {
		data: webHookEventsData,
		error: webHookEventsError,
		isLoading: webhookEventsLoading,
	} = useGetWebhookEvents();

	const handleSaveChanges = async () => {
		const url = getValues().url;

		const formattedUrl =
			url.startsWith("http://") || url.startsWith("https://")
				? url
				: `https://${url}`;

		await createWebhookEndpoint({
			body: { url: formattedUrl, events: Object.keys(itemsAdded) },
			customerId,
		}).then((e) => {
			successHandler({ message: "Endpoint created!" });
			navigate(URL.ENDPOINT_DETAILS.replace(":slug", e?.data.id));
		});
	};

	const handleDiscardChanges = () => {
		setItemsAdded({});
		setValue("url", "");
	};

	useEffect(() => {
		if (webHookEventsError) {
			errorHandler(webHookEventsError);
			if ((webHookEventsError as AxiosError)?.response?.status === 405) {
				navigate(URL.DASHBOARD);
			}
		}
	}, [webHookEventsError]);

	const onSubmit = async () => {
		await handleSaveChanges();
	};

	useEffect(() => {
		if (createWebhookEndpointError) {
			if (
				(createWebhookEndpointError as AxiosError)?.response?.status === 405
			) {
				errorHandler(createWebhookEndpointError);
				navigate(URL.DASHBOARD);
			}
			errorHandler(createWebhookEndpointError);
		}
	}, [createWebhookEndpointError]);

	return (
		<>
			{webhookEventsLoading ? (
				<FullPageLoader />
			) : (
				<form onSubmit={handleSubmit(onSubmit)}>
					<div className="grid grid-cols-12 py-5 bg-white rounded-3xl">
						<div className="flex items-center col-span-12 px-4 pb-5 overflow-y-auto border-b-2 sm:col-span-12">
							<button
								type="button"
								onClick={() => {
									navigate(URL.MANAGE_ENDPOINTS);
								}}
							>
								<ArrowLeftIcon className="w-4 h-4 mr-2" />
							</button>
							<h3 className="text-base font-semibold">Add an Endpoint</h3>
							<a
								href="https://docs.worthai.com/webhooks/webhooks"
								className="flex items-center ml-4 text-xs text-blue-600 hover:underline"
								target="_blank"
								rel="noreferrer"
							>
								Documentation
								<ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2 text-blue-600" />
							</a>
						</div>

						<div className="col-span-12 sm:col-span-6 bg-white sm:col-start-0 p-5 mt-0.5 pr-4 ">
							<div className="mb-8">
								<label className="block mb-2 text-base font-medium ">
									Endpoint URL
									<span className="text-sm text-red-600 ">*</span>
								</label>
								<p className="mb-4 text-sm text-gray-600">
									Provide the URL you'd like to receive notifications from the
									events you subscribe to.
								</p>
								<Input
									register={register}
									name="url"
									errors={errors}
									placeholder=" https://"
									className="w-full p-2 rounded-lg"
								/>
							</div>
							<label className="block text-base font-medium ">
								Add Events<span className="text-sm text-red-600 ">*</span>
							</label>
							<p className="py-2 text-sm text-gray-600">
								Select the events you subscribe to.
							</p>

							<div className="mt-2">
								<Button
									onClick={() => {
										setShowModal(true);
									}}
									type="button"
									className="flex items-center justify-center px-4 py-2 text-blue-600 border border-gray-300 rounded-lg hover:bg-blue-100 focus:outline-none"
									size="lg"
								>
									{Object.keys(itemsAdded).length < 1 && (
										<span className="flex items-center text-sm px-2 py-0.5">
											<PlusIcon className="w-4 h-4 mr-1" /> Add Event
										</span>
									)}
									{Object.keys(itemsAdded).length > 0 && (
										<span className="flex items-center text-sm">
											<PlusIcon className="w-4 h-4 mr-1" />{" "}
											{
												Object.values(itemsAdded).filter((value) => value)
													.length
											}{" "}
											Events Added
										</span>
									)}
								</Button>
							</div>
						</div>
						<div className="col-span-12 sm:col-span-6  bg-white sm:col-start-0 p-5 mt-0.5  pl-4">
							{/* Implementation for code editor */}
							{/* <CodeEditor /> */}
							<div className="flex flex-col items-center justify-center pt-2 pb-2 md:h-full h-80 bg-gray-50 rounded-2xl ">
								<div className="mb-4 font-normal text-center border-gray-200">
									<div className="flex items-center p-2 mx-auto bg-blue-50 rounded-xl w-14 h-14">
										<DocumentTextIcon className="flex w-8 h-8 mx-auto text-blue-700" />
									</div>
									<div className="mt-2 text-base font-semibold">
										Need Help Getting Started?
									</div>
									<div className="mx-8 mt-1 text-sm font-normal text-gray-500">
										Get guidance on setting up your endpoints by reviewing our
										webhook documentation.
									</div>
									<a
										href="https://docs.worthai.com/webhooks/webhooks"
										className="flex items-center p-3 py-2 mx-auto mt-4 text-xs font-medium text-blue-600 border border-blue-600 rounded-lg w-fit hover:underline"
										target="_blank"
										rel="noreferrer"
									>
										View Documentation
										<ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2 text-blue-600" />
									</a>
								</div>
							</div>
						</div>

						{/* footer */}
						<motion.div
							initial={{ y: "100%", opacity: 0 }}
							animate={{
								y:
									isDirty &&
									watch().url !== "" &&
									Object.keys(itemsAdded).length
										? "0%"
										: "100%",
								opacity:
									isDirty &&
									watch().url !== "" &&
									Object.keys(itemsAdded).length
										? 1
										: 0,
							}}
							transition={{ duration: 0.5 }}
							className="fixed bottom-0 z-50 flex items-center justify-between w-full h-[72px] -ml-4 bg-white border-t border-[#E5E7EB] shadow-sm sm:-ml-8 shrink-0"
						>
							<div></div>
							<div className="mr-2 space-x-2 border-none sm:mr-10 lg:mr-80">
								<Button
									color="transparent"
									type="button"
									outline
									className="w-[100px] text-blue-500 bg-transparent rounded-lg border-gray-300 hover:bg-gray-100"
									onClick={() => {
										setDiscardSaveModal(true);
									}}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									color="dark"
									className="w-[100px] text-white bg-blue-600 rounded-lg border-none hover:bg-blue-700"
									// isLoading={}
								>
									Save
								</Button>
							</div>
						</motion.div>
					</div>
				</form>
			)}
			{showModal && (
				<AddEndpointModal
					isOpen={showModal}
					onClose={() => {
						setShowModal(false);
					}}
					onSuccess={() => {}}
					setItems={setItemsAdded}
					itemsAdded={itemsAdded}
					eventList={sortEventList(webHookEventsData?.data)}
				/>
			)}
			{discardSaveModal && (
				<WarningModal
					isOpen={discardSaveModal}
					onClose={() => {
						setDiscardSaveModal(false);
						handleDiscardChanges();
					}}
					onSucess={() => {
						navigate(URL.MANAGE_ENDPOINTS);
					}}
					title={"Do you want to discard Changes"}
					description={"Are you sure you want to discard the configurations?"}
					buttonText={"Yes"}
					type={"dark"}
				/>
			)}
		</>
	);
};

export default AddEndpoints;
