<!-- Source: https://docs.worthai.com/api-reference/integration/verification/get-npi-details.md -->
# Get NPI Details

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get NPI Details

> Fetch NPI healthcare provider details associated with a business



## OpenAPI

````yaml get /verification/businesses/{businessID}/healthcare
openapi: 3.1.0
info:
  title: Integration Service
  description: >-
    This service is responsible for all integrations and contains all
    integration information about the business.
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/integration/api/v1
    variables: {}
  - url: http://localhost:3005/api/v1/accounting/taxStatus
    variables: {}
  - url: http://example.com
    variables: {}
  - url: http://localhost:3000/api/v1
    variables: {}
security: []
tags:
  - name: Banking
  - name: Financials
  - name: Accounting
  - name: Public Records
  - name: manual-filing
  - name: Taxation
  - name: OpenCorporates
  - name: ZoomInfo
  - name: Verification
  - name: Verification
  - name: FAQ Chatbot
  - name: Applicants
  - name: Extract Document Details
  - name: Charts / Stats
  - name: Credit Bureau (Equifax)
  - name: Insights
    description: >-
      AI Insights Assistant that can help generate an insights report.
      Additionally users can converse with a chatbot about their report.
  - name: Risk Alerts
  - name: Queue Management
  - name: Data Scrape
  - name: White Label
  - name: File Executions
  - name: Files
  - name: OCR
  - name: Customer Integration Settings
  - name: Facts
    description: >-
      Facts provide a common interface to pick the most authoritative values for
      attribues that may be sourced from different sources.


      E.g.: Which address do we surface as the primary address for a business?
      Determine that by collecting all addresses we have and returning the
      address with the highest degree of confidence.
  - name: Adverse Media
  - name: Misc
    description: ''
