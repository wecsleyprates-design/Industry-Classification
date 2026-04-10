import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Switch } from "@headlessui/react";
import { CreditCardIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import Button from "@/components/Button";
import Input from "@/components/Input/Input";
import { stripeIntegrationSchema } from "@/lib/validation";
import {
	useCreatePaymentProcessor,
	useGetPaymentProcessors,
} from "@/services/queries/integration.query";
import {
	type ConnectionStatus,
	PLATFORM_ID,
	type StripeFormData,
} from "@/types/paymentProcessor";

const StripeIntegration = () => {
	const [isActive, setIsActive] = useState(false);
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("not-connected");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [accountId, setAccountId] = useState<string | null>(null);
	const [processId, setProcessId] = useState<string | null>(null);

	const getCustomerId = useCallback(() => {
		const rawCustomerId = localStorage.getItem("customerId");
		if (!rawCustomerId) return null;
		return rawCustomerId.replace(/^"|"$/g, "");
	}, []);

	const customerId = getCustomerId();
	const {
		data: processorsResponse,
		isLoading,
		refetch,
	} = useGetPaymentProcessors(customerId);

	const createProcessorMutation = useCreatePaymentProcessor();

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		formState: { errors },
	} = useForm<StripeFormData>({
		defaultValues: {
			nickname: "",
			secretKey: "",
			publishableKey: "",
		},
		resolver: yupResolver(stripeIntegrationSchema),
		mode: "onBlur",
	});

	useEffect(() => {
		const processors = processorsResponse?.data;
		if (processors && processors.length > 0) {
			const stripeProcessor = processors.find(
				(p) => p.platform_id === PLATFORM_ID.STRIPE && !p.deleted_at,
			);

			if (!stripeProcessor && processors.length > 0) {
				const firstProcessor = processors[0];
				if (!firstProcessor.deleted_at) {
					setValue("nickname", firstProcessor.name || "");
					const processorId = firstProcessor.id || null;
					const accountIdValue =
						firstProcessor.metadata?.account?.id ||
						firstProcessor.metadata?.account_id ||
						null;
					setProcessId(processorId);
					setAccountId(accountIdValue);
					setIsActive(firstProcessor.status === "ACTIVE");
					const isConnected = !!(processorId && accountIdValue);
					setConnectionStatus(isConnected ? "connected" : "not-connected");
					return;
				}
			}

			if (stripeProcessor) {
				setValue("nickname", stripeProcessor.name || "");
				const processorId = stripeProcessor.id || null;
				const accountIdValue =
					stripeProcessor.metadata?.account?.id ||
					stripeProcessor.metadata?.account_id ||
					null;
				setProcessId(processorId);
				setAccountId(accountIdValue);
				setIsActive(stripeProcessor.status === "ACTIVE");
				const isConnected = !!(processorId && accountIdValue);
				setConnectionStatus(isConnected ? "connected" : "not-connected");
			}
		}
	}, [processorsResponse, setValue]);

	const onToggle = () => {
		setIsActive(!isActive);
		if (isActive) {
			setConnectionStatus("not-connected");
			setErrorMessage(null);
		}
	};

	const onSubmit = async (data: StripeFormData) => {
		setErrorMessage(null);
		setConnectionStatus("checking");

		if (!customerId) {
			setErrorMessage("Customer ID not found in local storage");
			setConnectionStatus("failed");
			return;
		}

		try {
			const response = await createProcessorMutation.mutateAsync({
				customerId,
				payload: {
					name: data.nickname,
					stripe: {
						publishable_key: data.publishableKey,
						secret_key: data.secretKey,
					},
				},
			});

			if (response?.data) {
				const processorData = response.data;
				const processorId = processorData.id || null;
				const accountIdValue =
					processorData.metadata?.account?.id ||
					processorData.metadata?.account_id ||
					null;
				setAccountId(accountIdValue);
				setProcessId(processorId);
				setIsActive(true);
				const isConnected = !!(processorId && accountIdValue);
				setConnectionStatus(isConnected ? "connected" : "not-connected");
				void refetch();
			} else {
				setConnectionStatus("not-connected");
			}
		} catch (error: any) {
			setConnectionStatus("failed");
			const errorMsg =
				error?.response?.data?.message ||
				error?.message ||
				"Integration unsuccessful. Please check the information provided above and try again.";
			setErrorMessage(errorMsg);
			setAccountId(null);
			setProcessId(null);
		}
	};

	const handleCancel = () => {
		reset();
		setErrorMessage(null);
		setConnectionStatus("not-connected");
		setAccountId(null);
		setProcessId(null);
	};

	const renderConnectionStatus = () => {
		switch (connectionStatus) {
			case "checking":
				return (
					<span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
						Checking...
					</span>
				);
			case "connected":
				return (
					<span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">
						Connected
					</span>
				);
			case "failed":
				return (
					<span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md">
						Failed
					</span>
				);
			case "not-connected":
			default:
				return (
					<span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
						Not Connected
					</span>
				);
		}
	};

	if (isLoading) {
		return (
			<div className="bg-white w-full p-4 border rounded-xl mt-8 border-[#E5E7EB]">
				<div className="flex items-center justify-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white w-full p-4 border rounded-xl mt-8 border-[#E5E7EB]">
			<div className="flex items-start mt-2">
				<div className="flex-shrink-0">
					<div className="flex items-center p-2 ml-2 mr-2 bg-blue-50 rounded-xl w-14 h-14">
						<CreditCardIcon className="w-8 h-8 mx-auto text-blue-700" />
					</div>
				</div>
				<div className="flex flex-grow ml-4 flex-col">
					<div className="flex flex-row justify-between">
						<div className="flex items-start justify-start flex-col">
							<h2 className="mr-2 text-base font-semibold text-gray-800">
								Stripe
							</h2>
							<p className="mt-1.5 text-sm text-gray-500">
								Connect your Stripe account so Worth can submit merchant
								applications on your behalf.
							</p>
						</div>
						<div className="flex items-center justify-end">
							<Switch
								checked={isActive}
								name="isActive"
								onChange={onToggle}
								className={`${isActive ? "bg-blue-600" : "bg-gray-200"}
                  relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2`}
							>
								<span
									aria-hidden="true"
									className={`${isActive ? "translate-x-5" : "translate-x-0"}
                    pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
								/>
							</Switch>
						</div>
					</div>
					<div className="w-full">
						<form onSubmit={handleSubmit(onSubmit)} className="w-full mt-4">
							<div className="w-full gap-x-8 gap-y-4 flex flex-col justify-between items-stretch sm:grid sm:grid-cols-2 sm:grid-rows-[minmax(min-content,1fr)]">
								<div className="col-span-2 sm:col-span-1">
									<Input
										errors={errors}
										label="Nickname"
										type="text"
										register={register}
										name="nickname"
										maxLength={50}
										className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
										labelClassName="text-xs font-medium text-gray-500"
										isRequired
									/>
								</div>

								<div className="hidden sm:block" />

								<div className="col-span-1">
									<Input
										errors={errors}
										label="Secret Key"
										type="text"
										register={register}
										name="secretKey"
										maxLength={300}
										className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
										labelClassName="text-xs font-medium text-gray-500"
										isRequired
									/>
								</div>

								<div className="col-span-1">
									<Input
										errors={errors}
										label="Publishable Key"
										type="text"
										register={register}
										name="publishableKey"
										maxLength={300}
										className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4"
										labelClassName="text-xs font-medium text-gray-500"
										isRequired
									/>
								</div>

								<div className="col-span-1">
									<label className="text-left text-xs font-medium text-gray-500 block leading-6">
										Account ID
									</label>
									<div className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4 bg-gray-50 border border-[#DFDFDF] min-h-[46px] flex items-center">
										<span className="text-gray-700">{accountId}</span>
									</div>
								</div>

								<div className="col-span-1">
									<label className="text-left text-xs font-medium text-gray-500 block leading-6">
										Process ID
									</label>
									<div className="w-full rounded-lg font-Inter text-[15px] text-[#5E5E5E] py-2.5 px-4 bg-gray-50 border border-[#DFDFDF] min-h-[46px] flex items-center">
										<span className="text-gray-700">{processId}</span>
									</div>
								</div>

								<div className="w-full flex flex-col col-span-2 items-center rounded-md border border-gray-200 px-4 py-3">
									<div className="flex flex-row justify-between text-xs items-center w-full min-h-6">
										<p className="text-xs font-medium text-gray-500 text-left">
											Connection Status:
										</p>
										{renderConnectionStatus()}
									</div>
								</div>

								{errorMessage && (
									<div className="col-span-2 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
										<XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
										<p className="text-sm text-red-700">{errorMessage}</p>
									</div>
								)}

								<div className="w-full flex items-center justify-end col-span-2 gap-2">
									<Button
										type="button"
										color="transparent"
										className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-md min-w-[100px] hover:bg-gray-50"
										onClick={handleCancel}
									>
										Cancel
									</Button>
									<Button
										type="submit"
										color="dark"
										className="px-4 py-2 text-sm font-medium text-white border-none bg-blue-600 rounded-md min-w-[100px] hover:bg-blue-700"
										isLoading={createProcessorMutation.isPending}
									>
										Save
									</Button>
								</div>
							</div>
						</form>
					</div>
				</div>
			</div>
		</div>
	);
};

export default StripeIntegration;
