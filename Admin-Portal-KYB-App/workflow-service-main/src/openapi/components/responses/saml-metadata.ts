import type { OpenAPIV3 } from "openapi-types";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const SamlMetadataXmlResponse: OpenAPIV3.ResponseObject = {
	description: "SAML SP Metadata XML response",
	content: {
		"application/xml": {
			schema: {
				type: "object",
				xml: {
					name: "EntityDescriptor",
					namespace: "urn:oasis:names:tc:SAML:2.0:metadata"
				},
				properties: {
					entityID: {
						type: "string",
						xml: {
							attribute: true
						},
						example: "https://auth.example.com/saml/sp"
					},
					cacheDuration: {
						type: "string",
						xml: {
							attribute: true
						},
						example: "P7D"
					},
					SPSSODescriptor: {
						type: "object",
						xml: {
							name: "SPSSODescriptor"
						},
						properties: {
							AuthnRequestsSigned: {
								type: "boolean",
								xml: {
									attribute: true
								},
								example: false
							},
							WantAssertionsSigned: {
								type: "boolean",
								xml: {
									attribute: true
								},
								example: true
							},
							protocolSupportEnumeration: {
								type: "string",
								xml: {
									attribute: true
								},
								example: "urn:oasis:names:tc:SAML:2.0:protocol"
							},
							KeyDescriptor: {
								type: "array",
								xml: {
									name: "KeyDescriptor"
								},
								items: {
									type: "object",
									xml: {
										name: "KeyDescriptor"
									},
									properties: {
										use: {
											type: "string",
											xml: {
												attribute: true
											},
											enum: ["signing", "encryption"]
										},
										KeyInfo: {
											type: "object",
											xml: {
												name: "KeyInfo",
												namespace: "http://www.w3.org/2000/09/xmldsig#"
											},
											properties: {
												X509Data: {
													type: "object",
													xml: {
														name: "X509Data"
													},
													properties: {
														X509Certificate: {
															type: "string",
															xml: {
																name: "X509Certificate"
															},
															example: `MIIC4jCCAcqgAwIBAgIBADANBgkqhkiG9w0BAQsFADCBhDELMAkGA1UEBhMCVVMx
                                        EzARBgNVBAgMCkNhbGlmb3JuaWExEDAOBgNVBAcMB1NhbiBKb3NlMRUwEwYDVQQK
                                        DAxKb2luV29ydGggSW5jMRgwFgYDVQQLDA9FbmdpbmVlcmluZyBUZWFtMRswGQYD
                                        VQQDDBJhdXRoLmRldi5qb2lud29ydGgwHhcNMjQwMzE5MDAwMDAwWhcNMzQwMzE2
                                        MDAwMDAwWjCBhDELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEDAO
                                        BgNVBAcMB1NhbiBKb3NlMRUwEwYDVQQKDAxKb2luV29ydGggSW5jMRgwFgYDVQQL
                                        DA9FbmdpbmVlcmluZyBUZWFtMRswGQYDVQQDDBJhdXRoLmRldi5qb2lud29ydGgw
                                        ggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC6...TRUNCATED...`
														}
													}
												}
											}
										}
									}
								}
							},
							NameIDFormat: {
								type: "array",
								xml: {
									name: "NameIDFormat"
								},
								items: {
									type: "string",
									xml: {
										name: "NameIDFormat"
									}
								},
								example: [
									"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
									"urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"
								]
							},
							AssertionConsumerService: {
								type: "object",
								xml: {
									name: "AssertionConsumerService"
								},
								properties: {
									Binding: {
										type: "string",
										xml: {
											attribute: true
										},
										example: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
									},
									Location: {
										type: "string",
										xml: {
											attribute: true
										},
										example: "https://auth.example.com/saml/acs"
									},
									index: {
										type: "integer",
										xml: {
											attribute: true
										},
										example: 0
									},
									isDefault: {
										type: "boolean",
										xml: {
											attribute: true
										},
										example: true
									}
								}
							},
							SingleLogoutService: {
								type: "array",
								xml: {
									name: "SingleLogoutService"
								},
								items: {
									type: "object",
									xml: {
										name: "SingleLogoutService"
									},
									properties: {
										Binding: {
											type: "string",
											xml: {
												attribute: true
											},
											example: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
										},
										Location: {
											type: "string",
											xml: {
												attribute: true
											},
											example: "https://auth.example.com/saml/logout"
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
};
