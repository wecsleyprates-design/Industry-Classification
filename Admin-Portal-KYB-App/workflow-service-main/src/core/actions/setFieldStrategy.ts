import { logger } from "#helpers/logger";
import { producer } from "#helpers/kafka";
import { KAFKA_TOPICS, KAFKA_MESSAGE_KEYS } from "#constants";
import { CASE_STATUS } from "#constants";
import { CaseAttributeChangeEvent } from "#core/types";
import { CaseData } from "../types";
import { ActionStrategy } from "./actionStrategy";
import { isNotEmptyString } from "#utils/validation";

export class SetFieldStrategy implements ActionStrategy {
	async execute(action: Record<string, unknown>, caseData: CaseData): Promise<void> {
		const parameters = (action.parameters as Record<string, unknown>) || action;
		const field = parameters.field as string;
		const value = parameters.value as string | number;

		if (!isNotEmptyString(field) || value === undefined || value === null) {
			logger.error(`Missing required parameters for set_field action: field=${field}, value=${value}`);
			return;
		}

		logger.debug(`Executing set_field action for case ${caseData.id}: field=${field}, value=${value}`);

		if (field.startsWith("case.")) {
			await this.updateCaseAttribute(field, value, caseData);
		} else {
			logger.warn(
				`Unsupported field for set_field action: ${field} for case ${caseData.id}. Field must start with 'case.'`
			);
		}
	}

	private async updateCaseAttribute(field: string, value: string | number, caseData: CaseData): Promise<void> {
		const attributeType = field.replace("case.", "");
		let attributeValue: string | number = value;

		if (attributeType === "status" && typeof value === "string") {
			const statusKey = value.toUpperCase() as keyof typeof CASE_STATUS;
			const mappedStatus = CASE_STATUS[statusKey];

			if (mappedStatus === undefined) {
				logger.error(
					`Invalid status value: ${value} for case ${caseData.id}. Valid values: ${Object.keys(CASE_STATUS).join(", ")}`
				);
				return;
			}
			attributeValue = mappedStatus;
		}

		const event: CaseAttributeChangeEvent = {
			case_id: caseData.id,
			attribute_type: attributeType,
			attribute_value: attributeValue,
			comment: "Updated by workflow service"
		};

		try {
			await producer.send({
				topic: KAFKA_TOPICS.CASES_V1,
				messages: [
					{
						key: caseData.business_id ?? "",
						value: {
							event: KAFKA_MESSAGE_KEYS.WORKFLOW_CHANGE_ATTRIBUTE_EVENT,
							...event
						}
					}
				]
			});

			logger.info(`Case attribute change event sent for case ${caseData.id}: ${attributeType}=${attributeValue}`);
		} catch (error) {
			logger.error({ error }, `Failed to send case attribute change event for case ${caseData.id}`);
			throw error;
		}
	}
}
