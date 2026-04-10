export interface GetCustomerWebhookResponse {
	status: string;
	message: string;
	data: GetCustomerWebhookData;
}

export interface GetCustomerWebhookData {
	id: string;
	name: string;
	customer_id: string;
	integration_id: number;
	app_id: string;
	is_enabled: boolean;
	created_at: Date;
	updated_at: Date;
}

export interface CreateWebhookCustomerResponse {
	status: string;
	message: string;
	data: CreateWebhookCustomerData;
}

export interface CreateWebhookCustomerData {
	createdAt: Date;
	id: string;
	metadata: Metadata;
	name: string;
	uid: string;
	updatedAt: Date;
}

export interface Metadata {
	temp: any;
}

export interface createCustomerWebhookEndpointResponse {
	status: string;
	message: string;
	data: createCustomerWebhookEndpointData;
}

export interface createCustomerWebhookEndpointData {
	id: string;
	customer_webhook_id: string;
	url: string;
	version: number;
	status: string;
	created_by: string;
	updated_by: string;
}

export interface CreateWebhookPayload {
	body: {
		url: string;
		description?: string;
		events: string[];
	};
	customerId: string;
}

export interface GetWebhookEndpointsResponse {
	status: string;
	message: string;
	data: GetWebhookEndpointsData[];
}

export interface GetWebhookEndpointsData {
	id: string;
	customer_webhook_id: string;
	url: string;
	description: string;
	version: number;
	status: string;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	stats: { fail: number; success: number; pending: number; sending: number };
	events: string[];
}

export interface GetWebhookEndpointByIdResponse {
	status: string;
	message: string;
	data: GetWebhookEndpointByIdData;
}

export interface GetWebhookEndpointByIdData {
	id: string;
	customer_webhook_id: string;
	url: string;
	description: string;
	version: number;
	status: string;
	created_at: Date;
	created_by: string;
	updated_at: Date;
	updated_by: string;
	events: string[];
}

export interface GetWebhookEndpointSecretResponse {
	status: string;
	message: string;
	data: GetWebhookEndpointSecretData;
}

export interface GetWebhookEndpointSecretData {
	secret: string;
}

export interface GetWebhookEventsResponse {
	status: string;
	message: string;
	data: GetWebhookEventsData[];
}

export interface GetWebhookEventsData {
	category_id: number;
	category_code: string;
	category_label: string;
	events: GetWebhookEventsDataEvent[];
}

export interface GetWebhookEventsDataEvent {
	id: number;
	code: string;
	label: string;
}

export interface IAddWebhook {
	url: string;
}

export interface EditWebhookEndpointEventPayload {
	body: {
		url: string;
		events: string[];
	};
	customerId: string;
	endpointId: string;
}

export interface getWebhookEventLogsResponse {
	status: string;
	message: string;
	data: getWebhookEventLogsData;
}

export interface getWebhookEventLogsData {
	endpointStatus: string;
	endpointUrl: string;
	logs: getWebhookEventLogsDataLog[];
}

export interface getWebhookEventLogsDataLog {
	id: string;
	event: string;
	timestamp: Date;
	status: number;
	response: string;
	msg_id: string;
	payload: Record<string, any>;
}

export interface ResendMessageLogPayload {
	customerId: string;
	endpointId: string;
	messageId: string;
}

export interface DeleteWebhookEndpoint {
	customerId: string;
	endpointId: string;
}

export interface deleteCustomerWebhookEndpointResponse {
	status: string;
	message: string;
	data: string;
}
