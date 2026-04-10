import { EVENTS, INTEGRATION_ID, QUEUES } from "#constants";

import { logger } from "#helpers/logger";
import { platformFactory } from "#helpers/platformHelper";
import { randomUUID, type UUID } from "crypto";
import { Match } from "./match";
import BullQueue from "#helpers/bull-queue";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";
import { VerificationApiError } from "#api/v1/modules/verification/error";
import { db } from "#helpers";
import {
	MatchBusinessResponse,
	MatchProIcaResult,
	PrincipalMatch,
	TerminationInquiryRequest,
	MATCH_SIGNAL_EXACT,
	MATCH_SIGNAL_M01,
	VALUE_NOT_AVAILABLE,
	TerminationInquiryResponse
} from "./types";
import { internalGetMccCode } from "#helpers/api";

export class MatchUtil {
	/* Shortcut to ensure Match-pro task is created and runs for the given customer and business */
	static async runMatchBusiness(
		customerID: UUID,
		businessID: UUID,
		icas?: string[]
	): Promise<IBusinessIntegrationTaskEnriched> {
		try {
			const connection = await Match.getOrCreateConnection(businessID);
			const platform = platformFactory({ dbConnection: connection });
			const taskId = await platform.getOrCreateTaskForCode({
				taskCode: "fetch_business_entity_verification",
				reference_id: businessID,
				metadata: { customerID, ...(icas !== undefined ? { icas } : {}) } // Send customerId and icas in Metadata
			});
			return await platform.processTask({ taskId });
		} catch (ex) {
			logger.error({ error: ex, customerID, businessID }, "Failed to match business");
			throw new VerificationApiError("Failed to match business");
		}
	}

	static enqueueMatchProRequest = async (requestId: UUID, request: Record<string, any>) => {
		const queue = new BullQueue(QUEUES.TASK);
		const jobId = `${requestId}::${randomUUID()}`;
		return queue.addJob(
			EVENTS.MATCH_PRO_BULK,
			{ requestId, request },
			{ jobId, removeOnComplete: false, removeOnFail: false }
		);
	};

	static processJobRequest = async (job: any): Promise<any> => {
		const { customer_id: customerID, business_id: businessID } = job?.request;
		try {
			const updatedTask = await MatchUtil.runMatchBusiness(customerID, businessID);
			logger.info({ businessID, taskStatus: updatedTask.task_status }, "Match-pro task completed");
		} catch (error) {
			logger.error({ error, businessID }, "Failed to run Match-pro task");
		}
	};

