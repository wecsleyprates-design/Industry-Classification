import { z } from "zod";

/** Minimal event envelope; Baselayer sends full search object alongside `__event__`. */
export const baselayerWebhookBodySchema = z
	.object({
		__event__: z
			.object({
				type: z.string(),
				origin: z.string().optional()
			})
			.passthrough()
			.optional(),
		id: z.string(),
		reference_id: z.string().optional().nullable(),
		state: z.string().optional()
	})
	.passthrough();

export type BaselayerWebhookBody = z.infer<typeof baselayerWebhookBodySchema>;

export const baselayerCreateSearchRequestSchema = z.object({
	name: z.string(),
	address: z.string(),
	tin: z.string().optional(),
	officer_names: z.array(z.string()).optional(),
	website: z.string().optional(),
	email: z.string().optional(),
	phone_number: z.string().optional(),
	reference_id: z.string().optional(),
	options: z.array(z.string()).optional()
});

export type BaselayerCreateSearchRequest = z.infer<typeof baselayerCreateSearchRequestSchema>;
