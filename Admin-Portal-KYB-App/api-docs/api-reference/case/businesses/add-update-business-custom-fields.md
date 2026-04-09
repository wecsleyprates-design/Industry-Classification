<!-- Source: https://docs.worthai.com/api-reference/case/businesses/add-update-business-custom-fields.md -->
# Adding Custom Fields with POST Add Business and PATCH Update Business

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Adding Custom Fields with POST Add Business and PATCH Update Business

## Using POST Add Business and PATCH Update Business with Custom Fields

### Getting Started

1. Ensure you are utilizing custom fields by contacting your Customer Success representative.
2. Await confirmation that a custom field template has been added to your environment.
3. Gather custom field IDs and review type structures in the "Custom Field Types" section.
4. Utilize the "Adding to POST and PATCH" section below to see payload structure and examples.
5. Make your POST or PATCH request

### Custom Field Types

Currently, the following custom field types are supported via POST Add Business and PATCH Update Business requests:

* **Boolean**: Standard true/false boolean values.
* **Integer**: Whole number types (1, 2, 100, -1000, 999999999, etc.)
* **Decimal**: Decimal number types (1.1, 2.0195, -1000.0001, 999999.9999992, etc.)
* **Text**: Single strings with no line breaks.
* **Dropdown**: A label/value object pair, a stringifed object pair, or a string representing the selected dropdown value.
  * **Example 1**: Dropdown JSON Object
  ```JSON lines theme={null}
  {
      "label": "Option1",
      "value": "Option1"
  }
  ```
  * **Example 2**: Stringified dropdown object: `"{\"label\": \"Option1\", \"value\": \"Option1\"}"`
  * **Example 3**: String value: `"Option1"` *(Note: this is the value, not the label)*
* **Checkbox**: An array of checkbox objects or a stringified array of checkbox objects representing the checked items.
  * **Example 1**: Checkbox JSON Object Array - Single Checked Option
  ```JSON lines theme={null}
  [
      {
          "label": "Option1",
          "value": "Option1",
          "checkbox_type": "",
          "checked": true
      }
  ]
  ```
  * **Example 2**:  Checkbox JSON Object Array - Multiple Checked Options
  ```JSON lines theme={null}
  [
      {
          "label": "Option1",
          "value": "Option1",
          "checkbox_type": "",
          "checked": true
      },
      {
          "label": "Option2",
          "value": "Option2",
          "checkbox_type": "",
          "checked": true
      }
  ]
  ```
  * **Example 3**: Stringified checkbox object array: `"[{\"label\": \"Option1\", \"value\": \"Option1\", \"checkbox_type\": \"\", \"checked\": true}]"`

### Adding to POST and PATCH

To add custom fields to the [POST Add Business](/api-reference/add-or-update-business/add-business) payload or [PATCH Update Business](/api-reference/add-or-update-business/update-business) payload, simply include them in the payload body using
a combination of "custom:" prefix and custom field ID as the property name. Then, provide the data appropriately using the "Custom Field Types" as reference.

#### POST examples

