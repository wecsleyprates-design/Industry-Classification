export interface GeocodingResponse {
	results: GeocodingResult[];
	status: string;
	error_message?: string;
}

export interface GeocodingResult {
	address_components: AddressComponent[];
	formatted_address: string;
	geometry: Geometry;
	place_id: string;
	types: string[];
}

export interface AddressComponent {
	long_name: string;
	short_name: string;
	types: string[];
}

export interface Geometry {
	location: LatLng;
	location_type: string;
	viewport: Viewport;
	bounds?: Viewport;
}

export interface LatLng {
	lat: number;
	lng: number;
}

export interface Viewport {
	northeast: LatLng;
	southwest: LatLng;
}
