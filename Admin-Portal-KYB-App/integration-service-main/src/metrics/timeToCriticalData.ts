import { INTEGRATION_ID, TASK_STATUS } from "#constants";
import { db } from "#helpers/knex";
import { logger } from "#helpers/logger";
import type { IBusinessIntegrationTaskEnriched } from "#types/db";

import { getMetrics } from "./serviceMetrics";

const CRITICAL_PLATFORMS: Set<number> = new Set([INTEGRATION_ID.MIDDESK, INTEGRATION_ID.ENTITY_MATCHING]);

const SLOW_THRESHOLD_MS = 900000; // 15 minutes

const platformLabel = (platformId: number): string => {
	if (platformId === INTEGRATION_ID.MIDDESK) return "middesk";
	if (platformId === INTEGRATION_ID.ENTITY_MATCHING) return "entity_matching";
	return "unknown";
};

interface CriticalTaskRow {
	platform_id: number;
	task_created_at: Date;
	task_updated_at: Date;
}

/**
 * Records "time to critical data" metrics for a task.
 * Currently time to critical data is calculated from the latest
 * completed task from Middesk or Entity Matching.
 */
export async function recordTimeToCriticalDataMetrics(task: IBusinessIntegrationTaskEnriched): Promise<void> {
	if (task.task_status !== TASK_STATUS.SUCCESS) return;
	if (!CRITICAL_PLATFORMS.has(task.platform_id)) return;

	try {
		const nowMs = Date.now();
		const taskCreatedMs = new Date(task.created_at).getTime();
		const taskDurationMs = nowMs - taskCreatedMs;

		const platform = platformLabel(task.platform_id);

		// Comment out these tags if custom metrics get too expensive
		const baseTags = [
			`platform:${platform}`,
			...(task.customer_id ? [`customer_id:${task.customer_id}`] : [])
		];

		const metrics = getMetrics();

		metrics.distribution("task.duration_ms", taskDurationMs, baseTags);

		const criticalTasks = await db("integrations.data_business_integrations_tasks as t")
			.select(
				"dc.platform_id",
				"t.created_at as task_created_at",
				"t.updated_at as task_updated_at"
			)
			.join("integrations.data_connections as dc", "dc.id", "t.connection_id")
			.where("dc.business_id", task.business_id)
			.whereIn("dc.platform_id", [INTEGRATION_ID.MIDDESK, INTEGRATION_ID.ENTITY_MATCHING])
			.andWhere("t.task_status", TASK_STATUS.SUCCESS)
			.orderBy("t.updated_at", "desc") as CriticalTaskRow[];

		const middesk = criticalTasks.find((r) => r.platform_id === INTEGRATION_ID.MIDDESK);
		const entityMatching = criticalTasks.find((r) => r.platform_id === INTEGRATION_ID.ENTITY_MATCHING);

		if (!middesk || !entityMatching) return;

		const earliestCreated = Math.min(
			new Date(middesk.task_created_at).getTime(),
			new Date(entityMatching.task_created_at).getTime()
		);
		const middeskMs = new Date(middesk.task_updated_at).getTime() - earliestCreated;
		const entityMs = new Date(entityMatching.task_updated_at).getTime() - earliestCreated;
		const criticalDataMs = Math.max(middeskMs, entityMs);
		const bottleneck = middeskMs >= entityMs ? "middesk" : "entity_matching";
		const executionClass = criticalDataMs > SLOW_THRESHOLD_MS ? "slow" : "normal";

		const criticalTags = [
			...(task.customer_id ? [`customer_id:${task.customer_id}`] : []),
			`bottleneck:${bottleneck}`,
			`execution_class:${executionClass}`
		];

		metrics.distribution("time_to_critical_data_ms", criticalDataMs, criticalTags);
		metrics.distribution("time_to_critical_data.middesk_ms", middeskMs, criticalTags);
		metrics.distribution("time_to_critical_data.entity_matching_ms", entityMs, criticalTags);
		metrics.increment("critical_data.completed", 1, criticalTags);
	} catch (error) {
		logger.error({ error, task_id: task.id, business_id: task.business_id },
			"[recordTimeToCriticalDataMetrics] - Failed to record time to critical data metrics");
	}
}
