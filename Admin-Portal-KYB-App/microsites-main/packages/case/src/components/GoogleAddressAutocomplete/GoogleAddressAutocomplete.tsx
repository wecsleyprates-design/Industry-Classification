import React, { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { cn } from "@/lib/utils";

export interface AddressComponents {
	formattedAddress: string;
	streetNumber?: string;
	street?: string;
	city?: string;
	state?: string;
	postalCode?: string;
	country?: string;
	lat?: number;
	lng?: number;
}

interface GoogleAddressAutocompleteProps {
	value: string;
	onChange: (value: string, components?: AddressComponents) => void;
	onBlur?: () => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	hasError?: boolean;
	/** Restrict to specific countries (e.g., ['us', 'ca']) */
	restrictToCountries?: string[];
}

// Extend HTMLInputElement to store autocomplete instance
interface AutocompleteInputElement extends HTMLInputElement {
	__googleAutocomplete?: google.maps.places.Autocomplete;
	__autocompleteListenerId?: google.maps.MapsEventListener;
}

/**
 * Google Places Autocomplete input with auto-save on selection.
 *
 * When user selects an address from Google, it auto-saves (triggers onBlur).
 * Pac-container click detection prevents premature blur/exit during selection.
 */
export const GoogleAddressAutocomplete: React.FC<
	GoogleAddressAutocompleteProps
> = ({
	value,
	onChange,
	onBlur,
	placeholder = "Enter address...",
	disabled = false,
	className,
	hasError = false,
	restrictToCountries = ["us"],
}) => {
	const inputRef = useRef<AutocompleteInputElement>(null);
	const places = useMapsLibrary("places");

	// Internal state for the input value
	const [inputValue, setInputValue] = useState(value);

	// Tracks pac-container clicks to prevent premature blur during selection
	const clickedPacContainerRef = useRef(false);

	// Use refs for callbacks to avoid stale closures in event listeners
	const onChangeRef = useRef(onChange);
	const onBlurRef = useRef(onBlur);
	useEffect(() => {
		onChangeRef.current = onChange;
		onBlurRef.current = onBlur;
	}, [onChange, onBlur]);

	// Sync external value changes to internal state
	useEffect(() => {
		setInputValue(value);
	}, [value]);

	// Detect pac-container clicks (capture phase runs before blur)
	useEffect(() => {
		const handleMouseDown = (e: MouseEvent) => {
			if ((e.target as HTMLElement).closest(".pac-container")) {
				clickedPacContainerRef.current = true;
				setTimeout(() => {
					clickedPacContainerRef.current = false;
				}, 500);
			}
		};
		document.addEventListener("mousedown", handleMouseDown, true);
		return () => {
			document.removeEventListener("mousedown", handleMouseDown, true);
		};
	}, []);

	// Initialize Google Places Autocomplete - use DOM element to track instance
	// This prevents multiple autocomplete instances when React remounts the component
	useEffect(() => {
		const input = inputRef.current;
		if (!places || !input) return;

		// Check if this input element already has an autocomplete instance
		// This prevents duplicate initialization during React StrictMode double-mounting
		if (input.__googleAutocomplete) {
			// Update the listener with the current onChange ref
			if (input.__autocompleteListenerId) {
				google.maps.event.removeListener(
					input.__autocompleteListenerId,
				);
			}
			const autocompleteInstance = input.__googleAutocomplete;
			const listener = autocompleteInstance.addListener(
				"place_changed",
				() => {
					const place = autocompleteInstance.getPlace();
					const formattedAddress = place.formatted_address ?? "";

					if (formattedAddress) {
						const components = parseAddressComponents(place);
						setInputValue(formattedAddress);
						onChangeRef.current(formattedAddress, components);

						// Auto-save: trigger blur/exit after selection
						setTimeout(() => {
							onBlurRef.current?.();
						}, 50);
					}
				},
			);
			input.__autocompleteListenerId = listener;
			return;
		}

		const autocomplete = new places.Autocomplete(input, {
			types: ["address"],
			componentRestrictions: { country: restrictToCountries },
			fields: [
				"formatted_address",
				"address_components",
				"geometry.location",
			],
		});

		// Store on the DOM element itself so it survives React remounts
		input.__googleAutocomplete = autocomplete;

		// When user selects an address
		const listener = autocomplete.addListener("place_changed", () => {
			const place = autocomplete.getPlace();
			const formattedAddress = place.formatted_address ?? "";

			if (formattedAddress) {
				const components = parseAddressComponents(place);

				// Update the input value
				setInputValue(formattedAddress);

				// Notify parent of the change
				onChangeRef.current(formattedAddress, components);

				// Auto-save: trigger blur/exit after selection
				setTimeout(() => {
					onBlurRef.current?.();
				}, 50);
			}
		});
		input.__autocompleteListenerId = listener;

		// Note: We intentionally do NOT clean up on unmount
		// The autocomplete instance is tied to the DOM element, not the React component
		// Cleaning it up would cause issues with React StrictMode and HMR
	}, [places, restrictToCountries]);

	// Handle manual typing
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setInputValue(newValue);
		onChange(newValue);
	};

	// Handle blur - skip if user clicked on pac-container (let place_changed handle it)
	const handleBlur = () => {
		if (clickedPacContainerRef.current) {
			return;
		}
		onBlur?.();
	};

	return (
		<input
			ref={inputRef}
			type="text"
			value={inputValue}
			onChange={handleChange}
			onBlur={handleBlur}
			placeholder={placeholder}
			disabled={disabled}
			className={cn(
				"flex h-10 rounded-md border bg-white px-3 py-2 text-sm",
				"transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
				"disabled:cursor-not-allowed disabled:opacity-50",
				hasError
					? "border-red-500 focus-visible:ring-red-500"
					: "border-gray-300",
				className,
			)}
			style={{ minWidth: "300px" }}
			autoComplete="off"
		/>
	);
};

/**
 * Parse Google Places address_components into a structured format
 */
function parseAddressComponents(
	place: google.maps.places.PlaceResult,
): AddressComponents {
	const components: AddressComponents = {
		formattedAddress: place.formatted_address ?? "",
	};

	if (place.geometry?.location) {
		components.lat = place.geometry.location.lat();
		components.lng = place.geometry.location.lng();
	}

	if (!place.address_components) {
		return components;
	}

	for (const component of place.address_components) {
		const types = component.types;

		if (types.includes("street_number")) {
			components.streetNumber = component.long_name;
		} else if (types.includes("route")) {
			components.street = component.long_name;
		} else if (types.includes("locality")) {
			components.city = component.long_name;
		} else if (types.includes("administrative_area_level_1")) {
			components.state = component.short_name;
		} else if (types.includes("postal_code")) {
			components.postalCode = component.long_name;
		} else if (types.includes("country")) {
			components.country = component.short_name;
		}
	}

	return components;
}

export default GoogleAddressAutocomplete;
