<!-- Source: https://docs.worthai.com/api-reference/case/businesses/get-customer-businesses.md -->
# Get Customer Businesses

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Customer Businesses

> Get all businesses associated with a particular customerID.



## OpenAPI

````yaml get /businesses/customers/{customerID}
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
    get:
      tags:
        - Businesses
      summary: Get Customer Businesses
      description: Get all businesses associated with a particular customerID.
      operationId: GetCustomerBusinesses
      parameters:
        - name: customerID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
        - name: search_filter[external_id]
          in: query
          description: >-
            The unique external identifier provided during business creation.
            This can be a string or a UUID.
          required: false
          style: form
          explode: true
          schema:
            type: string
            examples:
              - '87654321'
              - 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
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
                  example: Tue, 13 Feb 2024 06:13:50 GMT
            Content-Length:
              content:
                text/plain:
                  schema:
                    type: string
                    contentMediaType: text/plain
                  example: '7290'
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
                  example: W/"1c7a-66nCh/MugWSSupRYW2pdjWpGoUU"
          content:
            application/json; charset=utf-8:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Success2'
                contentMediaType: application/json; charset=utf-8
              example:
                status: success
                message: Businesses associated with customer fetched successfully
                data:
                  records:
                    - id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                      name: null
                      tin: null
                      address_apartment: null
                      address_line_1: null
                      address_line_2: null
                      address_city: null
                      address_state: null
                      address_postal_code: null
                      address_country: null
                      created_at: '2023-12-22T11:03:04.416Z'
                      created_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                      updated_at: '2024-02-02T18:50:11.022Z'
                      updated_by: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                      mobile: null
                      official_website: null
                      public_website: null
                      social_account: null
                      status: INACTIVE
                      customer_id: 1a2b3c4d-5e6f-1a2b-3c4d-5e6f1a2b3c4d
                      external_id: '87654321'
                  total_pages: 1
                  total_items: 1
      deprecated: false
      servers:
        - url: https://api.joinworth.com/case/api/v1
          variables: {}
components:
  schemas:
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

````

Built with [Mintlify](https://mintlify.com).