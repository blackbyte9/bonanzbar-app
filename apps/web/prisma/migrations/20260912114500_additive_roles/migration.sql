-- AlterTable
ALTER TABLE "User" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT ARRAY['USER']::"Role"[];

-- Preserve every existing role and make administration additive.
UPDATE "User"
SET "roles" = CASE
  WHEN "role" = 'ADMIN' THEN ARRAY['ADMIN', 'MANAGER', 'USER']::"Role"[]
  ELSE ARRAY["role"]
END;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

-- Enforce non-empty assignments and the invariant that administrators have every role.
ALTER TABLE "User"
  ADD CONSTRAINT "User_roles_not_empty_check" CHECK (cardinality("roles") > 0),
  ADD CONSTRAINT "User_admin_implies_all_roles_check"
    CHECK (
      NOT ("roles" @> ARRAY['ADMIN']::"Role"[])
      OR "roles" @> ARRAY['ADMIN', 'MANAGER', 'USER']::"Role"[]
    );
