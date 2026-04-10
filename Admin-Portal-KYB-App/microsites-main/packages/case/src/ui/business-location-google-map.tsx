import React, { useCallback, useState } from "react";
import {
	AdvancedMarker,
	InfoWindow,
	Map,
	Pin,
	useAdvancedMarkerRef,
	useApiIsLoaded,
} from "@vis.gl/react-google-maps";

import { Skeleton } from "@/ui/skeleton";

export interface BusinessLocation {
	position: {
		lat: number;
		lng: number;
	};
	name: string;
	description: string;
}

interface BusinessLocationGoogleMapProps {
	className?: string;
	location: BusinessLocation | null;
	isLoadingAddress?: boolean;
}

export const BusinessLocationGoogleMap: React.FC<
	BusinessLocationGoogleMapProps
> = ({ className, location, isLoadingAddress = false }) => {
	const [infoWindowShown, setInfoWindowShown] = useState(false);
	const [selectedMarker, setSelectedMarker] =
		useState<google.maps.marker.AdvancedMarkerElement | null>(null);
	const [zoom, setZoom] = useState(15);
	const apiIsLoaded = useApiIsLoaded();

	const onMarkerClick = useCallback(
		(marker: google.maps.marker.AdvancedMarkerElement) => {
			setSelectedMarker(marker);
			setInfoWindowShown((prev) => !prev);
		},
		[],
	);

	const onMapClick = useCallback(() => {
		setInfoWindowShown(false);
	}, []);

	const handleInfoWindowCloseClick = useCallback(() => {
		setInfoWindowShown(false);
	}, []);

	if (!apiIsLoaded || isLoadingAddress) {
		return (
			<div className={className}>
				<Skeleton className="w-full h-[400px] rounded-xl" />
			</div>
		);
	}

	if (!location) {
		return null;
	}

	return (
		<div className={className}>
			<Map
				mapId={"bf51a910020fa25a"}
				zoom={zoom}
				center={location.position}
				gestureHandling={"greedy"}
				onClick={onMapClick}
				clickableIcons={false}
				onZoomChanged={(ev) => {
					setZoom(ev.detail.zoom);
				}}
				className={className}
				style={{ width: "100%", height: "400px" }}
			>
				<AdvancedMarkerWithRef
					position={location.position}
					onMarkerClick={onMarkerClick}
					className="custom-marker"
				>
					<Pin
						background={"#f44242"}
						borderColor={"#ce2e2e"}
						glyphColor={"#FFFFFF"}
					/>
				</AdvancedMarkerWithRef>

				{infoWindowShown && selectedMarker && (
					<InfoWindow
						anchor={selectedMarker}
						onCloseClick={handleInfoWindowCloseClick}
						headerContent={
							<div className="flex items-center -mt-1">
								<h2 className="text-lg font-semibold text-gray-800">
									{location.name}
								</h2>
							</div>
						}
						style={{ maxWidth: "300px", padding: "0px" }}
					>
						<div className="max-w-xs -pt-4">
							<p className="m-0 text-sm text-gray-600">
								{location.description}
							</p>
						</div>
					</InfoWindow>
				)}
			</Map>
		</div>
	);
};

interface AdvancedMarkerWithRefProps {
	onMarkerClick: (marker: google.maps.marker.AdvancedMarkerElement) => void;
	position: { lat: number; lng: number };
	className?: string;
	children: React.ReactNode;
}

const AdvancedMarkerWithRef: React.FC<AdvancedMarkerWithRefProps> = ({
	children,
	onMarkerClick,
	...advancedMarkerProps
}) => {
	const [markerRef, marker] = useAdvancedMarkerRef();

	return (
		<AdvancedMarker
			onClick={() => {
				if (marker) {
					onMarkerClick(marker);
				}
			}}
			ref={markerRef}
			{...advancedMarkerProps}
		>
			{children}
		</AdvancedMarker>
	);
};
