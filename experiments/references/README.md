# Reference inputs

Target references are deliberately absent. Before a run, each externally approved reference must have an approved JSON record in `registry/` with its `asset_id`, expected filename, SHA-256, status, and purpose. The runner recomputes the user-supplied file digest and requires the registered `asset_id` and SHA-256 before any model request. Local pathnames do not establish identity.

The actual reference images remain external to git. Do not add them to this directory.
