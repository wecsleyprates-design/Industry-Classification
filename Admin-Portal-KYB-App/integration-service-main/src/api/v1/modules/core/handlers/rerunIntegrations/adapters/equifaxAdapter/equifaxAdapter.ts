import type { IntegrationFactEntityMatchingMetadata } from "../types";
import { ENTITY_MATCHING_FACT_NAMES, getEntityMatchingMetadata } from "../../lib";
import { entityMatchingProcessFunction } from "../shared/entityMatchingProcessFunction";
import { createAdapter } from "../shared/createAdapter";

/**
 * Adapter that converts resolved facts into Equifax search/match format.
 *
 * Equifax supports two modes:
 * 1. EntityMatching mode (AI-based): Uses names + originalAddresses
 * 2. Direct/Athena query (heuristic fallback): Uses names, addresses, zip3, name2
 *
 * The second mode is not supported by this adapter.
 * Entity Matching is globally enabled in all environments, and the fallback code path is never executed.
 *
 * Instead, this adapter is just a generic EntityMatching adapter that uses the EntityMatching functions.
 */
export const equifaxAdapter = createAdapter<IntegrationFactEntityMatchingMetadata>({
	factNames: ENTITY_MATCHING_FACT_NAMES,
	getMetadata: (...args) => getEntityMatchingMetadata(...args),
	process: entityMatchingProcessFunction
});
