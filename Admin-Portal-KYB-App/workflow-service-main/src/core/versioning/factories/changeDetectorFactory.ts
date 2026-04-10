import { BaseChangeDetector } from "#core/versioning/detectors";
import { TriggerChangeDetector } from "#core/versioning/detectors/trigger/triggerChangeDetector";
import { RuleChangeDetector } from "#core/versioning/detectors/rules/ruleChangeDetector";
import { DefaultActionChangeDetector } from "#core/versioning/detectors/defaultAction/defaultActionChangeDetector";
import { workflowConfig } from "#configs";

/**
 * Factory for creating change detectors based on configuration
 * Implements Factory Pattern for creating appropriate detectors
 */
export class ChangeDetectorFactory {
	/**
	 * Creates all configured change detectors
	 * @returns Array of change detectors based on versionGeneratingFields configuration
	 */
	static createDetectors(): BaseChangeDetector[] {
		const detectors: BaseChangeDetector[] = [];
		const versionGeneratingFields = workflowConfig.versioning.versionGeneratingFields;
		const createdDetectors = new Set<string>();

		for (const field of versionGeneratingFields) {
			if (field.startsWith("rules") && createdDetectors.has("rules")) {
				continue;
			}

			const detector = this.createDetectorForField(field);
			if (detector) {
				detectors.push(detector);
				createdDetectors.add(field.startsWith("rules") ? "rules" : field);
			}
		}

		return detectors;
	}

	/**
	 * Creates a detector for a specific field
	 * @param fieldPath - The field path to create detector for
	 * @returns The appropriate detector or null if field is not supported
	 */
	private static createDetectorForField(fieldPath: string): BaseChangeDetector | null {
		// Handle direct field mappings
		switch (fieldPath) {
			case "trigger_id":
				return new TriggerChangeDetector();
			case "default_action":
				return new DefaultActionChangeDetector();
			default:
				break;
		}

		// Handle nested field mappings
		if (fieldPath.startsWith("rules")) {
			// Only create one rule detector regardless of specific rule fields
			// This prevents duplicate detectors for rules.priority, rules.conditions, etc.
			return new RuleChangeDetector();
		}

		return null;
	}

	/**
	 * Creates detectors for specific field paths
	 * @param fieldPaths - Array of field paths to create detectors for
	 * @returns Array of change detectors
	 */
	static createDetectorsForFields(fieldPaths: string[]): BaseChangeDetector[] {
		const detectors: BaseChangeDetector[] = [];
		const createdDetectors = new Set<string>();

		for (const fieldPath of fieldPaths) {
			// Prevent duplicate rule detectors
			if (fieldPath.startsWith("rules") && createdDetectors.has("rules")) {
				continue;
			}

			const detector = this.createDetectorForField(fieldPath);
			if (detector) {
				detectors.push(detector);
				createdDetectors.add(fieldPath.startsWith("rules") ? "rules" : fieldPath);
			}
		}

		return detectors;
	}
}
