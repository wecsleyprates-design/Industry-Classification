import { permissionMapping } from "./permissionsMapper";

import { PERMISSION_DEPENDENCIES } from "@/constants";

/**
 * Gets a user-readable label for a permission code
 * Priority: 1. Dependency config label, 2. permissionMapping label, 3. Permission code
 * @param permissionCode - The permission code
 * @param dependencyConfig - Optional dependency config for custom labels
 * @returns User-readable label
 */
export const getPermissionLabel = (
	permissionCode: string,
	dependencyConfig?: {
		trigger_permission?: string;
		trigger_permission_label?: string;
		required_permissions_labels?: Record<string, string>;
	},
): string => {
	// First, check if it's a required permission with custom label
	// This must be checked before trigger permission to avoid incorrect matches
	if (dependencyConfig?.required_permissions_labels?.[permissionCode]) {
		return dependencyConfig.required_permissions_labels[permissionCode];
	}

	// Check if it's the trigger permission with custom label
	// Only return trigger label if the permissionCode actually matches the trigger permission
	if (
		dependencyConfig?.trigger_permission === permissionCode &&
		dependencyConfig?.trigger_permission_label
	) {
		return dependencyConfig.trigger_permission_label;
	}

	// Fallback to permissionMapping
	const mapping = permissionMapping[permissionCode];
	if (mapping?.label) {
		return mapping.label;
	}

	// Last resort: return the permission code
	return permissionCode;
};

// Store animation state per element to prevent memory leaks
const highlightAnimationState = new WeakMap<
	HTMLElement,
	{
		pulseInterval: NodeJS.Timeout | null;
		cleanupTimeout: NodeJS.Timeout | null;
		restoreTimeout: NodeJS.Timeout | null;
		originalClasses: string;
	}
>();

/**
 * Highlights an element with an animated border and shadow effect
 * Properly handles cleanup to prevent memory leaks
 * @param element - The HTML element to highlight
 * @param duration - Duration in milliseconds (default: 3000ms)
 * @returns Cleanup function to cancel the animation
 */
export const highlightElement = (
	element: HTMLElement,
	duration = 3000,
): (() => void) => {
	// Clean up any existing animation on this element first
	const existingState = highlightAnimationState.get(element);
	if (existingState) {
		if (existingState.pulseInterval) {
			clearInterval(existingState.pulseInterval);
		}
		if (existingState.cleanupTimeout) {
			clearTimeout(existingState.cleanupTimeout);
		}
		if (existingState.restoreTimeout) {
			clearTimeout(existingState.restoreTimeout);
		}
		// Restore original classes before starting new animation
		element.className = existingState.originalClasses;
	}

	// Store original class list to restore later
	const originalClasses = element.className;

	// Apply highlight Tailwind classes
	element.classList.add(
		"border-2",
		"border-blue-600",
		"rounded-lg",
		"transition-all",
		"duration-300",
		"ease-in-out",
		"outline",
		"outline-2",
		"outline-transparent",
		"outline-offset-2",
		"shadow-[0_0_0_4px_rgba(37,99,235,0.1),0_4px_12px_rgba(37,99,235,0.15)]",
	);

	// Add a subtle pulse animation by toggling shadow classes
	let pulseCount = 0;
	const maxPulses = 3;
	const pulseInterval = duration / (maxPulses * 2);

	const pulseAnimation = setInterval(() => {
		// Check if element is still in DOM
		if (!document.body.contains(element)) {
			clearInterval(pulseAnimation);
			highlightAnimationState.delete(element);
			return;
		}

		if (pulseCount >= maxPulses) {
			clearInterval(pulseAnimation);
			return;
		}

		// Toggle between two shadow intensities for pulse effect
		if (pulseCount % 2 === 0) {
			element.classList.remove(
				"shadow-[0_0_0_4px_rgba(37,99,235,0.1),0_4px_12px_rgba(37,99,235,0.15)]",
			);
			element.classList.add(
				"shadow-[0_0_0_6px_rgba(37,99,235,0.15),0_4px_16px_rgba(37,99,235,0.2)]",
			);
		} else {
			element.classList.remove(
				"shadow-[0_0_0_6px_rgba(37,99,235,0.15),0_4px_16px_rgba(37,99,235,0.2)]",
			);
			element.classList.add(
				"shadow-[0_0_0_4px_rgba(37,99,235,0.1),0_4px_12px_rgba(37,99,235,0.15)]",
			);
		}

		pulseCount++;
	}, pulseInterval);

	// Remove highlight after duration
	const cleanupTimeout = setTimeout(() => {
		// Check if element is still in DOM
		if (!document.body.contains(element)) {
			highlightAnimationState.delete(element);
			return;
		}

		clearInterval(pulseAnimation);

		// Add fade-out transition
		element.classList.remove("duration-300");
		element.classList.add("duration-500");

		// Remove highlight classes
		element.classList.remove(
			"border-2",
			"border-blue-600",
			"rounded-lg",
			"transition-all",
			"duration-500",
			"ease-in-out",
			"outline",
			"outline-2",
			"outline-transparent",
			"outline-offset-2",
			"shadow-[0_0_0_4px_rgba(37,99,235,0.1),0_4px_12px_rgba(37,99,235,0.15)]",
			"shadow-[0_0_0_6px_rgba(37,99,235,0.15),0_4px_16px_rgba(37,99,235,0.2)]",
		);

		// Restore original classes after transition completes
		const restoreTimeout = setTimeout(() => {
			// Check if element is still in DOM
			if (document.body.contains(element)) {
				element.className = originalClasses;
			}
			highlightAnimationState.delete(element);
		}, 500);

		// Update state with restore timeout
		const currentState = highlightAnimationState.get(element);
		if (currentState) {
			currentState.restoreTimeout = restoreTimeout;
		}
	}, duration);

	// Store animation state for cleanup
	highlightAnimationState.set(element, {
		pulseInterval: pulseAnimation,
		cleanupTimeout,
		restoreTimeout: null,
		originalClasses,
	});

	// Return cleanup function
	return () => {
		const state = highlightAnimationState.get(element);
		if (state) {
			if (state.pulseInterval) {
				clearInterval(state.pulseInterval);
			}
			if (state.cleanupTimeout) {
				clearTimeout(state.cleanupTimeout);
			}
			if (state.restoreTimeout) {
				clearTimeout(state.restoreTimeout);
			}
			// Restore original classes immediately
			if (document.body.contains(element)) {
				element.className = state.originalClasses;
			}
			highlightAnimationState.delete(element);
		}
	};
};

