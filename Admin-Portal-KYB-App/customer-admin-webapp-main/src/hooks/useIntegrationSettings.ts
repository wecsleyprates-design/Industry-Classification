import { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type * as yup from "yup";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem, setItem } from "@/lib/localStorage";
import { strategyMap } from "@/lib/utils/integrationSettingsBodyBuilder";
import { IntegrationSettingsSchema } from "@/lib/validation";
import {
	checkConnectionStatus,
	getCredentials,
} from "@/services/api/integration.service";
import { type ILoginResponseUserDetails } from "@/types/auth";
import {
	type ConnectionStatus,
	type IntegrationSettingsForm,
	type IntegrationSettingsResponse,
	type IntegrationSettingsStorageData,
} from "@/types/integrationSettings";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const useUserDetails = () => {
	return useMemo(() => {
		try {
			const userDetails: ILoginResponseUserDetails | null = getItem(
				LOCALSTORAGE.userDetails,
			);
			const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";

			if (!userDetails || !customerId) {
				return null;
			}

			const customerName = `${userDetails.first_name} ${userDetails.last_name}`;
			return { customerId, customerName, userDetails };
		} catch (error) {
			return null;
		}
	}, []);
};

const useIntegrationSettingsStorage = () => {
	const getFromStorage =
		useCallback((): IntegrationSettingsStorageData | null => {
			try {
				const data = getItem(LOCALSTORAGE.integrationSettings);
				return data ? JSON.parse(data as string) : null;
			} catch (error) {
				console.error(
					"Failed to parse integration settings from storage:",
					error,
				);
				return null;
			}
		}, []);

	const saveToStorage = useCallback((data: IntegrationSettingsStorageData) => {
		try {
			setItem(LOCALSTORAGE.integrationSettings, JSON.stringify(data));
		} catch (error) {
			console.error("Failed to save integration settings to storage:", error);
		}
	}, []);

	return { getFromStorage, saveToStorage };
};

// Query keys
const QUERY_KEYS = {
	integrationSettings: (customerId: string) => [
		"integrationSettings",
		customerId,
	],
	checkConnectionStatus: (customerId: string) => [
		"checkConnectionStatus",
		customerId,
	],
} as const;

// Default connection status constant
const DEFAULT_CONNECTION_STATUS: ConnectionStatus = {
	status: "not-connected",
	message: "",
	isActive: false,
	expiresAt: undefined,
};

const buildConnectionStatusQueryFn =
	(customerId: string, acquirerId?: string) =>
	async (): Promise<ConnectionStatus> => {
		const response = await checkConnectionStatus(customerId, acquirerId);
		const statusConnection = response.data?.statusConnection;

		if (statusConnection?.status) {
			return {
				status: statusConnection.status,
				message: statusConnection.message || "",
				isActive: statusConnection.details?.isActive ?? false,
				expiresAt: statusConnection.details?.expiresAt,
			};
		}

		return DEFAULT_CONNECTION_STATUS;
	};

// Custom hook for checking connection status
const useCheckConnectionStatus = () => {
	const userDetails = useUserDetails();
	const customerId = userDetails?.customerId ?? "";
	const queryClient = useQueryClient();
	const [acquirerId, setAcquirerId] = useState<string | undefined>(undefined);

	const { data, error, isFetching } = useQuery({
		queryKey: [...QUERY_KEYS.checkConnectionStatus(customerId), acquirerId],
		queryFn: buildConnectionStatusQueryFn(customerId, acquirerId),
		enabled: Boolean(customerId),
	});

	const refetchConnectionStatus = useCallback(
		async (newAcquirerId?: string) => {
			setAcquirerId(newAcquirerId);
			return queryClient.fetchQuery({
				queryKey: [
					...QUERY_KEYS.checkConnectionStatus(customerId),
					newAcquirerId,
				],
				queryFn: buildConnectionStatusQueryFn(customerId, newAcquirerId),
			});
		},
		[customerId, queryClient],
	);

	return {
		connectionStatus: data ?? DEFAULT_CONNECTION_STATUS,
		connectionStatusError: error,
		refetchConnectionStatus,
		isLoadingConnectionStatus: isFetching,
	};
};

// Custom hook for fetching integration settings with useQuery
const useGetIntegrationSettings = () => {
	const userDetails = useUserDetails();
	const { getFromStorage, saveToStorage } = useIntegrationSettingsStorage();
	const { errorHandler } = useCustomToast();

	const query = useQuery({
		queryKey: QUERY_KEYS.integrationSettings(userDetails?.customerId || ""),
		queryFn: async (): Promise<IntegrationSettingsStorageData | null> => {
			if (!userDetails) {
				throw new Error("User details not found. Please log in again.");
			}

			// Try to get from cache first
			const cachedData = getFromStorage();
			if (cachedData) {
				return cachedData;
			}

			// Fetch from API
			const response: IntegrationSettingsResponse = await getCredentials(
				userDetails.customerId,
			);

			if (response?.status === "success" && response.data?.storage_data) {
				try {
					const storageData = response.data.storage_data;
					saveToStorage(storageData);
					return storageData;
				} catch (parseError) {
					console.error("Failed to parse API response:", parseError);
					return null;
				}
			}

			return null;
		},
		enabled: !!userDetails?.customerId,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
		retry: 2,
	});

	// Handle errors using useEffect (onError was removed in v5)
	useEffect(() => {
		if (query.error) {
			errorHandler(query.error);
		}
	}, [query.error, errorHandler]);

	// Determine operation based on whether data exists
	const operation: "create" | "update" = query.data ? "update" : "create";

	return {
		data: query.data,
		error: query.error,
		isLoading: query.isLoading,
		isError: query.isError,
		refetch: query.refetch,
		operation,
	};
};

