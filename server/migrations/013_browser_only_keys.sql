-- Personal credentials must no longer be retained on the server.
PRAGMA secure_delete=ON;
DELETE FROM models WHERE owner_user_id IS NOT NULL;
