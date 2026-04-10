import { IDBConnection } from "#types/db";
import { platformFactory } from "#helpers/platformHelper";
import { CONNECTION_STATUS, INTEGRATION_ID } from "#constants";
import { strategyPlatformFactory } from "#helpers/strategyPlatformFactory";
import { PlaidIdv } from "#lib/plaid/plaidIdv";
import { TaskManager } from "#api/v1/modules/tasks/taskManager";
import { Equifax } from "#lib/equifax/equifax";

export const getPlatform = async <T extends TaskManager>(dbConnection: IDBConnection): Promise<T> => {
	switch (dbConnection.platform_id) {
		/**
		 * Instances of the PlaidIDV class should not be initialized directly.
		 * Instead, the strategyPlatformFactory function should be used to initialize the platform.
		 * @see PlaidIdv.initializePlaidIdvConnectionConfiguration for more information.
		 */
		case INTEGRATION_ID.PLAID_IDV:
			const plaidIdvWithStrategy = await strategyPlatformFactory<PlaidIdv>({
				businessID: dbConnection.business_id,
				platformID: dbConnection.platform_id,
				customerID: dbConnection.configuration?.customer_id
			});
			if (!plaidIdvWithStrategy) throw new Error("Failed to initialize PlaidIDV platform");

			const plaidIdv = await plaidIdvWithStrategy.initializePlaidIdvConnectionConfiguration(
				dbConnection.configuration?.customer_id
			);
			if (!plaidIdv) throw new Error("Failed to initialize PlaidIDV platform");

			await plaidIdv.updateConnectionStatus(
				CONNECTION_STATUS.SUCCESS,
				JSON.stringify({ task: "fetch_identity_verification" })
			);

			return plaidIdv as unknown as T;
		/**
		 * Equifax platform instances are initialized via the strategyPlatformFactory.
		 */
		case INTEGRATION_ID.EQUIFAX:
			const equifaxWithStrategy = await strategyPlatformFactory<Equifax>({
				businessID: dbConnection.business_id,
				platformID: dbConnection.platform_id
			});
			if (!equifaxWithStrategy) throw new Error("Failed to initialize Equifax platform");

			return equifaxWithStrategy as unknown as T;
		default:
			return platformFactory({ dbConnection });
	}
};