// Custom hook for form submission with useMutation
const useHandleFormSubmit = (operation: "create" | "update") => {
	const queryClient = useQueryClient();
	const { successHandler, errorHandler } = useCustomToast();
	const userDetails = useUserDetails();
	const { saveToStorage } = useIntegrationSettingsStorage();
	const { refetchConnectionStatus } = useCheckConnectionStatus();

	const form = useForm<IntegrationSettingsForm>({
		defaultValues: {
			icas: [{ ica: "", isDefault: true }],
			consumerKey: "",
			keyPassword: undefined,
			keyFile: undefined,
			isActive: false,
		},
		mode: "onChange",
		resolver: yupResolver(
			IntegrationSettingsSchema as yup.ObjectSchema<IntegrationSettingsForm>,
		),
	});

	// Handle dynamic fields for ICAs
	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "icas",
	});

	// Check if required fields for integration are filled (without isActive requirement)
	const checkRequiredFieldsFilled = useCallback(
		(formData: IntegrationSettingsForm) => {
			const { consumerKey, icas, keyFile } = formData;
			const hasValidIcas = icas?.some((item) => item.ica?.trim().length > 0);
			return !!(consumerKey?.trim() && hasValidIcas && keyFile);
		},
		[],
	);

	const mutation = useMutation({
		mutationFn: async (formData: IntegrationSettingsForm) => {
			if (!userDetails) {
				throw new Error("User details not found. Please log in again.");
			}

			const { customerId, customerName } = userDetails;
			const strategy = strategyMap[operation];

			if (!strategy) {
				throw new Error(`Invalid operation: ${operation}`);
			}

			const icasArray = formData.icas;

			const requestData = strategy.buildBody({
				...formData,
				icas: icasArray,
				customerId,
				customerName,
			});

			return await strategy.api(customerId, requestData);
		},
		onSuccess: async (response: IntegrationSettingsResponse, formData) => {
			if (response) {
				const message = `Integration settings ${
					operation === "create" ? "created" : "updated"
				} successfully`;
				successHandler({ message });

				const icasArray = formData.icas;

				// Update cache with new data
				const newData: IntegrationSettingsStorageData = {
					icas:
						icasArray.length > 0 ? icasArray : [{ ica: "", isDefault: true }],
					consumerKey: formData.consumerKey || "",
					isActive: formData.isActive,
				};

				// Update React Query cache
				if (userDetails?.customerId) {
					queryClient.setQueryData(
						QUERY_KEYS.integrationSettings(userDetails.customerId),
						newData,
					);
				}

				// Update localStorage
				saveToStorage(newData);
			}
		},
		onError: (error) => {
			errorHandler(error);
		},
	});

	// Memoize form methods to prevent unnecessary re-renders
	const {
		handleSubmit,
		register,
		setValue,
		watch,
		reset,
		formState: { errors },
		trigger,
		getValues,
	} = form;

	// Watch the isActive field to trigger re-validation when it changes
	const isActiveValue = watch("isActive");

	// Simple form submission handler
	const onSubmit = useCallback(
		(formData: IntegrationSettingsForm) => {
			mutation.mutate(formData);
		},
		[mutation],
	);

	// Form submission with connection test
	const onSubmitAndTest = useCallback(
		async (formData: IntegrationSettingsForm) => {
			try {
				await mutation.mutateAsync(formData);
			} catch {
				return;
			}
			const defaultIca =
				formData.icas?.find((item) => item.isDefault)?.ica ??
				formData.icas?.[0]?.ica;
			await refetchConnectionStatus(defaultIca);
		},
		[mutation, refetchConnectionStatus],
	);

	return {
		handleSubmit: handleSubmit(onSubmit),
		handleSubmitAndTest: handleSubmit(onSubmitAndTest),
		register,
		setValue,
		watch,
		errors,
		onSubmit,
		reset,
		isActiveValue,
		trigger,
		getValues,
		isValid: !Object.keys(errors).length,
		isSubmitting: mutation.isPending,
		submitError: mutation.error,
		checkRequiredFieldsFilled,
		fields,
		append,
		remove,
	};
};

// Main hook that combines everything
export const useIntegrationSettings = () => {
	const { data, error, isLoading, isError, refetch, operation } =
		useGetIntegrationSettings();
	const formHandlers = useHandleFormSubmit(operation);

	// Update form values when data changes
	useEffect(() => {
		if (data) {
			formHandlers.setValue("consumerKey", data.consumerKey || "");
			// Set ICA array from backend data, with legacy fallback for acquirerId
			const icas = data.icas;
			if (Array.isArray(icas) && icas.length > 0) {
				formHandlers.setValue("icas", icas);
			} else if (data.acquirerId) {
				// Fallback for legacy data using acquirerId
				formHandlers.setValue("icas", [
					{ ica: data.acquirerId, isDefault: true },
				]);
			} else {
				formHandlers.setValue("icas", [{ ica: "", isDefault: true }]);
			}
			formHandlers.setValue("isActive", data.isActive || false);
		}
	}, [data, formHandlers.setValue]);

	return {
		// Data
		data,
		error,
		isLoading: isLoading || formHandlers.isSubmitting,
		isError,
		operation,

		// Actions
		refetch,
		...formHandlers,
	};
};

export { useCheckConnectionStatus };
