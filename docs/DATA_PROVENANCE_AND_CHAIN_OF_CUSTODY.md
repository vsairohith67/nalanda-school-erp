# Data Provenance and Chain of Custody

## Required custody record

Record package/source ID, owner, exporting person, export and receipt timestamps, original filename/size/SHA-256, format/encoding, academic years/domains, confidentiality, transfer method, malware result, validation result, approval state, retention deadline and superseded package reference.

## Preservation

1. Receive through an approved private channel.
2. Capture size and SHA-256 before transformation.
3. Store `ORIGINAL_SOURCE_BYTES` read-only in approved encrypted storage.
4. Create a separately named `NORMALIZED_WORKING_COPY` and record its parent hash.
5. Scan and validate only in an isolated private environment.
6. Represent corrections as mapping/decision records containing source, proposed and approved values; never mutate original evidence.
7. A byte change creates a new package ID. A mapping change creates a new version and dry run.
8. A superseded package remains traceable until approved retention/disposal.

Do not place credentials, real source rows or private storage paths in the manifest, Git, CI, Notion, Asana or Canvs. Tracker records contain only safe status, IDs, counts and evidence references.

Disposal is not complete until storage confirms object/local-copy deletion, backup treatment is recorded and an operator receipt exists. Failure is recorded as failure, never as deletion.
