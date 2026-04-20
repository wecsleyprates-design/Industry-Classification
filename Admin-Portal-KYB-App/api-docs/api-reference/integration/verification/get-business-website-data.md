<!-- Source: https://docs.worthai.com/api-reference/integration/verification/get-business-website-data.md -->
# Get Website Data

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Website Data

> Fetch enriched business website data, including domain details, SSL status, and associated metadata.



## OpenAPI

````yaml get /verification/businesses/{businessID}/website-data
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
  /verification/businesses/{businessID}/website-data:
    parameters: []
    get:
      tags:
        - Verification
      summary: Get Website Data
      description: >-
        Fetch enriched business website data, including domain details, SSL
        status, and associated metadata.
      operationId: GetWebsiteData
      parameters:
        - name: businessID
          in: path
          description: ''
          required: true
          style: simple
          schema:
            type: string
            examples:
              - 5794811f-1b4e-4952-9800-ed58a6c04ee2
      responses:
        default:
          description: ''
          headers: {}
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/GetWebsiteData'
                  - examples:
                      - status: success
                        message: Business website data fetched successfully.
                        data:
                          id: 3cc974a1-660c-4d52-b719-240cbcf55110
                          url: http://www.southernhomebakery.com
                          error: null
                          pages:
                            - url: https://www.southernhomebakery.com/
                              category: home
                              screenshot_url: null
                            - url: >-
                                https://www.southernhomebakery.com/pages/privacy-policy
                              category: privacy
                              screenshot_url: null
                            - url: https://www.southernhomebakery.com/pages/about
                              category: about
                              screenshot_url: null
                            - url: >-
                                https://www.southernhomebakery.com/pages/terms-of-service
                              category: terms
                              screenshot_url: null
                          title: >-
                            Southern Home Bakery - Custom Sugar Cookies from
                            Orlando, Florida
                          domain:
                            domain: southernhomebakery.com
                            domain_id: 2132417788_DOMAIN_COM-VRSN
                            registrar:
                              url: http://tucowsdomains.com
                              name: TUCOWS, INC.
                              organization: TUCOWS, INC.
                            creation_date: '2017-06-09T21:32:49.000+00:00'
                            expiration_date: '2025-06-09T21:32:49.000+00:00'
                          object: website
                          parked: false
                          people: null
                          status: online
                          addresses: []
                          created_at: '2024-11-12T19:56:28.770Z'
                          updated_at: '2024-11-12T19:56:44.272Z'
                          business_id: a2352eb6-c87e-44ad-8d30-3b8fe57a1c02
                          description: >-
                            Custom, hand decorated sugar cookies and nostalgic
                            Southern desserts to share with friends and family
                            for any occasion and celebration!
                          phone_numbers: []
                          email_addresses: null
                          http_status_code: 200
                          business_name_match: true
                contentMediaType: application/json
              example:
                status: success
                message: Business website data fetched successfully.
                data:
                  id: 3cc974a1-660c-4d52-b719-240cbcf55110
                  url: http://www.southernhomebakery.com
                  error: null
                  pages:
                    - url: https://www.southernhomebakery.com/
                      category: home
                      screenshot_url: null
                    - url: https://www.southernhomebakery.com/pages/privacy-policy
                      category: privacy
                      screenshot_url: null
                    - url: https://www.southernhomebakery.com/pages/about
                      category: about
                      screenshot_url: null
                    - url: >-
                        https://www.southernhomebakery.com/pages/terms-of-service
                      category: terms
                      screenshot_url: null
                  title: >-
                    Southern Home Bakery - Custom Sugar Cookies from Orlando,
                    Florida
                  domain:
                    domain: southernhomebakery.com
                    domain_id: 2132417788_DOMAIN_COM-VRSN
                    registrar:
                      url: http://tucowsdomains.com
                      name: TUCOWS, INC.
                      organization: TUCOWS, INC.
                    creation_date: '2017-06-09T21:32:49.000+00:00'
                    expiration_date: '2025-06-09T21:32:49.000+00:00'
                  object: website
                  parked: false
                  people: null
                  status: online
                  addresses: []
                  created_at: '2024-11-12T19:56:28.770Z'
                  updated_at: '2024-11-12T19:56:44.272Z'
                  business_id: a2352eb6-c87e-44ad-8d30-3b8fe57a1c02
                  description: >-
                    Custom, hand decorated sugar cookies and nostalgic Southern
                    desserts to share with friends and family for any occasion
                    and celebration!
                  phone_numbers: []
                  email_addresses: null
                  http_status_code: 200
                  business_name_match: true
      deprecated: false
      security:
        - bearer: []
      servers:
        - url: https://api.joinworth.com/integration/api/v1
          variables: {}
