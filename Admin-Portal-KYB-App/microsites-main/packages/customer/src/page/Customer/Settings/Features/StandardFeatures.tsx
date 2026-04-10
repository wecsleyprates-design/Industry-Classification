import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
	ArrowTopRightOnSquareIcon,
	CheckBadgeIcon,
	DocumentTextIcon,
	FingerPrintIcon,
	FolderIcon,
	GlobeAmericasIcon,
	IdentificationIcon,
	NewspaperIcon,
	ScaleIcon,
	ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { motion } from "framer-motion";
import Button from "@/components/Button";
import SelectComponent from "@/components/Dropdown/SelectComponent";
import FeatureSkeleton from "@/components/Skeleton/FeatureSkeleton";
import { useCustomToast } from "@/hooks";
import { FeaturesSchema } from "@/lib/validation";
import { useCreateOrUpdateCustomerIntegrationSettings } from "@/services/queries/customer.query";
import {
	type CustomerIntegrationSettingResponse,
	type CustomerIntegrationSettingResponseDataSettings,
	type FeaturesSettingsForm,
	type IntegrationPayloadSetting,
} from "@/types/customer";

interface Props {
	customerId: string;
	isDisabled?: boolean;
	title?: string;
	description?: string;
	platform?: "admin" | "customer";
	customerType?: "SANDBOX" | "PRODUCTION";
	settingsData?: CustomerIntegrationSettingResponse;
	isLoading?: boolean;
	refetch: () => Promise<void>;
}
export type FeatureValue = "live" | "sandbox" | "mocked" | "disable";

interface FeatureOption {
	label: string;
	value: FeatureValue;
}

