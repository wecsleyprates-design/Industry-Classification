const SECONDS_PER_DAY = 24 * 60 * 60;
const STATE_TTL_DAYS = 30;

export const ORCHESTRATOR_STATE_KEY_PREFIX = "workflow:orchestrator:";
export const ORCHESTRATOR_CLAIMED_KEY_PREFIX = "workflow:orchestrator:claimed:";
export const ORCHESTRATOR_FACTS_SOURCE_KEY_SUFFIX = ":facts_source";
export const ORCHESTRATOR_STATE_TTL_SECONDS = STATE_TTL_DAYS * SECONDS_PER_DAY;
export const ORCHESTRATOR_CLAIM_TTL_SECONDS = 60;

export const EVENT_TYPE_FACTS_READY = "facts_ready";
export const EVENT_TYPE_CASE_STATUS_UPDATED = "case_status_updated";
export const REQUIRED_ORCHESTRATOR_EVENTS = [EVENT_TYPE_FACTS_READY, EVENT_TYPE_CASE_STATUS_UPDATED] as const;

export type OrchestratorEventType = (typeof REQUIRED_ORCHESTRATOR_EVENTS)[number];