/**
 * Determines which tab a permission belongs to based on its code
 * @param permissionCode - The permission code (e.g., "customer_user:read", "case:write:assignment")
 * @returns "admin" or "features"
 */
export const getPermissionTab = (
	permissionCode: string,
): "admin" | "features" => {
	const mapping = permissionMapping[permissionCode];
	return mapping.type === "Admin" ? "admin" : "features";
};

/**
 * Finds a permission element by its permission code
 * Tries multiple strategies: by ID, by data attribute, by prefix, or by label
 * @param permissionCode - The permission code to find
 * @returns The HTML element if found, null otherwise
 */
export const findPermissionElement = (
	permissionCode: string,
	triggerLabel?: string | null,
): HTMLElement | null => {
	// Strategy 1: Find by exact data-permission-code match
	const elementByDataAttr = document.querySelector(
		`[data-permission-code="${permissionCode}"]`,
	);
	if (elementByDataAttr && elementByDataAttr instanceof HTMLElement)
		return elementByDataAttr;

	// Strategy 2: When navigating to a trigger (e.g. Send Invites), find by id from label (ConfigCard uses id="permission-${label.toLowerCase()}")
	if (triggerLabel != null && String(triggerLabel).trim() !== "") {
		const idFromLabel =
			"permission-" + String(triggerLabel).trim().toLowerCase();
		const elementById = document.getElementById(idFromLabel);
		if (elementById && elementById instanceof HTMLElement) return elementById;
	}

	return null;
};

/**
 * Navigates to a permission and highlights it
 * Works for both directions: from trigger to required, and from required to trigger
 * @param permissionCode - The permission code to navigate to
 * @param setTabValue - Function to set the active tab
 * @param scrollDelay - Delay before scrolling (default: 200ms to allow React to render)
 * @param highlightDelay - Delay before highlighting (default: 100ms after scroll)
 * @param highlightDuration - Duration of highlight animation (default: 3000ms)
 */
export const navigateToPermission = (
	permissionCode: string,
	setTabValue?: (tab: "admin" | "features") => void,
	scrollDelay = 200,
	highlightDelay = 100,
	highlightDuration = 3000,
) => {
	if (!setTabValue) return;

	const targetTab = getPermissionTab(permissionCode);
	setTabValue(targetTab);

	// Function to find and highlight with retry mechanism
	const findAndHighlight = (retries = 20, retryDelay = 150) => {
		const element = findPermissionElement(permissionCode);

		if (element) {
			// Check if element is visible
			const isVisible = element.offsetParent !== null;

			if (isVisible) {
				// Element found and visible - scroll and highlight
				element.scrollIntoView({ behavior: "smooth", block: "center" });
				setTimeout(() => {
					highlightElement(element, highlightDuration);
				}, highlightDelay);
			}
		}
	};

	// Wait for tab switch and React to render, then find and highlight
	setTimeout(() => {
		// Use requestAnimationFrame to ensure DOM is ready after tab switch
		requestAnimationFrame(() => {
			// Give one more frame for Radix UI tabs to fully render content
			requestAnimationFrame(() => {
				// Give one more frame to ensure all content is rendered
				requestAnimationFrame(() => {
					findAndHighlight();
				});
			});
		});
	}, scrollDelay);
};

