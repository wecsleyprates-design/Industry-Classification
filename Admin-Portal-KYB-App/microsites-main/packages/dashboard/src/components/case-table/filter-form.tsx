import React from "react";
import { type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/ui/form";
import { Input } from "@/ui/input";

export const filterFormSchema = z.object({
	caseType: z.array(z.string()),
	status: z.array(z.string()),
	riskMonitoring: z.array(z.string()),
	minWorthScore: z.string().optional(),
	maxWorthScore: z.string().optional(),
	onboardingDate: z
		.object({
			from: z.date().optional(),
			to: z.date().optional(),
		})
		.optional(),
});

export type FilterFormValues = z.infer<typeof filterFormSchema>;

export interface FilterFormProps {
	form: UseFormReturn<FilterFormValues>;
	onFilterChange: (values: FilterFormValues) => void;
	caseTypes: string[];
	caseStatuses: string[];
	onClose?: () => void;
}

export const FilterForm: React.FC<FilterFormProps> = ({
	form,
	onFilterChange,
	caseTypes = [],
	caseStatuses = [],
	onClose,
}) => {
	const handleApply = () => {
		onFilterChange(form.getValues());
		onClose?.();
	};

	const handleReset = () => {
		const defaultValues = {
			caseType: [],
			status: [],
			riskMonitoring: [],
			minWorthScore: "",
			maxWorthScore: "",
			onboardingDate: undefined,
		};
		form.reset(defaultValues);
		onFilterChange(defaultValues);
	};

	return (
		<Form {...form}>
			<div className="flex flex-col">
				<div className="flex-1 overflow-y-scroll ">
					<div className="flex flex-col gap-4 py-4 px-2 w-full  h-[400px]">
						{/* Case Type Section */}
						<FormField
							control={form.control}
							name="caseType"
							render={() => (
								<FormItem>
									<FormLabel className="mb-4 text-sm text-gray-500 font-base">
										Case Type
									</FormLabel>
									<div className="grid grid-cols-2 gap-y-4">
										{caseTypes.map((type) => (
											<FormField
												key={type}
												control={form.control}
												name="caseType"
												render={({ field }) => (
													<FormItem className="flex flex-row items-start p-0 space-x-2 space-y-0">
														<FormControl>
															<Checkbox
																checked={field.value?.includes(type)}
																onCheckedChange={(checked) => {
																	if (checked) {
																		field.onChange([
																			...(field.value || []),
																			type,
																		]);
																	} else {
																		field.onChange(
																			field.value?.filter(
																				(value) => value !== type,
																			),
																		);
																	}
																}}
																className="mt-1 h-4 w-4 border-2 rounded-[4px]"
															/>
														</FormControl>
														<FormLabel className="text-sm font-normal cursor-pointer leading-none pt-[0.25rem]">
															{type}
														</FormLabel>
													</FormItem>
												)}
											/>
										))}
									</div>
								</FormItem>
							)}
						/>

						{/* Status Section */}
						<FormField
							control={form.control}
							name="status"
							render={() => (
								<FormItem>
									<FormLabel className="mb-4 text-sm text-gray-500 font-base">
										Status
									</FormLabel>
									<div className="grid grid-cols-2 gap-y-4">
										{caseStatuses.map((status) => (
											<FormField
												key={status}
												control={form.control}
												name="status"
												render={({ field }) => (
													<FormItem className="flex flex-row items-start p-0 space-x-2 space-y-0">
														<FormControl>
															<Checkbox
																checked={field.value?.includes(status)}
																onCheckedChange={(checked) => {
																	if (checked) {
																		field.onChange([
																			...(field.value || []),
																			status,
																		]);
																	} else {
																		field.onChange(
																			field.value?.filter(
																				(value) => value !== status,
																			),
																		);
																	}
																}}
																className="mt-1 h-4 w-4 border-2 rounded-[4px]"
															/>
														</FormControl>
														<FormLabel className="text-sm font-normal cursor-pointer leading-none pt-[0.25rem]">
															{status}
														</FormLabel>
													</FormItem>
												)}
											/>
										))}
									</div>
								</FormItem>
							)}
						/>

						{/* Worth Score Section */}
						<div className="flex flex-col gap-2">
							<FormLabel className="-mb-2 text-sm text-gray-500 font-base">
								Worth Score
							</FormLabel>
							<div className="flex gap-4">
								<FormField
									control={form.control}
									name="minWorthScore"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-sm font-medium">Min</FormLabel>
											<FormControl>
												<Input
													type="number"
													{...field}
													className="w-[100px] rounded-lg border border-gray-200"
													min={0}
													onBlur={() => {
														if (field.value && +field.value < 0) {
															field.onChange(0);
														}
													}}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="maxWorthScore"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-sm font-medium">Max</FormLabel>
											<FormControl>
												<Input
													type="number"
													{...field}
													className="w-[100px] rounded-lg border border-gray-200"
													max={850}
													onBlur={() => {
														if (field.value && +field.value > 850) {
															field.onChange(850);
														}
													}}
												/>
											</FormControl>
										</FormItem>
									)}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Footer - Fixed at bottom */}
				<div className="pt-4 bg-white border-t">
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							className="text-blue-600"
							onClick={handleReset}
						>
							Reset
						</Button>
						<Button
							type="button"
							className="text-white bg-blue-600"
							onClick={handleApply}
						>
							Apply
						</Button>
					</div>
				</div>
			</div>
		</Form>
	);
};
