import { z } from "zod";
import { type FilterConfigItem } from "./filter-form";

export const createFilterSchema = (config: FilterConfigItem[]) => {
	const shape = config
		.filter((filter) => !filter.hidden)
		.reduce<Record<string, z.ZodType<any, any>>>((acc, filter) => {
			switch (filter.type) {
				case "checkbox-group":
				case "dropdown-checkbox":
					acc[filter.name] = z.array(z.string()).optional();
					break;
				case "number-range":
					acc[filter.min.name] = z.string().optional();
					acc[filter.max.name] = z.string().optional();
					break;
				case "date-range":
					acc[filter.name] = z
						.object({
							from: z.date().optional(),
							to: z.date().optional(),
						})
						.optional();
					break;
			}
			return acc;
		}, {});

	return z.object(shape);
};
