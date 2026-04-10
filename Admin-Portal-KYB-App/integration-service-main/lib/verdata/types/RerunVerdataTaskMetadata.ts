import { WorthInternalOrder } from "./types";

export type RerunVerdataTaskMetadata = Omit<WorthInternalOrder, "task_id" | "phone">;
