import React, { useEffect, useRef, useState } from "react";
import {
	type FieldValues,
	type Path,
	type PathValue,
	type UseFormSetValue,
} from "react-hook-form";
import { MapPinIcon } from "@heroicons/react/20/solid";
import { type Libraries, useLoadScript } from "@react-google-maps/api";
import { parseAddressComponentsFromPlaceResult } from "@/lib/utils";

import { envConfig } from "@/config/envConfig";

const library: Libraries = ["places"];

export type PlaceComponentResponse = {
	/**
	 * Note: The company name will only be returned if the `isBusiness` prop is `true`.
	 */
	companyName?: string;
	street: string;
	zip: string;
	suite: string;
	city: string;
	state: string;
	country: string;
	website: string;
	placeId: string;
	address: string;
};

const renderStyledSuggestion = (description: string) => {
	const parts = description.split(",");
	const firstPart = parts[0]?.trim() || "";
	const match = firstPart.match(/^(\d+)\s+(.+)/); // Matches "123 StreetName"

	return (
		<div className="flex flex-wrap items-center">
			{match ? (
				<>
					<span className="mr-1 text-sm font-bold">{match[1]}</span>{" "}
					<span className="font-semibold">{match[2]}</span>,
				</>
			) : (
				<span className="text-sm font-semibold">{firstPart}</span>
			)}
			{parts.slice(1).map((part, index) => (
				<span key={index} className="ml-1 text-xs font-normal text-gray-600">
					{part.trim()}
					{index + 1 < parts.slice(1).length ? ", " : ""}
				</span>
			))}
		</div>
	);
};

export interface PlacesAutocompleteProps<T extends FieldValues> {
	name: Path<T>;
	children: React.ReactElement;
	setValue: UseFormSetValue<T>;
	handleReset?: (val: PlaceComponentResponse) => void;
	onPlaceSelect?: (val: PlaceComponentResponse) => void;
	onChange?: () => void;
	isBusiness?: boolean;
	countryRestriction?: string | null;
}

export function PlacesAutocomplete<T extends FieldValues>({
	name,
	children,
	setValue,
	handleReset,
	onPlaceSelect,
	isBusiness,
	countryRestriction,
}: PlacesAutocompleteProps<T>) {
	const [suggestions, setSuggestions] = useState<
		google.maps.places.AutocompletePrediction[]
	>([]);
	const { isLoaded } = useLoadScript({
		googleMapsApiKey: envConfig.VITE_GOOGLE_MAPS_API_KEY ?? "",
		libraries: library,
	});

	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const geocoder = useRef<google.maps.Geocoder | null>(null);

	useEffect(() => {
		if (isLoaded) {
			geocoder.current = new window.google.maps.Geocoder();
		}
		// Cleanup to ensure no shared state between pages
		return () => {
			geocoder.current = null;
			setSuggestions([]);
		};
	}, [isLoaded]);

	// Fetch address suggestions via AutocompleteService
	const fetchSuggestions = async (input: string) => {
		if (!input || !window.google?.maps?.places?.AutocompleteService) {
			setSuggestions([]);
			return;
		}

		const service = new window.google.maps.places.AutocompleteService();
		await service.getPlacePredictions(
			{
				input,
				types: [isBusiness ? "establishment" : "address"],
				componentRestrictions: countryRestriction
					? { country: countryRestriction.toLowerCase() }
					: { country: ["us", "ca"] },
			},
			(predictions, status) => {
				if (status === window.google.maps.places.PlacesServiceStatus.OK) {
					setSuggestions(predictions ?? []);
				} else {
					setSuggestions([]);
				}
			},
		);
	};

	const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setValue(name, value as PathValue<T, Path<T>>);
		await fetchSuggestions(value);
	};

	const handleSuggestionSelect = async (
		suggestion: google.maps.places.AutocompletePrediction,
	) => {
		setValue(name, suggestion.description as PathValue<T, Path<T>>);
		await fetchPlaceDetails(suggestion.place_id);
		setSuggestions([]); // Hide dropdown after selection
	};

	const fetchPlaceDetails = async (placeId: string) => {
		if (!window.google?.maps) return;

		const service = new window.google.maps.places.PlacesService(
			document.createElement("div"),
		);

		service.getDetails({ placeId }, (place, status) => {
			if (status === google.maps.places.PlacesServiceStatus.OK && place) {
				const val: PlaceComponentResponse =
					parseAddressComponentsFromPlaceResult(place);

				/**
				 * If we're searching for addresses (types: ["address"]), the `place.name` will be the street address and *not* the business name.
				 * Thus, only set the company name if we're searching for businesses (types: ["establishment"])
				 */
				if (isBusiness) val.companyName = place.name ?? "";
				handleReset?.(val);
				onPlaceSelect?.(val);
			}
		});
	};

	/**
	 * When the user clicks outside the container, close the dropdown.
	 *
	 * Note: We're using mousedown instead of click to ensure the event is captured even if this
	 * component is inside a modal or other element that prevents clicks from bubbling up.
	 */
	useEffect(() => {
		const handleOutsideMouseDown = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setSuggestions([]);
			}
		};

		document.addEventListener("mousedown", handleOutsideMouseDown);
		return () => {
			document.removeEventListener("mousedown", handleOutsideMouseDown);
		};
	}, []);

	return (
		<div ref={containerRef} className="relative w-full">
			{/* Input Field */}
			{React.cloneElement(children as React.ReactElement<any>, {
				ref: inputRef,
				onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
					(children as React.ReactElement<any>).props?.onChange?.(e);
					void handleInputChange(e);
				},
			})}

			{/* Suggestions Dropdown */}
			{suggestions.length > 0 && (
				<ul className="absolute left-0 right-0 z-10 mt-1 overflow-auto bg-white border border-gray-300 rounded shadow-lg max-h-60">
					{suggestions.map((suggestion, index) => (
						<li
							key={suggestion.place_id}
							onClick={async () => {
								await handleSuggestionSelect(suggestion);
							}}
							className={`flex items-center px-2 py-2 cursor-pointer hover:bg-blue-100 border-b truncate ${
								index === 0 ? "rounded-t" : ""
							} ${index === suggestions.length - 1 ? "rounded-b" : ""}`}
						>
							<MapPinIcon className="mr-2 text-gray-400 truncate min-w-4 max-w-4" />
							{renderStyledSuggestion(suggestion.description)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export default PlacesAutocomplete;
