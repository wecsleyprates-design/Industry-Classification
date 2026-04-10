import { CaseData } from "../types";

export interface ActionStrategy {
	execute(parameters: Record<string, unknown>, caseData: CaseData): Promise<void>;
}
