export const PLATFORM_ID = {
	STRIPE: 1,
} as const;

export type ConnectionStatus =
	| "connected"
	| "failed"
	| "not-connected"
	| "checking";

export type PaymentProcessorStatus = "ACTIVE" | "INACTIVE" | "PENDING";

export interface PaymentProcessor {
	id: string;
	customer_id: string;
	name: string;
	status: PaymentProcessorStatus;
	platform_id: number;
	metadata: PaymentProcessorMetadata;
	created_at: string;
	updated_at: string | null;
	deleted_at: string | null;
	created_by: string;
	updated_by: string;
	deleted_by: string | null;
}

export interface PaymentProcessorMetadata {
	account_id?: string;
	account?: {
		id: string;
	};
	[key: string]: unknown;
}

export interface StripeFormData {
	nickname: string;
	secretKey: string;
	publishableKey: string;
}

export interface CreateProcessorRequest {
	name: string;
	stripe: {
		publishable_key: string;
		secret_key: string;
	};
}

export interface CreateProcessorResponse {
	status: string;
	message: string;
	data: PaymentProcessor;
}

export interface GetProcessorsResponse {
	status: string;
	message: string;
	data: PaymentProcessor[];
}
