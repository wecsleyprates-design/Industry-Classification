-- Add base_name column to the data_document_templates table
ALTER TABLE esign.data_document_templates ADD COLUMN IF NOT EXISTS base_name VARCHAR NULL;
