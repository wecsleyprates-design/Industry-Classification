import { UUID } from "crypto";

import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import {
	BusinessEntityVerificationService,
	getBusinessEntityVerificationByExternalId
} from "#api/v1/modules/verification/businessEntityVerification";
import { DIRECTORIES, INTEGRATION_ID, TASK_STATUS } from "#constants";
import { uploadRawIntegrationDataToS3 } from "#common/index";
import { getBusinessDetails } from "#helpers/api";
import { logger } from "#helpers/index";
import { db } from "#helpers/knex";
import {
	IBusinessEntityPerson,
	IBusinessEntityRegistration,
	IBusinessEntityVerification,
	IBusinessIntegrationTaskEnriched,
	IDBConnection
} from "#types/db";
import { encryptData } from "#utils/encryption";
import { isNonEmptyArray } from "@austinburns/type-guards";
import states from "us-state-codes";
import { match } from "ts-pattern";
import { v4 as uuid } from "uuid";

import { baselayer, getBaselayerEnvironment, isBaselayerSandbox } from "./baselayer";
import { buildBaselayerReviewTasks, mapBaselayerAddresses } from "./baselayerBusinessMapping";
import { baselayerEventType, routeBaselayerWebhookAfterBevResolved } from "./baselayerWebhookRouting";

type BaselayerSearchPayload = Record<string, unknown> & {
	id?: string;
	reference_id?: string | null;
	state?: string;
	name?: string;
	tin?: string | null;
	business?: Record<string, unknown> | null;
	business_name_match?: string | null;
	business_address_match?: string | null;
	business_officer_match?: string | null;
	tin_matched?: boolean | null;
	watchlist_hits?: Array<Record<string, unknown>>;
	error?: unknown;
	__event__?: { type?: string; origin?: string };
};

/** Log-safe payload: masks TIN digits in logs. */
function baselayerPayloadForLog(payload: Record<string, unknown>): Record<string, unknown> {
	const copy = { ...payload };
	const tin = copy.tin;
	if (typeof tin === "string" && tin.length > 0) {
		copy.tin =
			tin.length <= 4 ? "***" : `***${tin.slice(-4)}`;
	}
	return copy;
}

export class BaselayerBusinessVerificationService extends BusinessEntityVerificationService {
	protected static PLATFORM_ID: typeof INTEGRATION_ID.BASELAYER = INTEGRATION_ID.BASELAYER;

	constructor(dbConnection?: IDBConnection) {
		super(dbConnection);
		this.taskHandlerMap = {
			fetch_business_entity_verification: async (taskId?: UUID, task?: IBusinessIntegrationTaskEnriched) => {
				const staticRef = this.constructor as typeof BaselayerBusinessVerificationService;
				if (!task) {
					task = await staticRef.getEnrichedTask(taskId!);
				}
				await (this as BaselayerBusinessVerificationService).submitBaselayerSearchFromTask(task);
				return true;
			}
		};
	}

	static async canIRun(businessId: UUID): Promise<boolean> {
		return super.canIRun(businessId);
	}

	private async submitBaselayerSearchFromTask(task: IBusinessIntegrationTaskEnriched): Promise<void> {
		const businessId = task.business_id as UUID;
		this.dbConnection = this.dbConnection || (await BaselayerBusinessVerificationService.getOrCreateConnection(businessId));

		// Serialize concurrent workers on the same integration task: lock the task row before any
		// external API call so we cannot double-create Baselayer searches / BEV rows (TOCTOU).
		await db.transaction(async trx => {
			await trx("integrations.data_business_integrations_tasks").where({ id: task.id }).forUpdate().first();

			const existing = await trx<IBusinessEntityVerification>("integration_data.business_entity_verification")
				.where({ business_integration_task_id: task.id })
				.first();
			if (existing?.external_id) {
				logger.info({ taskId: task.id }, "Baselayer search already created for this task; skipping submit");
				return;
			}

			const businessDetails = await getBusinessDetails(businessId);
			await match(businessDetails)
				.with({ status: "success" }, async ({ data }) => {
					const stateCode =
						(states.getStateCodeByStateName(data.address_state) ?? data.address_state ?? "").substring(0, 2).toUpperCase();
					const addressParts = [
						data.address_line_1,
						data.address_line_2,
						data.address_city,
						stateCode,
						data.address_postal_code
					].filter(Boolean);
					const addressLine = addressParts.join(", ");
					const officerNames: string[] = [];
					if (data.owners && isNonEmptyArray(data.owners)) {
						for (const owner of data.owners) {
							const n = [owner.first_name, owner.last_name].filter(Boolean).join(" ");
							if (n) officerNames.push(n);
						}
					}
					const tinDigits = data.tin ? String(data.tin).replace(/\D/g, "") : undefined;

					let payload: Record<string, unknown>;
					if (isBaselayerSandbox()) {
						payload = {
							name: data.name,
							address: addressLine,
							...(tinDigits ? { tin: tinDigits } : {})
						};
					} else {
						payload = {
							name: data.name,
							address: addressLine,
							reference_id: businessId,
							...(tinDigits ? { tin: tinDigits } : {})
						};
						if (officerNames.length) {
							payload.officer_names = officerNames;
						}
						if (data.official_website) {
							payload.website = data.official_website;
						}
					}

					logger.info(
						{
							businessId,
							taskId: task.id,
							baselayerEnvironment: getBaselayerEnvironment(),
							payload: baselayerPayloadForLog(payload)
						},
						"Baselayer createSearch request payload"
					);

					const searchResponse = (await baselayer.createSearch(payload as any)) as BaselayerSearchPayload;
					const searchId = searchResponse.id;
					if (!searchId) {
						throw new Error("Baselayer createSearch response missing id");
					}

					const uniqueExternalId = uuid();
					await trx<IBusinessEntityVerification>("integration_data.business_entity_verification")
						.insert({
							business_id: businessId,
							external_id: searchId,
							business_integration_task_id: task.id,
							name: data.name,
							status: (searchResponse.state || "PENDING").toString().toLowerCase(),
							tin: data.tin ? encryptData(String(data.tin).replace(/-/g, "")) : null,
							unique_external_id: uniqueExternalId
						})
						.onConflict(["external_id"])
						.ignore();
				})
				.otherwise(async () => {
					throw new Error(`Could not load business details for Baselayer submit: businessId=${businessId}`);
				});
		});
	}