	/**
	 * Post-processes a single ICA result: selects the best-scoring principal per terminated
	 * merchant (highest EXACT_MATCH field count, falling back to the first principal),
	 * normalizes principal fields to VALUE_NOT_AVAILABLE when null/undefined, and enriches
	 * merchant MCC codes with their descriptions. Terminated merchants are not filtered out.
	 */
	static async filterMatchResults(result: MatchProIcaResult): Promise<MatchProIcaResult> {
		const response = result.terminationInquiryResponse as TerminationInquiryResponse | undefined;
		if (!response?.possibleMerchantMatches) return result;

		const scoreExactMatches = (pm: PrincipalMatch): number =>
			[pm.name, pm.email, pm.address, pm.nationalId, pm.dateOfBirth, pm.phoneNumber, pm.altPhoneNumber, pm.driversLicense]
				.filter(v => v === MATCH_SIGNAL_EXACT).length;

		const normalizePrincipal = (pm: PrincipalMatch): PrincipalMatch => ({
			name: pm.name ?? VALUE_NOT_AVAILABLE,
			email: pm.email ?? VALUE_NOT_AVAILABLE,
			address: pm.address ?? VALUE_NOT_AVAILABLE,
			nationalId: pm.nationalId ?? VALUE_NOT_AVAILABLE,
			dateOfBirth: pm.dateOfBirth ?? VALUE_NOT_AVAILABLE,
			phoneNumber: pm.phoneNumber ?? VALUE_NOT_AVAILABLE,
			altPhoneNumber: pm.altPhoneNumber ?? VALUE_NOT_AVAILABLE,
			driversLicense: pm.driversLicense ?? VALUE_NOT_AVAILABLE
		});

		const selectBestPrincipal = (principals: PrincipalMatch[]): PrincipalMatch[] => {
			if (principals.length === 0) return [];
			const best = principals.reduce((a, b) => scoreExactMatches(b) > scoreExactMatches(a) ? b : a);
			const selected = scoreExactMatches(best) > 0 ? best : principals[0];
			return [normalizePrincipal(selected)];
		};

		// Collect unique MCC codes from all merchants + the request, then fetch labels in parallel
		const mccCodes = new Set<string>();
		for (const pmm of response.possibleMerchantMatches) {
			for (const tm of pmm.terminatedMerchants ?? []) {
				if (tm.merchant.merchantCategory) mccCodes.add(tm.merchant.merchantCategory);
			}
		}
		const request = result.terminationInquiryRequest as TerminationInquiryRequest | undefined;
		const requestMcc = request?.terminationInquiryRequest?.merchant?.merchantCategory;
		if (requestMcc) mccCodes.add(requestMcc);

		const mccLabelMap: Record<string, string> = {};
		await Promise.all(
			[...mccCodes].map(async code => {
				const rows = await internalGetMccCode(code);
				const label = rows?.find(r => !!r.mcc_label)?.mcc_label;
				if (label) mccLabelMap[code] = String(label);
			})
		);

		const mapped = response.possibleMerchantMatches.map(pmm => {
			const qualifying = (pmm.terminatedMerchants ?? []).filter(
				tm => tm.merchantMatch.name === MATCH_SIGNAL_M01 || tm.merchantMatch.doingBusinessAsName === MATCH_SIGNAL_M01
			);
			return {
				...pmm,
				terminatedMerchants: qualifying.map(tm => ({
					...tm,
					merchant: {
						...tm.merchant,
						merchantCategoryDescription: mccLabelMap[tm.merchant.merchantCategory]
					},
					merchantMatch: {
						...tm.merchantMatch,
						principalMatches: selectBestPrincipal(tm.merchantMatch.principalMatches ?? [])
					}
				}))
			};
		});

		const enrichedRequest = requestMcc
			? {
					...request,
					terminationInquiryRequest: {
						...request!.terminationInquiryRequest,
						merchant: {
							...request!.terminationInquiryRequest.merchant,
							merchantCategoryDescription: mccLabelMap[requestMcc]
						}
					}
				}
			: request;

		return {
			...result,
			...(enrichedRequest !== undefined ? { terminationInquiryRequest: enrichedRequest } : {}),
			terminationInquiryResponse: { ...response, possibleMerchantMatches: mapped }
		};
	}

	static async getMatchBusinessResult(params: {
		businessID: UUID;
		ica?: string;
	}): Promise<MatchBusinessResponse> {
		try {
			const matchResultQuery = db("integration_data.request_response")
				.select("integration_data.request_response.*")
				.where("integration_data.request_response.platform_id", INTEGRATION_ID.MATCH)
				.andWhere("integration_data.request_response.business_id", params.businessID)
				.orderBy("requested_at", "desc")
				.limit(1);

			const matchResult = await matchResultQuery;

			if (matchResult.length === 0) {
				logger.info({ businessID: params.businessID }, "Match Business result: Record not found");
				return {};
			}

			const request_response = matchResult[0];
			const response = request_response.response;

			if (params.ica) {
				// Handle Multi-ICA Aggregated Response
				if (response.multi_ica && response.results) {
					const resultForIca = response.results[params.ica];
					if (!resultForIca) {
						logger.info(
							{ businessID: params.businessID, ica: params.ica },
							"Match Business result: ICA not found in aggregated result"
						);
						return {};
					}
					return resultForIca;
				}

				// Handle Legacy Single Response
				// Check if the legacy record matches the requested ICA
				const legacyIca =
					response.terminationInquiryRequest?.acquirerId ||
					request_response.request?.terminationInquiryRequest?.acquirerId;

				if (legacyIca === params.ica) {
					return response;
				} else {
					// Found a record but for different ICA
					return {};
				}
			}

			// If no ICA specific requested, return the whole response object (legacy or aggregated)
			return response;
		} catch (error) {
			logger.error({ error, businessID: params.businessID }, "Match Business result: Error while fetching");
			throw error;
		}
	}
}
