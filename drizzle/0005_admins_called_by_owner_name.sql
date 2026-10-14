-- Super admins added before this change were named after their user name
-- ("jody1234"). Everyone is now called by the owner's name, like new ones.
UPDATE "users" AS u
SET "name" = o."name", "updated_at" = now()
FROM (SELECT "name" FROM "users" WHERE "role" = 'owner' LIMIT 1) AS o
WHERE u."role" = 'admin' AND lower(u."name") = u."username";