	/**
	 * Process async webhook body (full search object + __event__) after HTTP 200 ack.
	 */
	async ingestBaselayerWebhookPayload(body: BaselayerSearchPayload): Promise<void> {
		const searchId = body.id;
		if (!searchId) {
			logger.error("Baselayer webhook missing search id");
			return;
		}

		let bev = await getBusinessEntityVerificationByExternalId(searchId);
		const ref = body.reference_id;
		if (!bev && ref) {
			// Only resolve BEV rows tied to a Baselayer integration task — do not pick the latest BEV for
			// the business if Middesk/Trulioo (or another platform) created a more recent row.
			bev = await db<IBusinessEntityVerification>("integration_data.business_entity_verification as bev")
				.join(
					"integrations.data_business_integrations_tasks as t",
					"t.id",
					"bev.business_integration_task_id"
				)
				.where("bev.business_id", ref)
				.where("t.platform_id", INTEGRATION_ID.BASELAYER)
				.orderBy("bev.created_at", "desc")
				.select("bev.*")
				.first();
		}
		if (!bev) {
			logger.error({ searchId, reference_id: ref }, "No business_entity_verification row for Baselayer webhook");
			return;
		}

		const businessId = bev.business_id as UUID;
		this.dbConnection = await BaselayerBusinessVerificationService.getOrCreateConnection(businessId);

		const route = routeBaselayerWebhookAfterBevResolved(body);

		if (route === "submitted_skip") {
			logger.info({ searchId, businessId }, "Baselayer BusinessSearch.submitted received");
			return;
		}

		if (route === "failed") {
			await db("integration_data.business_entity_verification")
				.update({ status: "failed", updated_at: db.raw("now()") })
				.where({ id: bev.id });
			await this.updateTaskStatus(bev.business_integration_task_id, TASK_STATUS.FAILED, {
				event: "Baselayer BusinessSearch.failed",
				body: body.error ?? body
			});
			return;
		}

		if (route === "ignored") {
			logger.info({ eventType: baselayerEventType(body), searchId }, "Baselayer webhook event ignored");
			return;
		}

		await this.persistBaselayerSearchResults(bev, body);
	}

