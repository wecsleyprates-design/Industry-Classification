import { parse } from "@universe/address-parser";
import clsx, { type ClassValue } from "clsx";
import crypto from "crypto";
import { twMerge } from "tailwind-merge";
import { concatenate } from "../helper";
import { parseCityFromPlaceResult } from "./parseCityFromPlaceResult";

import { envConfig } from "@/config/envConfig";

const PUBLIC_KEY = envConfig.VITE_DECRYPTION_PUBLIC_KEY ?? "";

export interface Permission {
	id: number;
	code: string;
	label: string;
}

export type Permissions = Permission[];

// Shape of the encrypted payload coming from backend
export interface EncryptedPermissionsPayload {
	encrypted_aes_key: string; // base64-encoded RSA-encrypted AES key
	encrypted_permissions: string; // base64-encoded AES-encrypted permissions JSON
	iv: string; // base64-encoded initialization vector
	algo: "aes-256-cbc"; // only AES-256-CBC supported for now
	padding: "RSA_PKCS1_PADDING"; // padding mode used
}

export function decryptPermissionsHybrid({
	encrypted_aes_key: encryptedAesKey,
	encrypted_permissions: encryptedPermissions,
	iv,
	algo,
	padding,
}: EncryptedPermissionsPayload): Permissions {
	const aesKey = crypto.publicDecrypt(
		{
			key: PUBLIC_KEY,
			padding: crypto.constants[padding],
		},
		Buffer.from(encryptedAesKey, "base64"),
	);

	const decipher = crypto.createDecipheriv(
		algo,
		aesKey,
		Buffer.from(iv, "base64"),
	);

	let decrypted = decipher.update(encryptedPermissions, "base64", "utf8");
	decrypted += decipher.final("utf8");

	// Ensure parsed value matches Permissions type
	return JSON.parse(decrypted) as Permissions;
}

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const parseAddressComponentsFromPlaceResult = (
	places: google.maps.places.PlaceResult | undefined,
) => {
	let street = "";
	let zip = "";
	let suite = "";
	let city = "";
	let state = "";
	let country = "";
	let website = "";
	let placeId = "";
	let address = "";

	if (places) {
		const addressComponents = places.address_components;
		website = places.website ?? "";
		placeId = places.place_id ?? "";
		address = places.formatted_address ?? "";
		if (!places?.formatted_address) {
			return {
				street,
				zip,
				suite,
				city,
				state,
				country,
				website,
				placeId,
				address,
			};
		}

		/** Parse city separately due to added complexity of handling different city and city-adjacent types. */
		city = parseCityFromPlaceResult(places) ?? "";

		addressComponents?.forEach((component: any) => {
			const longName = String(component?.long_name ?? "");
			const { types } = component;
			if (types.includes("street_number")) {
				street = `${longName} `;
				return;
			}
			if (types.includes("premise") || types.includes("intersection")) {
				street = `${street}${longName} `;
				return;
			}
			if (types.includes("route")) {
				street = `${street}${longName} `;
				return;
			}
			if (types.includes("sublocality_level_2")) {
				street = `${street}${longName} `;
				return;
			}
			if (types.includes("sublocality_level_1")) {
				street = `${street}${longName} `;
				return;
			}
			if (types.includes("subpremise") || types.includes("post_box")) {
				suite = longName;
				return;
			}
			if (types.includes("administrative_area_level_1")) {
				state = longName;
				return;
			}
			if (types.includes("country")) {
				country = longName;
				return;
			}
			if (types.includes("postal_code")) {
				zip = longName;
			}
		});

		if (street === "") {
			const parsedAddress = parse(places.formatted_address ?? "");
			const {
				number,
				streetName,
				streetPostDir,
				streetPreDir,
				streetType,
			}: {
				number: string | null;
				streetName: string | null;
				streetPostDir: string | null;
				streetPreDir: string | null;
				streetType: string | null;
			} = parsedAddress;
			street = concatenate([
				number ?? "",
				streetPreDir ?? "",
				streetName ?? "",
				streetType ?? "",
				streetPostDir ?? "",
			]);
		}
	}

	return {
		street,
		zip,
		suite,
		city,
		state,
		country,
		website,
		placeId,
		address,
	};
};

export const parseAddressComponents = (address: string) => {
	const parsedAddress = parse(address ?? "");

	const {
		number,
		streetName,
		streetPostDir,
		streetPreDir,
		streetType,
		zip,
		unitAbbr,
		unitNum,
		city,
		state,
		country,
	} = parsedAddress;

	const street = concatenate([
		number ?? "",
		streetPreDir ?? "",
		streetName ?? "",
		streetType ?? "",
		streetPostDir ?? "",
	]);

	const suite = concatenate([unitAbbr ?? "", unitNum ?? ""]);

	return {
		street,
		zip: zip ?? "",
		suite,
		city: city ?? "",
		state: state ?? "",
		country: country ?? "",
	};
};

export interface ICAObject {
	ica: string;
	isDefault: boolean;
}

export const parseICAs = (
	input: string | string[] | undefined | null,
): ICAObject[] => {
	if (!input) {
		return [];
	}

	let icasArray: string[] = [];

	if (Array.isArray(input)) {
		icasArray = input;
	} else if (typeof input === "string") {
		icasArray = input.split(",");
	}

	return icasArray
		.map((ica) => ica.trim())
		.filter((ica) => ica.length > 0)
		.map((ica, index) => ({
			ica,
			isDefault: index === 0,
		}));
};
