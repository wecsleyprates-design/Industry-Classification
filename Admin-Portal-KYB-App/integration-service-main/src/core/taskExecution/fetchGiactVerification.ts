import { prepareIntegrationDataForScore } from "#common";
import { CONNECTION_STATUS } from "#constants";
import { internalGetCaseByID, logger } from "#helpers";
import { GIACT } from "#lib/giact/giact";
import type { IBusinessIntegrationTaskEnriched, IDBConnection } from "#types";
import type { UUID } from "crypto";

export async function fetchGiactVerification<T = any>(
	connection: IDBConnection,
	task: IBusinessIntegrationTaskEnriched<T>
): Promise<void> {
	logger.info(`running giact verification`);
	let giact: GIACT | null = null;
	const actions = {};

	let customerIdForStrategy: UUID | undefined = task.customer_id ?? undefined;
	if (!customerIdForStrategy && task.case_id) {
		try {
			const caseDetail = await internalGetCaseByID(task.case_id);
			customerIdForStrategy = caseDetail?.customer_id ?? undefined;
		} catch (err) {
			// Case lookup failed; customerIdForStrategy stays unset.
			logger.warn(
				{ err: err instanceof Error ? err.message : String(err), caseId: task.case_id },
				"GIACT: internalGetCaseByID failed; customerIdForStrategy stays unset."
			);
		}
	}

	try {
		giact = await GIACT.initializeGiactConnection(task.business_id, customerIdForStrategy);
	} catch (ex) {
		// Fallback to initializing a new GIACT connection
		logger.warn(
			{ err: ex, businessId: task.business_id, taskId: task.id, customerId: customerIdForStrategy },
			"Failed to initialize GIACT connection, initializing a new one."
		);
		giact = await GIACT.initializeGiactConnection(task.business_id, customerIdForStrategy);
	} finally {
		try {
			if (giact && task.case_id) {
				await giact.updateConnectionStatus(
					CONNECTION_STATUS.SUCCESS,
					JSON.stringify({ task: "fetch_giact_verification" })
				);

				actions["giact"] = await giact.processTask({
					taskId: task.id,
					businessID: connection.business_id,
					caseID: task.case_id
				});
			}
		} catch (err) {
			logger.error(`Error in giact verification for business ${task.business_id}. Error: ${(err as Error).message}`);
			actions["giact"] = { error: (err as Error).message };
		}
		await prepareIntegrationDataForScore(task.id);
	}
	logger.info(`GIACT verification completed for business ${task.business_id}. Actions: ${JSON.stringify(actions)}`);
}