const StandardFeatures: React.FC<Props> = ({
	customerId,
	isDisabled,
	title,
	description,
	platform = "admin",
	customerType = "PRODUCTION",
	settingsData,
	isLoading,
	refetch,
}) => {
	const { successToast, errorToast } = useCustomToast();

	const { setValue, reset, handleSubmit, watch } =
		useForm<FeaturesSettingsForm>({
			mode: "all",
			defaultValues: { settings: {} as FeaturesSettingsForm["settings"] },
			resolver: yupResolver(FeaturesSchema),
		});
	const [initialValues, setInitialValues] = useState<
		FeaturesSettingsForm["settings"]
	>({});

	useEffect(() => {
		if (settingsData) {
			setInitialValues(
				(settingsData?.data?.settings ?? {}) as Record<
					string,
					IntegrationPayloadSetting
				>,
			);
			reset({ settings: settingsData?.data?.settings ?? {} });
		}
	}, [settingsData, reset]);

	const [showActionBar, setShowActionBar] = useState(false);

	const mapBackendToUI = (mode?: string, status?: string) => {
		if (!mode) return "disabled";
		if (status === "INACTIVE") return "disabled";
		switch (mode) {
			case "PRODUCTION":
				return "live";
			case "SANDBOX":
				return "sandbox";
			case "MOCK":
				return "mocked";
			default:
				return "disabled";
		}
	};
	const backendOptionsToUI = (
		options: string[],
		customerType?: "SANDBOX" | "PRODUCTION",
	): FeatureOption[] => {
		return options
			.filter((opt) => {
				if (customerType === "PRODUCTION") {
					return opt === "PRODUCTION" || opt === "DISABLE";
				}
				return true;
			})
			.map((opt) => {
				switch (opt) {
					case "PRODUCTION":
						return { label: "Live Data", value: "live" };
					case "SANDBOX":
						return { label: "Sandbox Data", value: "sandbox" };
					case "MOCK":
						return { label: "Mocked Data", value: "mocked" };
					case "DISABLE":
						return { label: "Disable", value: "disable" };
					default:
						return { label: opt, value: "disable" };
				}
			});
	};

	const mapUIToBackend = (
		value: FeatureValue,
		prev?: IntegrationPayloadSetting,
	): IntegrationPayloadSetting => {
		switch (value) {
			case "live":
				return { mode: "PRODUCTION", status: "ACTIVE" };
			case "sandbox":
				return { mode: "SANDBOX", status: "ACTIVE" };
			case "mocked":
				return { mode: "MOCK", status: "ACTIVE" };
			case "disable":
				return {
					mode: prev?.mode ?? "SANDBOX",
					status: "INACTIVE",
				};
			default:
				return { mode: "PRODUCTION", status: "INACTIVE" };
		}
	};

	const getGauthenticateOptions = (
		gverify?: IntegrationPayloadSetting,
	): FeatureOption[] => {
		if (!gverify || gverify.status !== "ACTIVE") {
			return [{ label: "Disable", value: "disable" }];
		}
		switch (gverify.mode) {
			case "PRODUCTION":
				return [
					{ label: "Live Data", value: "live" },
					{ label: "Disable", value: "disable" },
				];
			case "SANDBOX":
				return [
					{ label: "Sandbox Data", value: "sandbox" },
					{ label: "Disable", value: "disable" },
				];
			case "MOCK":
				return [
					{ label: "Mocked Data", value: "mocked" },
					{ label: "Disable", value: "disable" },
				];
			default:
				return [{ label: "Disable", value: "disable" }];
		}
	};

	const {
		mutateAsync: createOrUpdateCustomerIntegrationSettings,
		data: createOrUpdateCustomerIntegrationSettingsData,
		error: createOrUpdateCustomerIntegrationSettingsError,
		isPending: createOrUpdateCustomerIntegrationSettingsLoading,
		reset: resetCreateOrUpdateCustomerIntegrationSettings,
	} = useCreateOrUpdateCustomerIntegrationSettings();

	useEffect(() => {
		// mutation returns arbitrary shape; safely attempt to read message
		const msg = (createOrUpdateCustomerIntegrationSettingsData as any)?.message;
		if (msg) {
			successToast(msg);
		}
	}, [createOrUpdateCustomerIntegrationSettingsData, successToast]);

	useEffect(() => {
		if (createOrUpdateCustomerIntegrationSettingsError) {
			errorToast(createOrUpdateCustomerIntegrationSettingsError);
		}
	}, [createOrUpdateCustomerIntegrationSettingsError, errorToast]);

	const discardChangeHandler = () => {
		if (settingsData?.data?.settings) {
			reset({ settings: initialValues });
			setShowActionBar(false);
		}
	};

	const featuresOrder = [
		"bjl",
		"equifax",
		"gverify",
		"gauthenticate",
		"identity_verification",
		"adverse_media",
	];

	useEffect(() => {
		const subscription = watch((values) => {
			const settings = values.settings ?? {};

			// Check each feature
			const hasChanges = featuresOrder.some((key) => {
				const initial = initialValues[key] || {};
				const current = settings[key] ?? {};

				return (
					initial.status !== current.status ||
					(current.status === "ACTIVE" && initial.mode !== current.mode)
				);
			});

			setShowActionBar(hasChanges);
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [watch, initialValues, featuresOrder]);

	useEffect(() => {
		const subscription = watch((values) => {
			const gverify = values.settings?.gverify;
			const gauthenticate = values.settings?.gauthenticate;

			if (!gverify || !gauthenticate) return;

			// If gverify is disabled, auto-disable gauthenticate
			const updatedGauthenticate = {
				mode: gverify.mode ?? "PRODUCTION",
				status:
					(gverify.status === "ACTIVE" ? gauthenticate.status : "INACTIVE") ??
					"INACTIVE",
			};
			if (
				gauthenticate.mode !== updatedGauthenticate.mode ||
				gauthenticate.status !== updatedGauthenticate.status
			) {
				setValue("settings.gauthenticate", updatedGauthenticate, {
					shouldDirty: true,
				});
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [watch, setValue]);

	const onSubmit = async (submitData: FeaturesSettingsForm) => {
		const payloadSettings = Object.fromEntries(
			Object.entries(submitData.settings ?? {})
				.filter(([key, current]) => {
					const initial = initialValues[key] || {};
					return (
						current?.status !== initial.status ||
						(current.status === "ACTIVE" && current.mode !== initial.mode)
					);
				})
				.map(([key, current]) => [
					key,
					{ mode: current.mode, status: current.status },
				]),
		) as Record<
			string,
			{ mode: "SANDBOX" | "PRODUCTION" | "MOCK"; status: "ACTIVE" | "INACTIVE" }
		>;

		await createOrUpdateCustomerIntegrationSettings({
			customerID: customerId ?? "",
			settings: payloadSettings,
		});

		await refetch();
		resetCreateOrUpdateCustomerIntegrationSettings();
		setShowActionBar(false);
	};

	const settingsObj: CustomerIntegrationSettingResponseDataSettings =
		settingsData?.data?.settings ?? {};

	const orderedFeatures = featuresOrder
		.filter((key) => {
			const feature = settingsObj[key];
			if (!feature) return false;

			// SKIP settings that are INACTIVE for customer
			if (platform === "customer" && feature.status === "INACTIVE")
				return false;

			return true;
		})
		.map((key) => ({ key, feature: settingsObj[key] }));

	const onChangeHandler = (key: string, option: FeatureOption | null) => {
		if (!option) return;

		const prev = watch(`settings.${key}`);
		const backendValue = mapUIToBackend(option.value, prev);

		// Prevent enabling gauthenticate if gverify is not active
		if (
			key === "gauthenticate" &&
			backendValue.status === "ACTIVE" &&
			watch("settings.gverify")?.status !== "ACTIVE"
		) {
			errorToast("You must enable gVerify before enabling gAuthenticate");
			return;
		}

		setValue(`settings.${key}`, backendValue, { shouldDirty: true });
	};

	const featureIcons: Record<string, React.ReactNode> = {
		bjl: <ScaleIcon className="w-6 h-6 text-blue-600" />,
		npi: <IdentificationIcon className="w-6 h-6 text-blue-600" />,
		equifax: <DocumentTextIcon className="w-6 h-6 text-blue-600" />,
		gverify: <CheckBadgeIcon className="w-6 h-6 text-blue-600" />,
		gauthenticate: <ShieldCheckIcon className="w-6 h-6 text-blue-600" />,
		website: <GlobeAmericasIcon className="w-6 h-6 text-blue-600" />,
		identity_verification: (
			<FingerPrintIcon className="w-6 h-6 text-blue-600" />
		),
		businessRegistration: <FolderIcon className="w-6 h-6 text-blue-600" />,
		adverse_media: <NewspaperIcon className="w-6 h-6 text-blue-600" />,
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<div className="overflow-visible bg-white border rounded-xl mb-7 mr-4 py-4 px-1">
				<div className="px-5">
					<div className="flex flex-col sm:flex-row pb-2 sm:justify-between sm:items-center gap-y-3">
						<div>
							<div className="mt-2 text-base font-semibold">{title}</div>
							<div className="mt-2 text-sm font-normal text-gray-500">
								{description}
							</div>
						</div>

						<div className="mt-2 sm:mt-0 w-full sm:w-auto">
							{platform === "customer" && customerType === "SANDBOX" && (
								<Button
									type="button"
									color="white"
									outline
									className="h-[45px] w-full sm:w-[190px] px-6 py-3 text-blue-600 hover:bg-blue-50 flex items-center space-x-2 rounded-lg border-[#e5e7e8] hover:border-[#9ca3af] focus:border-[#4B5563] focus:outline-none text-sm font-medium"
									onClick={() =>
										window.open(
											"https://docs.worthai.com/introduction",
											"_blank",
										)
									}
								>
									<span>Documentation</span>
									<ArrowTopRightOnSquareIcon className="w-4 h-4" />
								</Button>
							)}
						</div>
					</div>
					{isLoading ? (
						<div className="mt-6 space-y-6">
							<FeatureSkeleton />
						</div>
					) : Object.entries(settingsObj).length === 0 ? (
						<div className="mt-6 px-2 text-sm text-gray-500">
							No features to show.
						</div>
					) : (
						orderedFeatures.map(({ key, feature }) => {
							if (!feature) {
								return null;
							}
							const { description, options = [] } = feature;
							const parts = description.split(". ");

							const uiOptions =
								key === "gauthenticate"
									? getGauthenticateOptions(watch("settings.gverify"))
									: backendOptionsToUI(options, customerType);

							return (
								<div
									key={key}
									className="flex flex-col sm:flex-row sm:justify-between sm:items-start"
								>
									<div className="flex items-start my-4 gap-3 min-w-0">
										<div className="flex items-center justify-center h-10 rounded-lg min-w-10 bg-blue-50 flex-shrink-0">
											{featureIcons[key] ?? (
												<ScaleIcon className="w-6 h-6 text-blue-600" />
											)}
										</div>

										<div className="flex-1 min-w-0">
											<h2 className="text-sm text-[#1F2937] font-medium mb-1">
												{feature.label ?? key}
											</h2>
											<p className="text-sm text-gray-500">{parts[0]}</p>
											{parts[1] && (
												<p className="text-sm text-gray-500 font-medium">
													{parts[1]}
												</p>
											)}
										</div>
									</div>

									<div className="mt-1 sm:mt-6 sm:ml-4 w-full sm:w-auto pl-10">
										<div
											className={
												isDisabled ? "pointer-events-none opacity-50" : ""
											}
											style={{ width: 190 }}
										>
											<div className="grid px-2 mb-2 gap-y-4">
												<SelectComponent
													showDot
													value={
														uiOptions.find(
															(opt: FeatureOption) =>
																opt.value ===
																mapBackendToUI(
																	watch(`settings.${key}`)?.mode,
																	watch(`settings.${key}`)?.status,
																),
														) ?? { label: "Disabled", value: "disabled" }
													}
													options={uiOptions}
													onChange={(option) => {
														onChangeHandler(key, option);
													}}
													defaultValue={{
														value: undefined,
														label: "",
													}}
													customStyles={{
														control: (provided: any, state: any) => ({
															...provided,
															height: 45,
															fontSize: "14px",
															fontWeight: 500,
															borderRadius: "8px",
															borderColor: state.isFocused
																? "#4B5563"
																: "#e5e7e8",
															boxShadow: "none",
															"&:hover": {
																borderColor: "#9ca3af",
															},
														}),
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>
			</div>

			<motion.div
				initial={{ y: "100%", opacity: 0 }}
				animate={{
					y: showActionBar ? "0%" : "100%",
					opacity: showActionBar ? 1 : 0,
				}}
				transition={{ duration: 0.5 }}
				className="fixed bottom-0 z-50 flex items-center justify-between w-full h-[72px] -ml-4 bg-white border-t border-gray-200 shadow-sm sm:-ml-8 shrink-0"
			>
				<div></div>
				<div className="flex flex-row space-x-2 sm:mr-20 lg:mr-80">
					<Button
						color="transparent"
						type="button"
						outline
						className="rounded-lg"
						onClick={discardChangeHandler}
					>
						Discard Changes
					</Button>
					<Button
						type="submit"
						color="dark"
						className="w-full rounded-lg sm:w-fit"
						isLoading={createOrUpdateCustomerIntegrationSettingsLoading}
					>
						Save Changes
					</Button>
				</div>
			</motion.div>
		</form>
	);
};

export default StandardFeatures;