paths:
  /verification/businesses/{businessID}/healthcare:
    parameters: []
    get:
      tags:
        - Verification
      summary: Get NPI Details
      description: Fetch NPI healthcare provider details associated with a business
      operationId: GetNPIDetailsforBusiness
      parameters:
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - e309149e-2bbc-4b4e-9272-c77f7fffb19c
      responses:
        '200':
          description: OK
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Mon, 25 Nov 2024 15:25:59 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '433'
            Connection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: keep-alive
            Content-Security-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: >-
                    default-src 'self';base-uri 'self';font-src 'self' https:
                    data:;form-action 'self';frame-ancestors 'self';img-src
                    'self' data:;object-src 'none';script-src
                    'self';script-src-attr 'none';style-src 'self' https:
                    'unsafe-inline';upgrade-insecure-requests
            Cross-Origin-Opener-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Cross-Origin-Resource-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: same-origin
            Origin-Agent-Cluster:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '?1'
            Referrer-Policy:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: no-referrer
            Strict-Transport-Security:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: max-age=15552000; includeSubDomains
            X-Content-Type-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: nosniff
            X-DNS-Prefetch-Control:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'off'
            X-Download-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: noopen
            X-Frame-Options:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: SAMEORIGIN
            X-Permitted-Cross-Domain-Policies:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: none
            X-XSS-Protection:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '0'
            Vary:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Origin
            Access-Control-Allow-Credentials:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: 'true'
            ETag:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: W/"1b1-Gag+lJAWQKTZoHshu9baO7/Vh1A"
            Keep-Alive:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: timeout=5
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/NPIProviderSuccess'
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Successful
                data:
                  submitted_npi: '123456789'
                  business_integration_task_id: e1328cf9-d045-4e5c-ad17-2e0b10965590
                  business_id: 4aa4f340-ff9f-440c-b03c-e7adc77cd7e9
                  employer_identification_number: ''
                  is_sole_proprietor: true
                  provider_first_name: JOHN
                  provider_last_name: SMITH
                  provider_middle_name: ''
                  provider_gender_code: M
                  provider_credential_text: M.D.
                  provider_organization_name: ''
                  metadata:
                    npi: 123456789
                    replacement npi: ''
                    entity type code: 1
                    last update date: 12/05/2017
                    certification date: ''
                    is sole proprietor: 'Y'
                    provider first name: JOHN
                    provider gender code: M
                    provider middle name: ''
                    npi deactivation date: ''
                    npi reactivation date: ''
                    is organization subpart: ''
                    parent organization lbn: ''
                    parent organization tin: ''
                    provider credential text: M.D.
                    provider other last name: ''
                    provider enumeration date: 12/05/2007
                    provider license number_1: A95211
                    provider license number_2: ''
                    provider license number_3: ''
                    provider license number_4: ''
                    provider license number_5: ''
                    provider license number_6: ''
                    provider license number_7: ''
                    provider license number_8: ''
                    provider license number_9: ''
                    provider name prefix text: DR.
                    provider name suffix text: ''
                    provider other first name: ''
                    provider license number_10: ''
                    provider license number_11: ''
                    provider license number_12: ''
                    provider license number_13: ''
                    provider license number_14: ''
                    provider license number_15: ''
                    provider other middle name: ''
                    other provider identifier_1: ''
                    other provider identifier_2: ''
                    other provider identifier_3: ''
                    other provider identifier_4: ''
                    other provider identifier_5: ''
                    other provider identifier_6: ''
                    other provider identifier_7: ''
                    other provider identifier_8: ''
                    other provider identifier_9: ''
                    npi deactivation reason code: ''
                    other provider identifier_10: ''
                    other provider identifier_11: ''
                    other provider identifier_12: ''
                    other provider identifier_13: ''
                    other provider identifier_14: ''
                    other provider identifier_15: ''
                    other provider identifier_16: ''
                    other provider identifier_17: ''
                    other provider identifier_18: ''
                    other provider identifier_21: ''
                    other provider identifier_22: ''
                    other provider identifier_23: ''
                    other provider identifier_24: ''
                    other provider identifier_25: ''
                    other provider identifier_26: ''
                    other provider identifier_27: ''
                    other provider identifier_28: ''
                    other provider identifier_29: ''
                    other provider identifier_30: ''
                    other provider identifier_31: ''
                    other provider identifier_32: ''
                    other provider identifier_33: ''
                    other provider identifier_34: ''
                    other provider identifier_35: ''
                    other provider identifier_36: ''
                    other provider identifier_37: ''
                    other provider identifier_38: ''
                    other provider identifier_39: ''
                    other provider identifier_40: ''
                    other provider identifier_41: ''
                    other provider identifier_42: ''
                    other provider identifier_43: ''
                    other provider identifier_44: ''
                    other provider identifier_45: ''
                    other provider identifier_46: ''
                    other provider identifier_47: ''
                    other provider identifier_48: ''
                    other provider identifier_49: ''
                    other provider identifier_50: ''
                    authorized official last name: ''
                    authorized official first name: ''
                    provider other credential text: ''
                    authorized official middle name: ''
                    provider last name (legal name): SMITH
                    provider other name prefix text: ''
                    provider other name suffix text: ''
                    provider other organization name: ''
                    other provider identifier state_1: ''
                    other provider identifier state_2: ''
                    other provider identifier state_3: ''
                    other provider identifier state_4: ''
                    other provider identifier state_5: ''
                    other provider identifier state_6: ''
                    other provider identifier state_7: ''
                    other provider identifier state_8: ''
                    other provider identifier state_9: ''
                    other provider identifier issuer_1: ''
                    other provider identifier issuer_2: ''
                    other provider identifier issuer_3: ''
                    other provider identifier issuer_4: ''
                    other provider identifier issuer_5: ''
                    other provider identifier issuer_6: ''
                    other provider identifier issuer_7: ''
                    other provider identifier issuer_8: ''
                    other provider identifier issuer_9: ''
                    other provider identifier state_10: ''
                    other provider identifier state_11: ''
                    other provider identifier state_12: ''
                    other provider identifier state_13: ''
                    other provider identifier state_14: ''
                    other provider identifier state_15: ''
                    other provider identifier state_16: ''
                    other provider identifier state_17: ''
                    other provider identifier state_18: ''
                    other provider identifier state_19: ''
                    other provider identifier state_20: ''
                    other provider identifier state_21: ''
                    other provider identifier state_22: ''
                    other provider identifier state_23: ''
                    other provider identifier state_24: ''
                    other provider identifier state_25: ''
                    other provider identifier state_26: ''
                    other provider identifier state_27: ''
                    other provider identifier state_28: ''
                    other provider identifier state_29: ''
                    other provider identifier state_30: ''
                    other provider identifier state_31: ''
                    other provider identifier state_32: ''
                    other provider identifier state_33: ''
                    other provider identifier state_34: ''
                    other provider identifier state_35: ''
                    other provider identifier state_36: ''
                    other provider identifier state_37: ''
                    other provider identifier state_38: ''
                    other provider identifier state_39: ''
                    other provider identifier state_40: ''
                    other provider identifier state_41: ''
                    other provider identifier state_42: ''
                    other provider identifier state_43: ''
                    other provider identifier state_44: ''
                    other provider identifier state_45: ''
                    other provider identifier state_46: ''
                    other provider identifier state_47: ''
                    other provider identifier state_48: ''
                    other provider identifier state_49: ''
                    other provider identifier state_50: ''
                    authorized official credential text: ''
                    healthcare provider taxonomy code_1: 174400000X
                    healthcare provider taxonomy code_2: ''
                    healthcare provider taxonomy code_3: ''
                    healthcare provider taxonomy code_4: ''
                    healthcare provider taxonomy code_5: ''
                    healthcare provider taxonomy code_6: ''
                    healthcare provider taxonomy code_7: ''
                    healthcare provider taxonomy code_8: ''
                    healthcare provider taxonomy code_9: ''
                    other provider identifier issuer_10: ''
                    other provider identifier issuer_11: ''
                    other provider identifier issuer_12: ''
                    other provider identifier issuer_13: ''
                    other provider identifier issuer_14: ''
                    other provider identifier issuer_15: ''
                    other provider identifier issuer_16: ''
                    other provider identifier issuer_17: ''
                    other provider identifier issuer_18: ''
                    other provider identifier issuer_19: ''
                    other provider identifier issuer_20: ''
                    other provider identifier issuer_21: ''
                    other provider identifier issuer_22: ''
                    other provider identifier issuer_23: ''
                    other provider identifier issuer_24: ''
                    other provider identifier issuer_25: ''
                    other provider identifier issuer_26: ''
                    other provider identifier issuer_27: ''
                    other provider identifier issuer_28: ''
                    other provider identifier issuer_29: ''
                    other provider identifier issuer_30: ''
                    other provider identifier issuer_31: ''
                    other provider identifier issuer_32: ''
                    other provider identifier issuer_33: ''
                    other provider identifier issuer_34: ''
                    other provider identifier issuer_35: ''
                    other provider identifier issuer_36: ''
                    other provider identifier issuer_37: ''
                    other provider identifier issuer_38: ''
                    other provider identifier issuer_39: ''
                    other provider identifier issuer_40: ''
                    other provider identifier issuer_41: ''
                    other provider identifier issuer_42: ''
                    other provider identifier issuer_43: ''
                    other provider identifier issuer_44: ''
                    other provider identifier issuer_45: ''
                    other provider identifier issuer_46: ''
                    other provider identifier issuer_47: ''
                    other provider identifier issuer_48: ''
                    other provider identifier issuer_49: ''
                    other provider identifier issuer_50: ''
                    authorized official name prefix text: ''
                    authorized official name suffix text: ''
                    employer identification number (ein): ''
                    healthcare provider taxonomy code_10: ''
                    healthcare provider taxonomy code_11: ''
                    healthcare provider taxonomy code_12: ''
                    healthcare provider taxonomy code_13: ''
                    healthcare provider taxonomy code_14: ''
                    healthcare provider taxonomy code_15: ''
                    healthcare provider taxonomy group_1: ''
                    healthcare provider taxonomy group_2: ''
                    healthcare provider taxonomy group_3: ''
                    healthcare provider taxonomy group_4: ''
                    healthcare provider taxonomy group_5: ''
                    healthcare provider taxonomy group_6: ''
                    healthcare provider taxonomy group_7: ''
                    healthcare provider taxonomy group_8: ''
                    healthcare provider taxonomy group_9: ''
                    provider license number state code_1: CA
                    provider license number state code_2: ''
                    provider license number state code_3: ''
                    provider license number state code_4: ''
                    provider license number state code_5: ''
                    provider license number state code_6: ''
                    provider license number state code_7: ''
                    provider license number state code_8: ''
                    provider license number state code_9: ''
                    authorized official title or position: ''
                    healthcare provider taxonomy group_10: ''
                    healthcare provider taxonomy group_11: ''
                    healthcare provider taxonomy group_12: ''
                    healthcare provider taxonomy group_13: ''
                    healthcare provider taxonomy group_14: ''
                    healthcare provider taxonomy group_15: ''
                    provider license number state code_10: ''
                    provider license number state code_11: ''
                    provider license number state code_12: ''
                    provider license number state code_13: ''
                    provider license number state code_14: ''
                    provider license number state code_15: ''
                    other provider identifier type code_21: ''
                    other provider identifier type code_22: ''
                    other provider identifier type code_23: ''
                    other provider identifier type code_24: ''
                    other provider identifier type code_25: ''
                    other provider identifier type code_26: ''
                    other provider identifier type code_27: ''
                    other provider identifier type code_28: ''
                    other provider identifier type code_29: ''
                    other provider identifier type code_30: ''
                    other provider identifier type code_31: ''
                    other provider identifier type code_32: ''
                    other provider identifier type code_33: ''
                    other provider identifier type code_34: ''
                    other provider identifier type code_35: ''
                    other provider identifier type code_36: ''
                    other provider identifier type code_37: ''
                    other provider identifier type code_38: ''
                    other provider identifier type code_39: ''
                    other provider identifier type code_40: ''
                    other provider identifier type code_41: ''
                    other provider identifier type code_42: ''
                    other provider identifier type code_43: ''
                    other provider identifier type code_44: ''
                    other provider identifier type code_45: ''
                    other provider identifier type code_46: ''
                    other provider identifier type code_47: ''
                    other provider identifier type code_48: ''
                    other provider identifier type code_49: ''
                    other provider identifier type code_50: ''
                    provider business mailing address city name: LOS ANGELES
                    provider business mailing address fax number: 3105555555
                    provider business mailing address state name: CA
                    provider first line business mailing address: 9201 W SUNSET BLVD STE 202207
                    healthcare provider primary taxonomy switch_1: 'Y'
                    healthcare provider primary taxonomy switch_2: ''
                    healthcare provider primary taxonomy switch_3: ''
                    healthcare provider primary taxonomy switch_4: ''
                    healthcare provider primary taxonomy switch_5: ''
                    healthcare provider primary taxonomy switch_6: ''
                    healthcare provider primary taxonomy switch_7: ''
                    healthcare provider primary taxonomy switch_8: ''
                    healthcare provider primary taxonomy switch_9: ''
                    provider business mailing address postal code: 900693701
                    provider second line business mailing address: ''
                    healthcare provider primary taxonomy switch_10: ''
                    healthcare provider primary taxonomy switch_11: ''
                    healthcare provider primary taxonomy switch_12: ''
                    healthcare provider primary taxonomy switch_13: ''
                    healthcare provider primary taxonomy switch_14: ''
                    healthcare provider primary taxonomy switch_15: ''
                    provider organization name (legal business name): ''
                    provider business mailing address telephone number: 3105555555
                    provider business practice location address city name: LOS ANGELES
                    provider business practice location address fax number: 3102769154
                    provider business practice location address state name: CA
                    provider first line business practice location address: 9224 W HOLLYWOOD AVE STE 237607
                    provider business practice location address postal code: 900693701
                    provider second line business practice location address: ''
                    provider business practice location address telephone number: 3105555555
                    provider business mailing address country code (if outside u.s.): US
                    provider business practice location address country code (if outside u.s.): US
                  created_at: '2025-09-23T13:19:16.554Z'
                  updated_at: '2007-12-05T00:00:00.000Z'
                  is_matched: true
      deprecated: false
      security:
        - bearer: []
      servers:
        - url: https://api.joinworth.com/integration/api/v1
          variables: {}