/**
 * Same as navigateToPermission but when finding the element, also tries id from trigger label
 * (ConfigCard sets id="permission-${label.toLowerCase()}" so e.g. "Send Invites" -> "permission-send invites").
 * Used for back navigation from dependee (Business) to trigger (Send Invites).
 * Radix Tabs unmounts inactive tab content, so Features tab content is not in DOM until after setTabValue("features");
 * we use a longer initial delay and retries so the element exists before we look for it.
 */
function navigateToPermissionWithTriggerFallback(
	permissionCode: string,
	triggerPermissionLabel: string | undefined,
	setTabValue?: (tab: "admin" | "features") => void,
	scrollDelay = 450,
	highlightDelay = 100,
	highlightDuration = 3000,
) {
	if (!setTabValue) return;

	const targetTab = getPermissionTab(permissionCode);
	setTabValue(targetTab);

	const findAndHighlight = () => {
		const element = findPermissionElement(
			permissionCode,
			triggerPermissionLabel,
		);

		if (element) {
			// Scroll and highlight even if offsetParent is null (tab may still be switching)
			element.scrollIntoView({ behavior: "smooth", block: "center" });
			setTimeout(() => {
				highlightElement(element, highlightDuration);
			}, highlightDelay);
			return true;
		}
		return false;
	};

	// Radix unmounts inactive tabs, so Features content mounts only after tab switch; retry until element exists
	const attemptFind = (attempt = 0, maxAttempts = 30, interval = 100) => {
		if (findAndHighlight()) return;
		if (attempt < maxAttempts) {
			setTimeout(() => {
				attemptFind(attempt + 1, maxAttempts, interval);
			}, interval);
		}
	};

	setTimeout(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					attemptFind();
				});
			});
		});
	}, scrollDelay);
}

/**
 * Navigates to a required permission from a trigger permission
 * Uses required_permissions_code to find the div by ID if available
 * @param triggerPermissionCode - The trigger permission code
 * @param setTabValue - Function to set the active tab
 */
export const navigateToRequiredPermission = (
	triggerPermissionCode: string,
	setTabValue?: (tab: "admin" | "features") => void,
) => {
	const dependencyConfig = PERMISSION_DEPENDENCIES.find(
		(dep) => dep.trigger_permission === triggerPermissionCode,
	);

	if (!dependencyConfig || dependencyConfig.required_permissions.length === 0) {
		return;
	}

	// If required_permissions_code is provided, navigate to the div by ID
	if (dependencyConfig.required_permissions_code) {
		// Determine which tab the element is in by checking the first required permission
		const firstRequiredPermission = dependencyConfig.required_permissions[0];
		const targetTab = getPermissionTab(firstRequiredPermission);

		if (setTabValue) {
			setTabValue(targetTab);
		}

		// Function to find and highlight the element by ID
		const findAndHighlightById = () => {
			if (!dependencyConfig.required_permissions_code) return;

			const element = document.getElementById(
				dependencyConfig.required_permissions_code,
			);

			if (element && element instanceof HTMLElement) {
				// Check if element is visible
				const isVisible = element.offsetParent !== null;

				if (isVisible) {
					// Element found and visible - scroll and highlight
					element.scrollIntoView({ behavior: "smooth", block: "center" });
					setTimeout(() => {
						highlightElement(element, 3000);
					}, 100);
				}
			}
		};

		// Wait for tab switch and React to render, then find and highlight
		setTimeout(() => {
			// Use requestAnimationFrame to ensure DOM is ready after tab switch
			requestAnimationFrame(() => {
				// Give one more frame for Radix UI tabs to fully render content
				requestAnimationFrame(() => {
					// Give one more frame to ensure all content is rendered
					requestAnimationFrame(() => {
						findAndHighlightById();
					});
				});
			});
		}, 200);

		return;
	}

	// Fallback: Prefer read permission, otherwise use the first one
	const readPerm = dependencyConfig.required_permissions.find((p) =>
		p.endsWith(":read"),
	);
	const targetPermission = readPerm ?? dependencyConfig.required_permissions[0];

	navigateToPermission(targetPermission, setTabValue);
};

/**
 * Navigates to a trigger permission from a required permission (e.g. from Business dropdown back to Send Invites).
 * Finds dependency when requiredPermissionCode is an exact required permission, a base, or in the same group (e.g. "businesses:read" or "businesses" match businesses:write/create).
 */
export const navigateToTriggerPermission = (
	requiredPermissionCode: string,
	setTabValue?: (tab: "admin" | "features") => void,
) => {
	const code = requiredPermissionCode?.trim() ?? "";
	const codePrefix = code.split(":")[0];
	const dependencyConfig = PERMISSION_DEPENDENCIES.find((dep) =>
		dep.required_permissions.some(
			(rp) =>
				rp === code ||
				rp.startsWith(code + ":") ||
				code.startsWith(rp + ":") ||
				(codePrefix && rp.split(":")[0] === codePrefix),
		),
	);

	if (!dependencyConfig) {
		return;
	}

	navigateToPermissionWithTriggerFallback(
		dependencyConfig.trigger_permission,
		dependencyConfig.trigger_permission_label,
		setTabValue,
	);
};
