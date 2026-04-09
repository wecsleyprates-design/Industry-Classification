<!-- Source: https://docs.worthai.com/use-cases/pre-filling-data/step-final-notes.md -->
# Notes

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.worthai.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Notes

### Pre-Fill Trigger

* The trigger typically happens on the **client’s form** once the user inputs their **business name** and/or other unique identifiers.
* This data can be sent to your backend to initiate the KYB/KYC process and return enriched values to pre-fill the form.

### Handling Incomplete or Invalid Data

* If no matching data is found, the `GET KYB/KYC` endpoints may return `null` or partial values.
* Clients should ensure fallback UI handling for these cases (e.g., allowing manual entry if fields are empty).


Built with [Mintlify](https://mintlify.com).