import { Workflows } from "@joinworth/types";

export const VERSION_CHANGE_TYPES = Workflows.Versions.VERSION_CHANGE_TYPES;

export type VersionChangeType = (typeof VERSION_CHANGE_TYPES)[keyof typeof VERSION_CHANGE_TYPES];
