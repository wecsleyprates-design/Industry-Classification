export { CaseService } from "./caseService";
export type { CaseServiceResponse, CaseServiceError, CaseServiceConfig } from "./types";

// Create a singleton instance for the application
import { CaseService } from "./caseService";

export const caseService = new CaseService();
