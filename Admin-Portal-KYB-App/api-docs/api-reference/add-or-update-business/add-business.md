<!-- Source: https://docs.worthai.com/api-reference/add-or-update-business/add-business.md -->
# Add Business

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Add Business

> Create a single business record based on the provided details.

For more details on using this endpoint, please reference the [Getting Started](https://docs.worthai.com/getting-started/overview) guide.



## OpenAPI

````yaml post /businesses/customers/{customerID}
openapi: 3.1.0
info:
  title: Add Business
  description: This collection is for the Add Business of businesses.
  contact: {}
  version: '1.0'
servers:
  - url: https://api.joinworth.com/case/api/v1
    variables: {}
security: []
tags:
  - name: Add Business
paths:
  /businesses/customers/{customerID}:
    parameters: []
    post:
      tags:
        - Add Business
      summary: Add Business
      description: >-
        Create a single business record based on the provided details.


        For more details on using this endpoint, please reference the [Getting
        Started](https://docs.worthai.com/getting-started/overview) guide.
      operationId: AddBusiness
      parameters:
        - name: customerID
          in: path
          description: Unique identifier for the customer.
          required: true
          style: simple
          schema:
            type: string
            format: uuid
            examples:
              - 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
        - name: async
          in: query
          description: >-
            When true, the request is processed asynchronously and immediately
            returns a business ID without waiting for enrichment to complete.
          required: false
          schema:
            type: boolean
            default: false
      requestBody:
        description: ''
        content:
          application/json:
            schema:
              allOf:
                - $ref: '#/components/schemas/ImportBusinessRequest'
                - examples: []
              contentMediaType: application/json
            example:
              external_id: '77388994455034'
              name: Test Business
              tin: '333444685'
              address_line_1: 1234 Testing Blvd.
              address_city: Longwood
              address_state: FL
              address_postal_code: '32850'
        required: true
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
                  example: Tue, 26 Nov 2024 09:32:39 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '6426'
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
                  example: W/"191a-0Am+j4ht+QAJ79KNLWzQXPZxvAk"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success2'
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Bulk process succeeded
                data:
                  runId: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                  result:
                    '0':
                      warnings: []
                      userID: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                      customerID: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                      riskMonitoring: true
                      data_businesses:
                        id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                        name: Test Business
                        tin: XXXXX6789
                        address_apartment: null
                        address_line_1: 1234 Testing Blvd.
                        address_line_2: null
                        address_city: Longwood
                        address_state: FL
                        address_postal_code: '32850'
                        address_country: US
                        created_at: '2026-01-05T15:20:35.719Z'
                        created_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                        updated_at: '2026-01-05T15:20:39.814Z'
                        updated_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                        mobile: '+11231231234'
                        official_website: https://www.somebusiness.com
                        public_website: https://www.somebusiness.com
                        social_account: https://www.linkedin.com/in/someguy
                        status: VERIFIED
                        industry:
                          id: 16
                          name: Health Care and Social Assistance
                          code: health_care_and_social_assistance
                          sector_code: '62'
                          created_at: '2026-01-05T15:20:35.719Z'
                          updated_at: '2026-01-05T15:20:39.814Z'
                        mcc_id: 13
                        naics_id: 13
                        naics_code: 621210
                        naics_title: Offices of Dentists
                        mcc_code: 8021
                        mcc_title: Dentists/Dental Services
                        is_monitoring_enabled: false
                        deleted_by: null
                        deleted_at: null
                        subscription:
                          status: null
                          created_at: null
                          updated_at: null
                        business_names:
                          - name: Test Business
                            is_primary: false
                          - name: Test Business
                            is_primary: true
                        business_addresses:
                          - line_1: 1234 Testing Blvd.
                            apartment: null
                            city: Longwood
                            state: FL
                            country: USA
                            postal_code: '32850'
                            mobile: '+11231231234'
                            is_primary: true
                      data_cases:
                        - id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          applicant_id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          customer_id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          status: 3
                          created_at: '2026-01-05T15:20:38.620Z'
                          created_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          updated_at: '2026-01-05T15:20:38.620Z'
                          updated_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          business_id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          case_type: 1
                          assignee: null
                          assigner: null
                          customer_initiated: false
                      integration_data:
                        dba1_name: null
                        dba2_name: null
                        dba3_name: null
                        dba4_name: null
                        dba5_name: null
                        address1_line_1: null
                        address2_line_1: null
                        address3_line_1: null
                        address4_line_1: null
                        address5_line_1: null
                        address1_apartment: null
                        address2_apartment: null
                        address3_apartment: null
                        address4_apartment: null
                        address5_apartment: null
                        address1_city: null
                        address2_city: null
                        address3_city: null
                        address4_city: null
                        address5_city: null
                        state: FL
                        address1_country: null
                        address2_country: null
                        address3_country: null
                        address4_country: null
                        address5_country: null
                        address1_postal_code: null
                        address2_postal_code: null
                        address3_postal_code: null
                        address4_postal_code: null
                        address5_postal_code: null
                        address1_mobile: null
                        address2_mobile: null
                        address3_mobile: null
                        address4_mobile: null
                        address5_mobile: null
                        id: null
                        name: Test Business
                        tin: XXXXX6789
                        address_line_1: 1234 Testing Blvd.
                        address_line_2: null
                        address_city: Longwood
                        address_country: null
                        address_postal_code: '32850'
                        mobile: '+11231231234'
                        official_website: null
                        naics_code: null
                        naics_title: null
                        mcc_code: null
                        industry: null
                        quick_add: null
                        external_id: '77388994455034'
                        metadata: null
                        owner1_title: null
                        owner2_title: null
                        owner3_title: null
                        owner4_title: null
                        owner5_title: null
                        owner1_external_id: null
                        owner2_external_id: null
                        owner3_external_id: null
                        owner4_external_id: null
                        owner5_external_id: null
                        owner1_first_name: null
                        owner2_first_name: null
                        owner3_first_name: null
                        owner4_first_name: null
                        owner5_first_name: null
                        owner1_last_name: null
                        owner2_last_name: null
                        owner3_last_name: null
                        owner4_last_name: null
                        owner5_last_name: null
                        owner1_email: null
                        owner2_email: null
                        owner3_email: null
                        owner4_email: null
                        owner5_email: null
                        owner1_mobile: null
                        owner2_mobile: null
                        owner3_mobile: null
                        owner4_mobile: null
                        owner5_mobile: null
                        owner1_ssn: null
                        owner2_ssn: null
                        owner3_ssn: null
                        owner4_ssn: null
                        owner5_ssn: null
                        owner1_dob: null
                        owner2_dob: null
                        owner3_dob: null
                        owner4_dob: null
                        owner5_dob: null
                        owner1_address_line_1: null
                        owner2_address_line_1: null
                        owner3_address_line_1: null
                        owner4_address_line_1: null
                        owner5_address_line_1: null
                        owner1_address_line_2: null
                        owner2_address_line_2: null
                        owner3_address_line_2: null
                        owner4_address_line_2: null
                        owner5_address_line_2: null
                        owner1_address_city: null
                        owner2_address_city: null
                        owner3_address_city: null
                        owner4_address_city: null
                        owner5_address_city: null
                        owner1_address_state: null
                        owner2_address_state: null
                        owner3_address_state: null
                        owner4_address_state: null
                        owner5_address_state: null
                        owner1_address_postal: null
                        owner2_address_postal: null
                        owner3_address_postal: null
                        owner4_address_postal: null
                        owner5_address_postal: null
                        owner1_address_country: null
                        owner2_address_country: null
                        owner3_address_country: null
                        owner4_address_country: null
                        owner5_address_country: null
                        owner1_owner_type: null
                        owner2_owner_type: null
                        owner3_owner_type: null
                        owner4_owner_type: null
                        owner5_owner_type: null
                        owner1_ownership_percentage: null
                        owner2_ownership_percentage: null
                        owner3_ownership_percentage: null
                        owner4_ownership_percentage: null
                        owner5_ownership_percentage: null
                        send_invitation: null
                        applicant_first_name: null
                        applicant_last_name: null
                        applicant_email: null
                        year: null
                        is_revenue: 1022233
                        is_operatingexpenses: null
                        is_netincome: null
                        is_cost_of_goods_sold: null
                        bs_totalliabilities: null
                        bs_totalassets: null
                        bs_totalequity: null
                        bs_accountspayable: null
                        bs_accountsreceivable: null
                        bs_cashandcashequivalents: null
                        bs_shortterminvestments: null
                        bs_totalcurrentassets: null
                        bs_totalcurrentliabilities: null
                        bs_totalnoncurrentliabilities: null
                        is_costofgoodsold: null
                        is_grossprofit: null
                        is_incometaxexpense: null
                        is_interestexpense: null
                        number_of_employees: null
                        business_type: null
                        sic_code: null
                        date_of_observation: null
                        lien_count: null
                        business_liens_file_date: null
                        business_liens_status: null
                        business_liens_status_date: null
                        bankruptcy_count: null
                        business_bankruptcies_file_date: null
                        business_bankruptcies_chapter: null
                        business_bankruptcies_voluntary: null
                        business_bankruptcies_status: null
                        business_bankruptcies_status_date: null
                        judgement_count: null
                        business_judgements_file_date: null
                        business_judgements_status: null
                        business_judgements_status_date: null
                        business_judgements_amount: null
                        review_cnt: null
                        review_score: null
                        bank_account_number: null
                        bank_name: null
                        institution_name: null
                        bank_routing_number: null
                        bank_wire_routing_number: null
                        bank_official_name: null
                        bank_account_type: null
                        bank_account_subtype: null
                        bank_account_balance_current: null
                        bank_account_balance_available: null
                        bank_account_balance_limit: null
                        deposit_account: null
                        npi_provider_number: null
                      business_customer:
                        business_id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                        customer_id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                        created_at: '2026-01-05T15:20:39.870Z'
                        created_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                        is_monitoring_enabled: true
                        external_id: '77388994455034'
                        metadata: null
        '400':
          description: Bad Request
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Tue, 26 Nov 2024 09:33:10 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '328'
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
                  example: W/"148-/2HSFsAO91RX4rlW5j4SYEvc07k"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ErrorBadRequest1'
                  - examples:
                      - status: fail
                        message: Bulk process had errors
                        errorCode: null
                        data:
                          runId: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                          failed_rows:
                            '0':
                              message: 'Validation failed. Error details:'
                              data:
                                - column: tin
                                  providedKey: tin
                                  value: '333444685999'
                                  reason: Validation failed
                                - column: mobile
                                  providedKey: mobile
                                  value: '10'
                                  reason: Validation failed
                                - column: external_id
                                  providedKey: external_id
                                  value: '77388994455034'
                                  reason: >-
                                    The business external ID already exists for
                                    this customer (business ID:
                                    9d75fc32-6770-4586-8dd6-9a9a0b6596b2)
                                  existing_business_id: 9d75fc32-6770-4586-8dd6-9a9a0b6596b2
                          result: {}
                contentMediaType: application/json; charset=utf-8
              example:
                status: fail
                message: Bulk process had errors
                errorCode: null
                data:
                  runId: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                  failed_rows:
                    '0':
                      message: 'Validation failed. Error details:'
                      data:
                        - column: tin
                          providedKey: tin
                          value: '333444685999'
                          reason: Validation failed
                        - column: mobile
                          providedKey: mobile
                          value: '10'
                          reason: Validation failed
                        - column: external_id
                          providedKey: external_id
                          value: '77388994455034'
                          reason: >-
                            The business external ID already exists for this
                            customer (business ID:
                            9d75fc32-6770-4586-8dd6-9a9a0b6596b2)
                          existing_business_id: 9d75fc32-6770-4586-8dd6-9a9a0b6596b2
                  result: {}
        '401':
          description: Unauthorized
          headers:
            Date:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: Tue, 26 Nov 2024 09:49:07 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '145'
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
                  example: W/"91-HsCbOafj9k+6lDkP+i911e5MFNs"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - 98cc0580-5192-4d82-b5e7-08c1f16fd29a
                  - examples:
                      - status: fail
                        message: Authorization header not present
                        errorCode: UNAUTHENTICATED
                        data:
                          errorName: AuthenticationMiddlewareError
                contentMediaType: application/json; charset=utf-8
              example:
                status: fail
                message: Authorization header not present
                errorCode: UNAUTHENTICATED
                data:
                  errorName: AuthenticationMiddlewareError
      deprecated: false
      security:
        - bearer: []
components:
  schemas:
    ImportBusinessRequest:
      title: ImportBusinessRequest
      required:
        - name
      type: object
      properties:
        external_id:
          type: string
          description: >-
            A unique identifier for this record off of Worth's platform,
            sometimes from other, external systems. Spaces will be removed from
            the string.
          example: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
        name:
          type: string
          description: The official business name.
          example: Acme Corporation
        tin:
          type: string
          description: >-
            Taxpayer Identification Number issued by the government. Nine
            numeric digits with or without dash(es).
          example: '123456789'
        address_line_1:
          type: string
          description: Primary street address of the business.
          example: 123 Main St
        address_line_2:
          type: string
          description: Secondary address information (suite, apt, etc.).
          example: Suite 400
        address_city:
          type: string
          description: City of the business address.
          example: Metropolis
        address_state:
          type: string
          description: State or region of the business address.
          example: NY
        address_country:
          type: string
          description: Country of the business address.
          example: USA
        address_postal_code:
          type: string
          description: Postal or ZIP code for the business address.
          example: '10101'
        mobile:
          type: string
          description: Company's primary contact number.
          example: '5551234567'
        official_website:
          type: string
          description: URL of the company's official website.
          example: https://www.acme-corp.com
        naics_code:
          type: number
          description: >-
            North American Industry Classification System code. To find a
            particular code, please use https://www.naics.com/search/
          example: 541330
        naics_title:
          type: string
          description: Title corresponding to the NAICS code.
          example: Engineering Services
        mcc_code:
          type: number
          description: Merchant Category Code used for classifying business activities.
          example: 1234
        industry:
          type: string
          description: General industry classification.
          example: Finance and Insurance
        is_monitoring_enabled:
          type: boolean
          description: Whether ongoing monitoring is enabled for this business.
          example: true
        applicant_id:
          type: string
          description: Identifier for the loan or service applicant.
          example: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
        send_invitation:
          type: boolean
          description: Whether to send an invitation email to the applicant.
          example: false
        generate_invite_link:
          type: boolean
          description: Whether to generate an invite link for the applicant.
          example: false
        applicant_first_name:
          type: string
          description: First name of the applicant.
          example: John
        applicant_last_name:
          type: string
          description: Last name of the applicant.
          example: Doe
        applicant_email:
          type: string
          description: Email address of the applicant.
          example: john.doe@example.com
        applicant_subrole_code:
          type: string
          description: Subrole code of the applicant.
          example: owner
          enum:
            - owner
            - user
        dba1_name:
          type: string
          description: >-
            "Doing Business As" name, if different from legal name. Supports up
            to 5 DBAs using the pattern dba{n}_name (e.g., dba2_name,
            dba3_name).
          example: Acme Trading
        address1_line_1:
          type: string
          description: >-
            Primary street address for an additional location. Supports up to 5
            addresses using the pattern address{n}_{field} (e.g.,
            address2_line_1, address3_city).
          example: 456 Elm St
        address1_apartment:
          type: string
          description: Apartment or suite number for the DBA address.
          example: Apt 12B
        address1_city:
          type: string
          description: City for the DBA address.
          example: Gotham
        address1_state:
          type: string
          description: State for the DBA address (Two-letter abbreviation).
          example: CA
        address1_country:
          type: string
          description: Country for the DBA address.
          example: USA
        address1_postal_code:
          type: string
          description: Postal code for the DBA address.
          example: '90210'
        address1_mobile:
          type: string
          description: Contact number for the DBA location.
          example: '5559876543'
        year_created:
          type: number
          description: Year the business was established.
          example: 2015
        annual_total_income:
          type: number
          description: Total revenue in the last fiscal year.
          example: 500000
        total_wages:
          type: number
          description: Total wages paid to employees last year.
          example: 200000
        annual_net_income:
          type: number
          description: Net profit after expenses last year.
          example: 300000
        cost_of_goods_sold:
          type: number
          description: Direct costs attributable to goods sold.
          example: 150000
        total_liabilities:
          type: number
          description: Sum of all current and non-current liabilities.
          example: 100000
        total_assets:
          type: number
          description: Sum of all current and non-current assets.
          example: 600000
        total_equity:
          type: number
          description: Sum of all current equity.
          example: 500000
        total_accounts_payable:
          type: number
          description: Amount owed to suppliers and vendors.
          example: 25000
        total_accounts_recievable:
          type: number
          description: Outstanding amounts owed by customers.
          example: 30000
        total_cash_and_cash_equivalents:
          type: number
          description: Liquid assets on hand.
          example: 50000
        total_short_term_investments:
          type: number
          description: Investments easily convertible to cash within a year.
          example: 10000
        total_current_assets:
          type: number
          description: Assets expected to be used or sold within one year.
          example: 120000
        total_current_liabilities:
          type: number
          description: Obligations due within one year.
          example: 40000
        non_current_liablities:
          type: number
          description: Long-term obligations not due within one year.
          example: 60000
        annual_cost_of_goods_sold:
          type: number
          description: COGS aggregated over the fiscal year.
          example: 150000
        annual_gross_profit:
          type: number
          description: Revenue minus cost of goods sold.
          example: 350000
        annual_taxes_paid:
          type: number
          description: Total taxes paid in the fiscal year.
          example: 50000
        annual_interest_expenses:
          type: number
          description: Interest paid on debts during the year.
          example: 10000
        number_of_employees:
          type: number
          description: Total full-time equivalent employees.
          example: 25
        business_type:
          type: string
          description: Legal structure of the business.
          example: LLC
        sic_code:
          type: number
          description: >-
            Standard Industrial Classification code. Codes may be found here:
            https://www.osha.gov/data/sic-search
          example: 5812
        score_retrieval_date:
          type: string
          description: Date on which credit or risk score was fetched.
          example: '2025-06-16'
        business_liens:
          type: number
        business_liens_file_date:
          type: string
        business_liens_status:
          type: string
        business_liens_status_date:
          type: string
        business_bankruptcies:
          type: number
        business_bankruptcies_file_date:
          type: string
        business_bankruptcies_chapter:
          type: string
        business_bankruptcies_voluntary:
          type: string
        business_bankruptcies_status:
          type: string
        business_bankruptcies_status_date:
          type: string
        business_judgements:
          type: number
        business_judgements_file_date:
          type: string
        business_judgements_status:
          type: string
        business_judgements_status_date:
          type: string
        business_judgements_amount:
          type: number
        social_review_count:
          type: number
        social_review_score:
          type: number
        owner1_title:
          type: string
          description: >-
            Official title of the first owner. The API supports up to 5 owners
            using the pattern owner{n}_{field} (e.g., owner2_title,
            owner3_first_name, etc.).
          example: Partner
          enum:
            - Partner
            - Limited Partner
            - Director
            - Chief Accounting Officer
            - Chief Executive Officer
            - Chief Operations Officer
            - President
            - Vice President
            - Treasurer
            - Assistant Treasurer
            - 1% Shareholder
            - Shareholder
            - Controller
            - Managing Member
            - Owner
            - Sole Proprietor
            - Executor
            - Beneficiary
            - Trustee
            - Administrator
            - Assistant Secretary
            - Authorized Person
            - Chairman of the Board
            - Chief Compliance Officer
            - Chief Financial Officer
            - Chief Legal Officer
            - Chief Technology Officer
            - Co-Founder
            - Founder
            - General Partner
            - Managing Partner
            - Manager
            - Member
            - Principal
            - Registered Agent
            - Secretary
            - Chairperson
        owner1_external_id:
          type: string
          description: External ID of the first owner.
          example: abc123
        owner1_first_name:
          type: string
          description: First name of the first owner.
          example: Jane
        owner1_last_name:
          type: string
          description: Last name of the first owner.
          example: Smith
        owner1_email:
          type: string
          description: Email of the first owner.
          example: jane.smith@example.com
        owner1_mobile:
          type: string
          description: Mobile phone of the first owner.
          example: +1-555-765-4321
        owner1_ssn:
          type: string
          description: Social Security Number of the first owner.
          example: '123456789'
        owner1_dob:
          type: string
          description: Date of birth of the first owner.
          example: '1980-01-01'
        owner1_address_line_1:
          type: string
          description: Primary street address of the first owner.
          example: 789 Oak Ave
        owner1_address_line_2:
          type: string
          description: Secondary address information for the first owner.
          example: Floor 2
        owner1_address_city:
          type: string
          description: City for the first owner’s address.
          example: Star City
        owner1_address_state:
          type: string
          description: State for the first owner’s address.
          example: IL
        owner1_address_postal:
          type: string
          description: Postal code for the first owner’s address.
          example: '60601'
        owner1_address_country:
          type: string
          description: Country for the first owner’s address.
          example: USA
        owner1_owner_type:
          type: string
          enum:
            - BENEFICIARY
            - CONTROL
          description: >-
            Role of the first owner (beneficiary or controlling party). Only one
            owner may be of type CONTROL
          example: BENEFICIARY
        owner1_ownership_percentage:
          type: number
          description: Percentage ownership held by the first owner.
          example: 100
        bank_account_number:
          type: string
          description: Identifier for the company’s bank account.
          example: '000123456789'
        bank_name:
          type: string
          description: Name of the bank where the account is held.
          example: First National Bank
        institution_name:
          type: string
          description: Official institution name for banking relationships.
          example: Acme Financial Institution
        bank_routing_number:
          type: string
          description: ABA routing number for the bank.
          example: '111000025'
        bank_wire_routing_number:
          type: string
          description: Wire transfer routing number.
          example: '111000026'
        bank_official_name:
          type: string
          description: Legal name of the bank entity.
          example: First National Bank, NA
        bank_account_type:
          type: string
          description: Type of bank account.
          example: checking
        bank_account_subtype:
          type: string
          description: Subtype of the bank account.
          example: business
        bank_account_balance_current:
          type: number
          description: Current recorded balance of the account.
          example: 250000
        bank_account_balance_available:
          type: number
          description: Available balance for withdrawal.
          example: 240000
        bank_account_balance_limit:
          type: number
          description: Overdraft or credit limit on the account.
          example: 5000
        deposit_account:
          type: boolean
          description: Whether this account is used for deposits.
          example: true
        bank_account_holder_type:
          type: string
          description: Type of the bank account holder.
          example: business
          enum:
            - business
            - personal
        bank_account_holder_name:
          type: string
          description: Name of the bank account holder.
          example: John Doe
        npi:
          type: string
          description: National Provider Identifier (for healthcare entities).
          example: '1234567890'
        npi_first_name:
          type: string
          description: First name of the NPI holder.
          example: John
        npi_last_name:
          type: string
          description: Last name of the NPI holder.
          example: Doe
        skip_credit_check:
          type: boolean
          description: >-
            OPTIONAL functionality when personal credit checks are enabled. A
            flag to indicate whether personal credit checks on the business
            owner should be skipped. Default is false.
          example: false
        bypass_ssn:
          type: boolean
          description: Whether to bypass the Social Security Number check.
          example: false
        canada_business_number:
          type: string
          description: Canada Business Number (for Canadian businesses).
          example: 123456789 RC 0001
        canada_corporate_id:
          type: string
          description: Name of the Canadian business.
          example: '123456789'
        aging_config:
          type: object
          description: >-
            If enabled, the reminder thresholds and their severity set for
            applicant cases. If configured, a webhook event will be emitted with
            the custom messages at the specified allotted number of days.
          properties:
            thresholds:
              type: object
              properties:
                low:
                  type: integer
                  minimum: 0
                medium:
                  type: integer
                  minimum: 0
                high:
                  type: integer
                  minimum: 0
            custom_messages:
              type: object
              properties:
                low:
                  type: string
                medium:
                  type: string
                high:
                  type: string
      examples: []
    Success2:
      title: Success2
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data2'
      examples: []
    ErrorBadRequest1:
      title: ErrorBadRequest1
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        errorCode:
          type:
            - string
            - 'null'
        data:
          $ref: '#/components/schemas/Data3'
      examples: []
    Data2:
      title: Data2
      type: object
      properties:
        runId:
          type: string
        result:
          type: object
          additionalProperties:
            $ref: '#/components/schemas/generatedObject'
      examples: []
    Data3:
      title: Data3
      type: object
      properties:
        runId:
          type: string
        failed_rows:
          type: object
          additionalProperties:
            $ref: '#/components/schemas/generatedObject1'
        result:
          type: object
      examples: []
    generatedObject:
      title: generatedObject
      type: object
      properties:
        warnings:
          type: array
          items:
            type: string
          description: >-
            List of warning messages (e.g., missing fields for optional
            enrichment features).
        userID:
          type: string
          description: Identifier for the user who initiated the request.
        customerID:
          type: string
          description: Identifier for the customer.
        businessID:
          type:
            - string
            - 'null'
          description: >-
            Identifier for the created or matched business. May be null when
            processing asynchronously.
        applicantID:
          type: string
          description: Identifier for the applicant associated with this business.
        riskMonitoring:
          type: boolean
          description: Whether risk monitoring is enabled for this business.
        async:
          type: boolean
          description: Whether the request was processed asynchronously.
        data_businesses:
          $ref: '#/components/schemas/DataBusinesses'
        data_cases:
          type: array
          items:
            $ref: '#/components/schemas/DataCases'
          description: >-
            Array of case objects associated with the business. For PATCH
            requests, this may be a single object rather than an array.
        owners:
          type: array
          items:
            $ref: '#/components/schemas/Owner'
          description: Array of owner objects associated with the business.
        integration_data:
          $ref: '#/components/schemas/IntegrationData'
        business_customer:
          $ref: '#/components/schemas/BusinessCustomer'
      examples: []
    generatedObject1:
      title: generatedObject1
      type: object
      properties:
        message:
          type: string
        data:
          type: object
      examples: []
    DataBusinesses:
      title: DataBusinesses
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        tin:
          type: string
        address_apartment:
          type:
            - string
            - 'null'
        address_line_1:
          type: string
        address_line_2:
          type:
            - string
            - 'null'
        address_city:
          type: string
        address_state:
          type: string
        address_postal_code:
          type: string
        address_country:
          type:
            - string
            - 'null'
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        updated_by:
          type: string
        mobile:
          type:
            - string
            - 'null'
        official_website:
          type:
            - string
            - 'null'
        public_website:
          type:
            - string
            - 'null'
        social_account:
          type:
            - string
            - 'null'
        status:
          type: string
        industry:
          type: object
          properties:
            id:
              type: number
            name:
              type: string
            code:
              type: string
            sector_code:
              type: string
            created_at:
              type: string
            updated_at:
              type: string
        mcc_id:
          type:
            - number
            - 'null'
        naics_id:
          type:
            - number
            - 'null'
        naics_code:
          type:
            - number
            - 'null'
        naics_title:
          type:
            - string
            - 'null'
        mcc_code:
          type:
            - number
            - 'null'
        mcc_title:
          type:
            - string
            - 'null'
        is_monitoring_enabled:
          type:
            - boolean
            - 'null'
        deleted_by:
          type:
            - string
            - 'null'
        deleted_at:
          type:
            - string
            - 'null'
        subscription:
          $ref: '#/components/schemas/Subscription'
        business_names:
          type: array
          items:
            $ref: '#/components/schemas/BusinessName'
          description: ''
        business_addresses:
          type: array
          items:
            $ref: '#/components/schemas/BusinessAddress'
          description: ''
      examples: []
    DataCases:
      title: DataCases
      type: object
      properties:
        id:
          type: string
        applicant_id:
          type: string
        customer_id:
          type: string
        status:
          type: integer
          contentEncoding: int32
        created_at:
          type: string
        created_by:
          type: string
        updated_at:
          type: string
        updated_by:
          type: string
        business_id:
          type: string
        case_type:
          type: integer
          contentEncoding: int32
        assignee:
          type:
            - string
            - 'null'
        assigner:
          type:
            - string
            - 'null'
        customer_initiated:
          type: boolean
      examples: []
    Owner:
      title: Owner
      type: object
      properties:
        id:
          type: string
          description: Unique owner identifier.
        external_id:
          type:
            - string
            - 'null'
          description: External ID of the owner.
        title:
          type:
            - string
            - 'null'
          description: Owner title (e.g., CEO, Partner).
        first_name:
          type:
            - string
            - 'null'
          description: Owner first name.
        last_name:
          type:
            - string
            - 'null'
          description: Owner last name.
        ssn:
          type:
            - string
            - 'null'
          description: Social Security Number (encrypted).
        email:
          type:
            - string
            - 'null'
          description: Owner email address.
        mobile:
          type:
            - string
            - 'null'
          description: Owner mobile phone number.
        date_of_birth:
          type:
            - string
            - 'null'
          description: Date of birth in ISO 8601 format.
        address_line_1:
          type:
            - string
            - 'null'
          description: Primary street address.
        address_city:
          type:
            - string
            - 'null'
          description: City.
        address_state:
          type:
            - string
            - 'null'
          description: State/province.
        address_postal_code:
          type:
            - string
            - 'null'
          description: Postal/ZIP code.
        address_country:
          type:
            - string
            - 'null'
          description: Country code.
        ownership_percentage:
          type:
            - number
            - 'null'
          description: Percentage of ownership (0-100).
        owner_type:
          type:
            - string
            - 'null'
          description: Role type (BENEFICIARY or CONTROL).
        created_at:
          type: string
          description: Creation timestamp.
        updated_at:
          type: string
          description: Last update timestamp.
    IntegrationData:
      title: IntegrationData
      type: object
      properties:
        dba1_name:
          type:
            - string
            - 'null'
        dba2_name:
          type:
            - string
            - 'null'
        dba3_name:
          type:
            - string
            - 'null'
        dba4_name:
          type:
            - string
            - 'null'
        dba5_name:
          type:
            - string
            - 'null'
        address1_line_1:
          type:
            - string
            - 'null'
        address2_line_1:
          type:
            - string
            - 'null'
        address3_line_1:
          type:
            - string
            - 'null'
        address4_line_1:
          type:
            - string
            - 'null'
        address5_line_1:
          type:
            - string
            - 'null'
        address1_apartment:
          type:
            - string
            - 'null'
        address2_apartment:
          type:
            - string
            - 'null'
        address3_apartment:
          type:
            - string
            - 'null'
        address4_apartment:
          type:
            - string
            - 'null'
        address5_apartment:
          type:
            - string
            - 'null'
        address1_city:
          type:
            - string
            - 'null'
        address2_city:
          type:
            - string
            - 'null'
        address3_city:
          type:
            - string
            - 'null'
        address4_city:
          type:
            - string
            - 'null'
        address5_city:
          type:
            - string
            - 'null'
        state:
          type: string
        address1_country:
          type:
            - string
            - 'null'
        address2_country:
          type:
            - string
            - 'null'
        address3_country:
          type:
            - string
            - 'null'
        address4_country:
          type:
            - string
            - 'null'
        address5_country:
          type:
            - string
            - 'null'
        address1_postal_code:
          type:
            - string
            - 'null'
        address2_postal_code:
          type:
            - string
            - 'null'
        address3_postal_code:
          type:
            - string
            - 'null'
        address4_postal_code:
          type:
            - string
            - 'null'
        address5_postal_code:
          type:
            - string
            - 'null'
        address1_mobile:
          type:
            - string
            - 'null'
        address2_mobile:
          type:
            - string
            - 'null'
        address3_mobile:
          type:
            - string
            - 'null'
        address4_mobile:
          type:
            - string
            - 'null'
        address5_mobile:
          type:
            - string
            - 'null'
        id:
          type:
            - string
            - 'null'
        name:
          type: string
        tin:
          type: string
        address_line_1:
          type: string
        address_line_2:
          type:
            - string
            - 'null'
        address_city:
          type: string
        address_country:
          type:
            - string
            - 'null'
        address_postal_code:
          type: string
        mobile:
          type:
            - string
            - 'null'
        official_website:
          type:
            - string
            - 'null'
        naics_code:
          type:
            - number
            - 'null'
        naics_title:
          type:
            - string
            - 'null'
        mcc_code:
          type:
            - number
            - 'null'
        industry:
          type:
            - string
            - 'null'
        quick_add:
          type:
            - string
            - 'null'
        external_id:
          type: string
        metadata:
          type:
            - string
            - 'null'
        owner1_title:
          type:
            - string
            - 'null'
        owner2_title:
          type:
            - string
            - 'null'
        owner3_title:
          type:
            - string
            - 'null'
        owner4_title:
          type:
            - string
            - 'null'
        owner5_title:
          type:
            - string
            - 'null'
        owner1_external_id:
          type:
            - string
            - 'null'
        owner2_external_id:
          type:
            - string
            - 'null'
        owner3_external_id:
          type:
            - string
            - 'null'
        owner4_external_id:
          type:
            - string
            - 'null'
        owner5_external_id:
          type:
            - string
            - 'null'
        owner1_first_name:
          type:
            - string
            - 'null'
        owner2_first_name:
          type:
            - string
            - 'null'
        owner3_first_name:
          type:
            - string
            - 'null'
        owner4_first_name:
          type:
            - string
            - 'null'
        owner5_first_name:
          type:
            - string
            - 'null'
        owner1_last_name:
          type:
            - string
            - 'null'
        owner2_last_name:
          type:
            - string
            - 'null'
        owner3_last_name:
          type:
            - string
            - 'null'
        owner4_last_name:
          type:
            - string
            - 'null'
        owner5_last_name:
          type:
            - string
            - 'null'
        owner1_email:
          type:
            - string
            - 'null'
        owner2_email:
          type:
            - string
            - 'null'
        owner3_email:
          type:
            - string
            - 'null'
        owner4_email:
          type:
            - string
            - 'null'
        owner5_email:
          type:
            - string
            - 'null'
        owner1_mobile:
          type:
            - string
            - 'null'
        owner2_mobile:
          type:
            - string
            - 'null'
        owner3_mobile:
          type:
            - string
            - 'null'
        owner4_mobile:
          type:
            - string
            - 'null'
        owner5_mobile:
          type:
            - string
            - 'null'
        owner1_ssn:
          type:
            - string
            - 'null'
        owner2_ssn:
          type:
            - string
            - 'null'
        owner3_ssn:
          type:
            - string
            - 'null'
        owner4_ssn:
          type:
            - string
            - 'null'
        owner5_ssn:
          type:
            - string
            - 'null'
        owner1_dob:
          type:
            - string
            - 'null'
        owner2_dob:
          type:
            - string
            - 'null'
        owner3_dob:
          type:
            - string
            - 'null'
        owner4_dob:
          type:
            - string
            - 'null'
        owner5_dob:
          type:
            - string
            - 'null'
        owner1_address_line_1:
          type:
            - string
            - 'null'
        owner2_address_line_1:
          type:
            - string
            - 'null'
        owner3_address_line_1:
          type:
            - string
            - 'null'
        owner4_address_line_1:
          type:
            - string
            - 'null'
        owner5_address_line_1:
          type:
            - string
            - 'null'
        owner1_address_line_2:
          type:
            - string
            - 'null'
        owner2_address_line_2:
          type:
            - string
            - 'null'
        owner3_address_line_2:
          type:
            - string
            - 'null'
        owner4_address_line_2:
          type:
            - string
            - 'null'
        owner5_address_line_2:
          type:
            - string
            - 'null'
        owner1_address_city:
          type:
            - string
            - 'null'
        owner2_address_city:
          type:
            - string
            - 'null'
        owner3_address_city:
          type:
            - string
            - 'null'
        owner4_address_city:
          type:
            - string
            - 'null'
        owner5_address_city:
          type:
            - string
            - 'null'
        owner1_address_state:
          type:
            - string
            - 'null'
        owner2_address_state:
          type:
            - string
            - 'null'
        owner3_address_state:
          type:
            - string
            - 'null'
        owner4_address_state:
          type:
            - string
            - 'null'
        owner5_address_state:
          type:
            - string
            - 'null'
        owner1_address_postal:
          type:
            - string
            - 'null'
        owner2_address_postal:
          type:
            - string
            - 'null'
        owner3_address_postal:
          type:
            - string
            - 'null'
        owner4_address_postal:
          type:
            - string
            - 'null'
        owner5_address_postal:
          type:
            - string
            - 'null'
        owner1_address_country:
          type:
            - string
            - 'null'
        owner2_address_country:
          type:
            - string
            - 'null'
        owner3_address_country:
          type:
            - string
            - 'null'
        owner4_address_country:
          type:
            - string
            - 'null'
        owner5_address_country:
          type:
            - string
            - 'null'
        owner1_owner_type:
          type:
            - string
            - 'null'
        owner2_owner_type:
          type:
            - string
            - 'null'
        owner3_owner_type:
          type:
            - string
            - 'null'
        owner4_owner_type:
          type:
            - string
            - 'null'
        owner5_owner_type:
          type:
            - string
            - 'null'
        owner1_ownership_percentage:
          type:
            - string
            - 'null'
        owner2_ownership_percentage:
          type:
            - string
            - 'null'
        owner3_ownership_percentage:
          type:
            - string
            - 'null'
        owner4_ownership_percentage:
          type:
            - string
            - 'null'
        owner5_ownership_percentage:
          type:
            - string
            - 'null'
        send_invitation:
          type:
            - string
            - 'null'
        applicant_first_name:
          type:
            - string
            - 'null'
        applicant_last_name:
          type:
            - string
            - 'null'
        applicant_email:
          type:
            - string
            - 'null'
        year:
          type:
            - string
            - 'null'
        is_revenue:
          type: integer
          contentEncoding: int32
        is_operatingexpenses:
          type:
            - string
            - 'null'
        is_netincome:
          type:
            - string
            - 'null'
        is_cost_of_goods_sold:
          type:
            - string
            - 'null'
        bs_totalliabilities:
          type:
            - string
            - 'null'
        bs_totalassets:
          type:
            - string
            - 'null'
        bs_totalequity:
          type:
            - string
            - 'null'
        bs_accountspayable:
          type:
            - string
            - 'null'
        bs_accountsreceivable:
          type:
            - string
            - 'null'
        bs_cashandcashequivalents:
          type:
            - string
            - 'null'
        bs_shortterminvestments:
          type:
            - string
            - 'null'
        bs_totalcurrentassets:
          type:
            - string
            - 'null'
        bs_totalcurrentliabilities:
          type:
            - string
            - 'null'
        bs_totalnoncurrentliabilities:
          type:
            - string
            - 'null'
        is_costofgoodsold:
          type:
            - string
            - 'null'
        is_grossprofit:
          type:
            - string
            - 'null'
        is_incometaxexpense:
          type:
            - string
            - 'null'
        is_interestexpense:
          type:
            - string
            - 'null'
        number_of_employees:
          type:
            - string
            - 'null'
        business_type:
          type:
            - string
            - 'null'
        sic_code:
          type:
            - string
            - 'null'
        date_of_observation:
          type:
            - string
            - 'null'
        lien_count:
          type:
            - string
            - 'null'
        business_liens_file_date:
          type:
            - string
            - 'null'
        business_liens_status:
          type:
            - string
            - 'null'
        business_liens_status_date:
          type:
            - string
            - 'null'
        bankruptcy_count:
          type:
            - string
            - 'null'
        business_bankruptcies_file_date:
          type:
            - string
            - 'null'
        business_bankruptcies_chapter:
          type:
            - string
            - 'null'
        business_bankruptcies_voluntary:
          type:
            - string
            - 'null'
        business_bankruptcies_status:
          type:
            - string
            - 'null'
        business_bankruptcies_status_date:
          type:
            - string
            - 'null'
        judgement_count:
          type:
            - string
            - 'null'
        business_judgements_file_date:
          type:
            - string
            - 'null'
        business_judgements_status:
          type:
            - string
            - 'null'
        business_judgements_status_date:
          type:
            - string
            - 'null'
        business_judgements_amount:
          type:
            - string
            - 'null'
        review_cnt:
          type:
            - string
            - 'null'
        review_score:
          type:
            - string
            - 'null'
        bank_account_number:
          type:
            - string
            - 'null'
        bank_name:
          type:
            - string
            - 'null'
        institution_name:
          type:
            - string
            - 'null'
        bank_routing_number:
          type:
            - number
            - 'null'
        bank_wire_routing_number:
          type:
            - number
            - 'null'
        bank_official_name:
          type:
            - string
            - 'null'
        bank_account_type:
          type:
            - string
            - 'null'
        bank_account_subtype:
          type:
            - string
            - 'null'
        bank_account_balance_current:
          type:
            - number
            - 'null'
        bank_account_balance_available:
          type:
            - number
            - 'null'
        bank_account_balance_limit:
          type:
            - number
            - 'null'
        deposit_account:
          type:
            - boolean
            - 'null'
        npi:
          type:
            - string
            - 'null'
      examples: []
    BusinessCustomer:
      title: BusinessCustomer
      type: object
      properties:
        business_id:
          type: string
        customer_id:
          type: string
        created_at:
          type: string
        created_by:
          type: string
        is_monitoring_enabled:
          type: boolean
        external_id:
          type: string
        metadata:
          type:
            - string
            - 'null'
      examples: []
    Subscription:
      title: Subscription
      type: object
      properties:
        status:
          type:
            - string
            - 'null'
        created_at:
          type:
            - string
            - 'null'
        updated_at:
          type:
            - string
            - 'null'
      examples: []
    BusinessName:
      title: BusinessName
      type: object
      properties:
        name:
          type: string
        is_primary:
          type: boolean
      examples:
        - name: Test Business
          is_primary: false
    BusinessAddress:
      title: BusinessAddress
      type: object
      properties:
        line_1:
          type: string
        apartment:
          type:
            - string
            - 'null'
        city:
          type: string
        state:
          type: string
        country:
          type: string
        postal_code:
          type: string
        mobile:
          type:
            - string
            - 'null'
        is_primary:
          type: boolean
      examples: []
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````

Built with [Mintlify](https://mintlify.com).