ALTER TABLE lessons ADD COLUMN document_resource_id uuid
 REFERENCES resources(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE lessons ADD COLUMN document_page_start integer NOT NULL DEFAULT 1 CHECK(document_page_start>0);
ALTER TABLE lessons ADD COLUMN document_page_end integer CHECK(document_page_end>=document_page_start);