	private async persistBaselayerSearchResults(
		bev: IBusinessEntityVerification,
		search: BaselayerSearchPayload
	): Promise<void> {
		const businessId = bev.business_id as UUID;
		const taskId = bev.business_integration_task_id;

		const task = await TaskManager.getEnrichedTask(taskId);

		const payloadForStorage = { ...search };
		if (search.tin) {
			(payloadForStorage as any).tin = this.tinSanity({ tin: { tin: search.tin } } as any);
		}

		try {
			await this.saveRequestResponse(task, search as any, search.id!);
		} catch (e) {
			logger.error({ e, bevId: bev.id }, "Baselayer saveRequestResponse failed");
		}

		const biz = (search.business || {}) as Record<string, unknown>;
		const formationDate = (biz.incorporation_date as string) || null;
		const formationState = (biz.incorporation_state as string) || null;

		await db("integration_data.business_entity_verification")
			.update({
				status: (search.state || "").toString().toLowerCase() || bev.status,
				formation_date: formationDate,
				formation_state: formationState,
				updated_at: db.raw("now()")
			})
			.where({ id: bev.id });

		const reviewRows = buildBaselayerReviewTasks(bev.id, search);
		if (reviewRows.length) {
			await db("integration_data.business_entity_review_task")
				.insert(reviewRows)
				.onConflict(["business_entity_verification_id", "key"])
				.merge({
					status: db.raw("EXCLUDED.status"),
					message: db.raw("EXCLUDED.message"),
					label: db.raw("EXCLUDED.label"),
					sublabel: db.raw("EXCLUDED.sublabel"),
					metadata: db.raw("EXCLUDED.metadata")
				});
		}

		const addrRows = mapBaselayerAddresses(bev.id, biz);
		if (addrRows.length) {
			await db("integration_data.business_entity_address_source")
				.insert(addrRows)
				.onConflict(["external_id"])
				.merge();
		}

		const regRows = this.mapBaselayerRegistrations(bev.id, biz);
		if (regRows.length) {
			await db("integration_data.business_entity_registration")
				.insert(regRows)
				.onConflict(["external_id"])
				.merge();
		}

		const officers = (biz.business_officers as Array<Record<string, unknown>>) || [];
		if (isNonEmptyArray(officers)) {
			await this.upsertBaselayerOfficers(bev.id, officers);
		}

		await this.updateTaskStatus(taskId, TASK_STATUS.SUCCESS, {
			event: "business_entity_verification updated via Baselayer webhook",
			searchId: search.id,
			eventType: baselayerEventType(search)
		});

		const completedTask = await TaskManager.getEnrichedTask(taskId);
		await this.sendTaskCompleteMessage(completedTask);

		try {
			await uploadRawIntegrationDataToS3(
				payloadForStorage as any,
				businessId,
				"business_entity_verification",
				DIRECTORIES.BUSINESS_ENTITY_VERIFICATION,
				"BASELAYER"
			);
		} catch (e) {
			logger.error({ e }, "Baselayer S3 raw upload failed");
		}
	}

	private mapBaselayerRegistrations(
		businessEntityVerificationId: UUID,
		biz: Record<string, unknown>
	): Partial<IBusinessEntityRegistration>[] {
		const list = (biz.registrations as Array<Record<string, unknown>>) || [];
		return list.map(r => {
			const addr = r.address as Record<string, unknown> | undefined;
			const fullAddresses = addr
				? [JSON.stringify(addr)]
				: [];
			return {
				business_entity_verification_id: businessEntityVerificationId,
				external_id: r.id as UUID,
				name: (r.name as string) || "",
				status: (r.status as string) || "",
				sub_status: (r.standing as string) || "",
				status_details: "",
				jurisdiction: (r.state as string) || "",
				entity_type: (r.registration_type as string) || "",
				file_number: (r.file_number as string) || "",
				full_addresses: fullAddresses,
				registration_date: (r.issue_date as string) || "",
				registration_state: (r.state as string) || "",
				source: "BASELAYER"
			};
		});
	}

	private async upsertBaselayerOfficers(
		businessEntityVerificationId: UUID,
		officers: Array<Record<string, unknown>>
	): Promise<void> {
		const mappedPeople: IBusinessEntityPerson[] = officers.map(o => {
			const titlesRaw = (o.titles as unknown[]) || [];
			const titles = titlesRaw.map(t => (typeof t === "string" ? t : String(t)));
			return {
				business_entity_verification_id: businessEntityVerificationId,
				name: (o.name as string) || "",
				submitted: false,
				source: JSON.stringify({ sources: ["BASELAYER"] }),
				titles,
				metadata: JSON.stringify(o)
			} as IBusinessEntityPerson;
		});
		if (!mappedPeople.length) return;
		await db<IBusinessEntityPerson>("integration_data.business_entity_people")
			.insert(mappedPeople)
			.onConflict(["business_entity_verification_id", "name"])
			.merge();
	}
}

export async function getBaselayerBusinessEntityVerificationService(
	businessID: UUID
): Promise<BaselayerBusinessVerificationService> {
	const conn = await BaselayerBusinessVerificationService.getOrCreateConnection(businessID);
	return new BaselayerBusinessVerificationService(conn);
}

export async function processBaselayerWebhookAsync(body: Record<string, unknown>): Promise<void> {
	const searchId = body.id as string | undefined;
	const ref = body.reference_id as string | undefined;
	let businessId: UUID | undefined;
	const bev = searchId ? await getBusinessEntityVerificationByExternalId(searchId) : undefined;
	if (bev) {
		businessId = bev.business_id as UUID;
	} else if (ref) {
		businessId = ref as UUID;
	}
	if (!businessId) {
		logger.error({ searchId, reference_id: ref }, "Cannot resolve business for Baselayer webhook");
		return;
	}
	const svc = await getBaselayerBusinessEntityVerificationService(businessId);
	await svc.ingestBaselayerWebhookPayload(body as BaselayerSearchPayload);
}