<Tabs>
  <Tab title="Simple Example 1">
    Enabled Custom Fields:

    * Age of Business (years):
      * **Custom field ID**: age\_of\_business\_years
      * **Type**: `integer`
    * Age of Business (months)
      * **Custom field ID**: age\_of\_business\_months
      * **Type**: `integer`
    * Business Fun Fact
      * **Custom field ID**: fun\_fact
      * **Type**: `text`

    Minimum Add Business Payload:

    ```JSON lines theme={null}
        {
            "name": "Company Incorporated LLC"
        }
    ```

    Add Business Payload with Custom Fields:

    ```JSON lines wrap theme={null}
        {
            "external_id": "Custom_Fields_Example_01",
            "name": "Company Incorporated LLC",
            "custom:age_of_business_years": 49,
            "custom:age_of_business_months": 11,
            "custom:fun_fact": "This business will always be one month short of 50 years old!"
        }
    ```
  </Tab>

  <Tab title="Extended Example 2">
    Enabled Custom Fields:

    * Age of Business (years):
      * **Custom field ID**: age\_of\_business\_years
      * **Type**: `integer`
    * Age of Business (months)
      * **Custom field ID**: age\_of\_business\_months
      * **Type**: `integer`
    * Business Fun Fact
      * **Custom field ID**: fun\_fact
      * **Type**: `text`
    * How Did You Hear About Us?
      * **Custom field ID**: marketing\_channel
      * **Type**: `dropdown`
      * **Options**:
        * Label: "Web Ad", Value: "Web Ad"
        * Label: "Phone Call", Value: "Phone Call"
        * Label: "Recommendation", Value: "Recommendation"
        * Label: "Other", Value: "Other"
    * What Services Do You Need?
      * **Custom field ID**: services\_needed
      * **Type**: `checkbox`
      * **Options**:
        * Label: "Loan", Value: "Loan"
        * Label: "Business Advice", Value: "Business Advice"
        * Label: "Other", Value: "Other"

    Minimum Add Business Payload:

    ```JSON lines theme={null}
        {
            "name": "Company Incorporated LLC"
        }
    ```

    Add Business Payload with Custom Fields:

    ```JSON lines wrap theme={null}
        {
            "external_id": "Custom_Fields_Example_02",
            "name": "Company Incorporated LLC",
            "custom:age_of_business_years": 49,
            "custom:age_of_business_months": 11,
            "custom:fun_fact": "This business will always be one month short of 50 years old!",
            "custom:marketing_channel": {
                "label": "Phone Call",
                "value": "Phone Call"
            },
            "custom:services_needed": [
                {
                    "label": "Loan",
                    "value": "Loan",
                    "checkbox_type": "",
                    "checked": true
                }
            ]
        }
    ```
  </Tab>

  <Tab title="Advanced Example 3">
    Enabled Custom Fields:

    * Does Business Vertical Match Typical?
      * **Custom field ID**: business\_vertical\_compatible
      * **Type**: `boolean`
      * *internal field*
    * Age of Business (years):
      * **Custom field ID**: age\_of\_business\_years
      * **Type**: `integer`
      * *external field*
    * Age of Business (months)
      * **Custom field ID**: age\_of\_business\_months
      * **Type**: `integer`
      * *external field*
    * Business Fun Fact
      * **Custom field ID**: fun\_fact
      * **Type**: `text`
      * *external field*
    * Business Un-fun Fact
      * Custom field ID: un\_fun\_fact
      * **Type**: `text`
      * *external field*
    * How Did You Hear About Us?
      * **Custom field ID**: marketing\_channel
      * **Type**: `dropdown`
      * **Options**:
        * Label: "Web Ad", Value: "giggle\_addcents"
        * Label: "Phone Call", Value: "sales\_channel-cold"
        * Label: "Recommendation", Value: "partner\_rec"
        * Label: "Other", Value: "other"
      * *external field*
    * What Services Do You Need?
      * **Custom field ID**: services\_needed
      * **Type**: `checkbox`
      * **Options**:
        * Label: "Loan", Value: "loan"
        * Label: "Business Advice", Value: "business\_advice"
        * Label: "Other", Value: "other"
      * *external field*

    Minimum Add Business Payload:

    ```JSON lines theme={null}
        {
            "name": "Company Incorporated LLC"
        }
    ```

    Add Business Payload with Custom Fields:

    ```JSON lines wrap theme={null}
        {
            "external_id": "Custom_Fields_Example_03",
            "name": "Company Incorporated LLC",
            "custom:business_vertical_compatible": true,
            "custom:age_of_business_years": 49,
            "custom:age_of_business_months": 11,
            "custom:un_fun_fact": "Fun facts are not fun.",
            "custom:marketing_channel": "giggle_addcents",
            "custom:services_needed": [
                {
                    "label": "Loan",
                    "value": "loan",
                    "checkbox_type": "",
                    "checked": true
                },
                {
                    "label": "Business Advice",
                    "value": "business_advice",
                    "checkbox_type": "",
                    "checked": true
                },
                {
                    "label": "Other",
                    "value": "other",
                    "checkbox_type": "",
                    "checked": true
                }
            ]
        }
    ```

    <Note>When a field is not needed, do not include it in the payload. Sending a blank or null value could lead to an empty field being returned later.</Note>
  </Tab>
</Tabs>


Built with [Mintlify](https://mintlify.com).