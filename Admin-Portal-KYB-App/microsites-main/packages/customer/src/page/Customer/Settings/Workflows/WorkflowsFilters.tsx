import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { WorkflowStatus } from "@/types/workflows";

import { Checkbox } from "@/ui/checkbox";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/ui/form";

interface WorkflowsFiltersProps {
	onFilterChange: (filters: WorkflowFilters) => void;
	onClearFilters: () => void;
	hasActiveFilters: boolean;
}

export interface WorkflowFilters {
	status?: WorkflowStatus[];
}

const filterSchema = z.object({
	status: z.array(z.string()).optional(),
});

type FilterFormValues = z.infer<typeof filterSchema>;

const WorkflowsFilters: React.FC<WorkflowsFiltersProps> = ({
	onFilterChange,
	onClearFilters,
	hasActiveFilters,
}) => {
	const form = useForm<FilterFormValues>({
		resolver: zodResolver(filterSchema),
		defaultValues: {
			status: [],
		},
	});

	const handleFilterChange = React.useCallback(
		(values: FilterFormValues) => {
			const filters: WorkflowFilters = {
				status: values.status as WorkflowStatus[] | undefined,
			};
			onFilterChange(filters);
		},
		[onFilterChange],
	);

	// Reset form when filters are cleared (hasActiveFilters becomes false)
	useEffect(() => {
		if (!hasActiveFilters) {
			form.reset({
				status: [],
			});
		}
	}, [hasActiveFilters, form]);

	useEffect(() => {
		const subscription = form.watch((values) => {
			handleFilterChange(values as FilterFormValues);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [form, handleFilterChange]);

	const statusOptions: Array<{ label: string; value: WorkflowStatus }> = [
		{ label: "Active", value: "active" },
		{ label: "Inactive", value: "inactive" },
	];

	return (
		<FilterOptionsDropdown
			form={
				<Form {...form}>
					<form className="space-y-4">
						<FormField
							control={form.control}
							name="status"
							render={() => (
								<FormItem>
									<FormLabel className="text-sm font-base text-gray-500 mb-4">
										Status
									</FormLabel>
									<div className="space-y-4">
										{statusOptions.map((option) => (
											<FormField
												key={option.value}
												control={form.control}
												name="status"
												render={({ field }) => (
													<FormItem className="flex flex-row items-start space-x-2 space-y-0 p-0">
														<FormControl>
															<Checkbox
																checked={field.value?.includes(option.value)}
																onCheckedChange={(checked) => {
																	const currentValue = field.value ?? [];
																	if (checked) {
																		field.onChange([
																			...currentValue,
																			option.value,
																		]);
																	} else {
																		field.onChange(
																			currentValue.filter(
																				(value) => value !== option.value,
																			),
																		);
																	}
																}}
															/>
														</FormControl>
														<FormLabel className="text-sm font-normal cursor-pointer">
															{option.label}
														</FormLabel>
													</FormItem>
												)}
											/>
										))}
									</div>
								</FormItem>
							)}
						/>
					</form>
				</Form>
			}
			onClearFilters={onClearFilters}
			hasActiveFilters={hasActiveFilters}
		/>
	);
};

export const WorkflowsNoResultsState: React.FC<{
	onClearFilters: () => void;
}> = ({ onClearFilters }) => {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4">
			<div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-blue-100">
				<ExclamationTriangleIcon className="w-6 h-6 text-blue-600" />
			</div>
			<p className="text-sm font-medium text-[#1F2937] mb-2">
				No workflows match the selected filters
			</p>
			<button
				type="button"
				onClick={onClearFilters}
				className="text-sm text-red-600 hover:text-red-700 underline"
			>
				Clear Filters
			</button>
		</div>
	);
};

export default WorkflowsFilters;
