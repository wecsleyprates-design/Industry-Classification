import React, { createContext, useContext, useMemo } from "react";
import type {
	AttributesCatalog,
	CatalogItem,
	ConditionOperator,
} from "@/types/workflows";

interface RuleBuilderContextValue {
	catalog: AttributesCatalog;
	contexts: string[];
	isLoading: boolean;
	getAttributesForContext: (context: string) => CatalogItem[];
	getAttributeConfig: (
		context: string,
		attributeName: string,
	) => CatalogItem | undefined;
	getOperatorsForAttribute: (
		context: string,
		attributeName: string,
	) => ConditionOperator[];
}

const RuleBuilderContext = createContext<RuleBuilderContextValue | null>(null);

export const useRuleBuilderContext = (): RuleBuilderContextValue => {
	const context = useContext(RuleBuilderContext);
	if (!context) {
		throw new Error(
			"useRuleBuilderContext must be used within RuleBuilderProvider",
		);
	}
	return context;
};

interface RuleBuilderProviderProps {
	catalog: AttributesCatalog;
	isLoading?: boolean;
	children: React.ReactNode;
}

export const RuleBuilderProvider: React.FC<RuleBuilderProviderProps> = ({
	catalog,
	isLoading = false,
	children,
}) => {
	const contexts = useMemo(() => Object.keys(catalog), [catalog]);

	const getAttributesForContext = useMemo(
		() =>
			(context: string): CatalogItem[] =>
				catalog[context] ?? [],
		[catalog],
	);

	const getAttributeConfig = useMemo(
		() =>
			(context: string, attributeName: string): CatalogItem | undefined => {
				const attributes = catalog[context];
				if (!attributes) return undefined;
				return attributes.find((item) => item.attribute.name === attributeName);
			},
		[catalog],
	);

	const getOperatorsForAttribute = useMemo(
		() =>
			(context: string, attributeName: string): ConditionOperator[] => {
				const config = getAttributeConfig(context, attributeName);
				return config?.operators ?? [];
			},
		[getAttributeConfig],
	);

	const value = useMemo<RuleBuilderContextValue>(
		() => ({
			catalog,
			contexts,
			isLoading,
			getAttributesForContext,
			getAttributeConfig,
			getOperatorsForAttribute,
		}),
		[
			catalog,
			contexts,
			isLoading,
			getAttributesForContext,
			getAttributeConfig,
			getOperatorsForAttribute,
		],
	);

	return (
		<RuleBuilderContext.Provider value={value}>
			{children}
		</RuleBuilderContext.Provider>
	);
};
