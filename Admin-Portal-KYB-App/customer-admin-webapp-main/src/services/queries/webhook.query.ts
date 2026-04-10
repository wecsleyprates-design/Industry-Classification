import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type CreateWebhookPayload,
	type DeleteWebhookEndpoint,
	type EditWebhookEndpointEventPayload,
	type ResendMessageLogPayload,
} from "@/types/webhooks";
import {
	createWebhookCustomer,
	createWebhookEndpoint,
	deleteWebhookEndpoint,
	editWebhookEndpointEvents,
	getCustomerWebhookInfo,
	getWebhookEndpointById,
	getWebhookEndpoints,
	getWebhookEndpointSecret,
	getWebhookEventLogs,
	getWebhookEvents,
	resendMessageLog,
} from "../api/webhook.service";

export const useGetCustomerWebhookInfo = (customerId: string) =>
	useQuery({
		queryKey: ["getCustomerWebhookInfo", customerId],
		queryFn: async () => {
			const res = await getCustomerWebhookInfo(customerId);
			return res;
		},
		enabled: !!customerId,
		retry: 1,
	});

export const useCreateWebhookCustomer = () =>
	useMutation({
		mutationFn: async (customerId: string) => {
			const res = await createWebhookCustomer(customerId);
			return res;
		},
	});

export const useCreateWebhookEndpoint = () =>
	useMutation({
		mutationFn: async (payload: CreateWebhookPayload) => {
			const res = await createWebhookEndpoint(payload);
			return res;
		},
	});

export const useGetWebhookEndpoints = (customerId: string) =>
	useQuery({
		queryKey: ["getWebhookEndpoints", customerId],
		queryFn: async () => {
			const res = await getWebhookEndpoints(customerId);
			return res;
		},
		enabled: !!customerId,
		retry: 1,
	});

export const useGetWebhookEndpointById = (
	customerId: string,
	endpointId: string,
) =>
	useQuery({
		queryKey: ["getWebhookEndpointById", customerId, endpointId],
		queryFn: async () => {
			const res = await getWebhookEndpointById(customerId, endpointId);
			return res;
		},
		retry: 1,
	});

export const useGetWebhookEndpointSecret = (
	customerId: string,
	endpointId: string,
) =>
	useQuery({
		queryKey: ["getWebhookEndpointSecret", customerId, endpointId],
		queryFn: async () => {
			const res = await getWebhookEndpointSecret(customerId, endpointId);
			return res;
		},
		enabled: !!customerId,
		retry: 1,
	});

export const useGetWebhookEvents = () =>
	useQuery({
		queryKey: ["getWebhookEvents"],
		queryFn: async () => {
			const res = await getWebhookEvents();
			return res;
		},
		retry: 2,
	});

export const useEditWebhookEndpointEvents = () =>
	useMutation({
		mutationFn: async (payload: EditWebhookEndpointEventPayload) => {
			const res = await editWebhookEndpointEvents(payload);
			return res;
		},
	});

export const useGetWebhookEventLogs = (
	customerId: string,
	endpointId: string,
) =>
	useQuery({
		queryKey: ["getWebhookEventLogs", customerId],
		queryFn: async () => {
			const res = await getWebhookEventLogs(customerId, endpointId);
			return res;
		},
		enabled: !!customerId,
		retry: 1,
	});

export const useResendMessageLog = () =>
	useMutation({
		mutationFn: async (payload: ResendMessageLogPayload) => {
			const res = await resendMessageLog(payload);
			return res;
		},
	});

export const useDeleteWebhookEndpoint = () =>
	useMutation({
		mutationFn: async (payload: DeleteWebhookEndpoint) => {
			const res = await deleteWebhookEndpoint(payload);
			return res;
		},
	});