components:
  schemas:
    NPIProviderSuccess:
      title: NPIProviderSuccess
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/NPIProviderData'
      examples:
        - status: success
          message: Successful
          data:
            submitted_npi: '1275716805'
            business_integration_task_id: e1328cf9-d045-4e5c-ad17-2e0b10965590
            business_id: 4aa4f340-ff9f-440c-b03c-e7adc77cd7e9
            employer_identification_number: ''
            is_sole_proprietor: true
            provider_first_name: BABAK
            provider_last_name: DADVAND
            provider_middle_name: ''
            provider_gender_code: M
            provider_credential_text: M.D.
            provider_organization_name: ''
            metadata:
              npi: 1275716805
              entity type code: 1
              last update date: 12/05/2007
              is sole proprietor: 'Y'
              provider first name: BABAK
              provider gender code: M
              provider enumeration date: 12/05/2007
              provider license number_1: A95211
              provider name prefix text: DR.
              provider credential text: M.D.
              healthcare provider taxonomy code_1: 174400000X
              provider license number state code_1: CA
              provider business mailing address city name: LOS ANGELES
              provider business mailing address state name: CA
              provider first line business mailing address: 9201 W SUNSET BLVD STE 202207
              provider business mailing address postal code: 900693701
              provider business mailing address telephone number: 3102763183
              provider business mailing address fax number: 3102769154
              provider business practice location address city name: LOS ANGELES
              provider business practice location address state name: CA
              provider first line business practice location address: 9201 W SUNSET BLVD STE 202207
              provider business practice location address postal code: 900693701
              provider business practice location address telephone number: 3102763183
              provider business practice location address fax number: 3102769154
            created_at: '2025-09-23T13:19:16.554Z'
            updated_at: '2007-12-05T00:00:00.000Z'
            is_matched: true
    NPIProviderData:
      title: NPIProviderData
      type: object
      properties:
        submitted_npi:
          type: string
          description: The NPI number that was submitted for lookup
        business_integration_task_id:
          type: string
          format: uuid
          description: Unique identifier for the business integration task
        business_id:
          type: string
          format: uuid
          description: Unique identifier for the business
        employer_identification_number:
          type: string
          description: Employer Identification Number (EIN)
        is_sole_proprietor:
          type: boolean
          description: Indicates if the provider is a sole proprietor
        provider_first_name:
          type: string
          description: Provider's first name
        provider_last_name:
          type: string
          description: Provider's last name
        provider_middle_name:
          type: string
          description: Provider's middle name
        provider_gender_code:
          type: string
          enum:
            - M
            - F
          description: Provider's gender code (M/F)
        provider_credential_text:
          type: string
          description: Provider's professional credentials
        provider_organization_name:
          type: string
          description: Provider's organization name
        metadata:
          type: object
          description: Comprehensive metadata from NPI registry
          additionalProperties: true
        created_at:
          type: string
          format: date-time
          description: Timestamp when the record was created
        updated_at:
          type: string
          format: date-time
          description: Timestamp when the record was last updated
        is_matched:
          type: boolean
          description: Indicates if the provider was successfully matched
      required:
        - submitted_npi
        - business_integration_task_id
        - business_id
        - is_sole_proprietor
        - provider_first_name
        - provider_last_name
        - provider_gender_code
        - provider_credential_text
        - metadata
        - created_at
        - updated_at
        - is_matched
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````