components:
  schemas:
    GetWebsiteData:
      title: GetWebsiteData
      type: object
      properties:
        status:
          type: string
        message:
          type: string
        data:
          $ref: '#/components/schemas/Data41'
      examples:
        - status: success
          message: Business website data fetched successfully.
          data:
            id: 3cc974a1-660c-4d52-b719-240cbcf55110
            url: http://www.southernhomebakery.com
            error: null
            pages:
              - url: https://www.southernhomebakery.com/
                category: home
                screenshot_url: null
              - url: https://www.southernhomebakery.com/pages/privacy-policy
                category: privacy
                screenshot_url: null
              - url: https://www.southernhomebakery.com/pages/about
                category: about
                screenshot_url: null
              - url: https://www.southernhomebakery.com/pages/terms-of-service
                category: terms
                screenshot_url: null
            title: Southern Home Bakery - Custom Sugar Cookies from Orlando, Florida
            domain:
              domain: southernhomebakery.com
              domain_id: 2132417788_DOMAIN_COM-VRSN
              registrar:
                url: http://tucowsdomains.com
                name: TUCOWS, INC.
                organization: TUCOWS, INC.
              creation_date: '2017-06-09T21:32:49.000+00:00'
              expiration_date: '2025-06-09T21:32:49.000+00:00'
            object: website
            parked: false
            people: null
            status: online
            addresses: []
            created_at: '2024-11-12T19:56:28.770Z'
            updated_at: '2024-11-12T19:56:44.272Z'
            business_id: a2352eb6-c87e-44ad-8d30-3b8fe57a1c02
            description: >-
              Custom, hand decorated sugar cookies and nostalgic Southern
              desserts to share with friends and family for any occasion and
              celebration!
            phone_numbers: []
            email_addresses: null
            http_status_code: 200
            business_name_match: true
    Data41:
      title: Data41
      type: object
      properties:
        id:
          type: string
        url:
          type: string
        error:
          type:
            - string
            - 'null'
        pages:
          type: array
          items:
            $ref: '#/components/schemas/Page'
          description: ''
        title:
          type: string
        domain:
          $ref: '#/components/schemas/Domain'
        object:
          type: string
        parked:
          type: boolean
        people:
          type:
            - string
            - 'null'
        status:
          type: string
        addresses:
          type: array
          items:
            type: string
          description: ''
        created_at:
          type: string
        updated_at:
          type: string
        business_id:
          type: string
        description:
          type: string
        phone_numbers:
          type: array
          items:
            type: string
          description: ''
        email_addresses:
          type:
            - string
            - 'null'
        http_status_code:
          type: integer
          contentEncoding: int32
        business_name_match:
          type: boolean
      examples:
        - id: 3cc974a1-660c-4d52-b719-240cbcf55110
          url: http://www.southernhomebakery.com
          error: null
          pages:
            - url: https://www.southernhomebakery.com/
              category: home
              screenshot_url: null
            - url: https://www.southernhomebakery.com/pages/privacy-policy
              category: privacy
              screenshot_url: null
            - url: https://www.southernhomebakery.com/pages/about
              category: about
              screenshot_url: null
            - url: https://www.southernhomebakery.com/pages/terms-of-service
              category: terms
              screenshot_url: null
          title: Southern Home Bakery - Custom Sugar Cookies from Orlando, Florida
          domain:
            domain: southernhomebakery.com
            domain_id: 2132417788_DOMAIN_COM-VRSN
            registrar:
              url: http://tucowsdomains.com
              name: TUCOWS, INC.
              organization: TUCOWS, INC.
            creation_date: '2017-06-09T21:32:49.000+00:00'
            expiration_date: '2025-06-09T21:32:49.000+00:00'
          object: website
          parked: false
          people: null
          status: online
          addresses: []
          created_at: '2024-11-12T19:56:28.770Z'
          updated_at: '2024-11-12T19:56:44.272Z'
          business_id: a2352eb6-c87e-44ad-8d30-3b8fe57a1c02
          description: >-
            Custom, hand decorated sugar cookies and nostalgic Southern desserts
            to share with friends and family for any occasion and celebration!
          phone_numbers: []
          email_addresses: null
          http_status_code: 200
          business_name_match: true
    Page:
      title: Page
      type: object
      properties:
        url:
          type: string
        category:
          type: string
        screenshot_url:
          type:
            - string
            - 'null'
      examples:
        - url: https://www.southernhomebakery.com/
          category: home
          screenshot_url: null
    Domain:
      title: Domain
      type: object
      properties:
        domain:
          type: string
        domain_id:
          type: string
        registrar:
          $ref: '#/components/schemas/Registrar'
        creation_date:
          type: string
        expiration_date:
          type: string
      examples:
        - domain: southernhomebakery.com
          domain_id: 2132417788_DOMAIN_COM-VRSN
          registrar:
            url: http://tucowsdomains.com
            name: TUCOWS, INC.
            organization: TUCOWS, INC.
          creation_date: '2017-06-09T21:32:49.000+00:00'
          expiration_date: '2025-06-09T21:32:49.000+00:00'
    Registrar:
      title: Registrar
      type: object
      properties:
        url:
          type: string
        name:
          type: string
        organization:
          type: string
      examples:
        - url: http://tucowsdomains.com
          name: TUCOWS, INC.
          organization: TUCOWS, INC.
  securitySchemes:
    bearer:
      type: http
      scheme: bearer

````