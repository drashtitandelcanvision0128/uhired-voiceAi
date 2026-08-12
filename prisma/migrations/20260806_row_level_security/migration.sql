-- PostgreSQL row-level security (defense-in-depth tenant isolation).
-- Application must set per-transaction scope via set_config('app.company_id', '<id>', true).
-- See src/lib/prisma-tenant-scope.ts

ALTER TABLE "Requirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requirement" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Candidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Candidate" FORCE ROW LEVEL SECURITY;

ALTER TABLE "InterviewSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewSession" FORCE ROW LEVEL SECURITY;

ALTER TABLE "ScorecardShareLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScorecardShareLink" FORCE ROW LEVEL SECURITY;

ALTER TABLE "RequirementInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequirementInvite" FORCE ROW LEVEL SECURITY;

ALTER TABLE "CompanyMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyMember" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_requirement ON "Requirement"
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  );

CREATE POLICY tenant_candidate ON "Candidate"
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  );

CREATE POLICY tenant_interview_session ON "InterviewSession"
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" IS NULL
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" IS NULL
    OR "companyId" = current_setting('app.company_id', true)
  );

CREATE POLICY tenant_scorecard_share ON "ScorecardShareLink"
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  );

CREATE POLICY tenant_requirement_invite ON "RequirementInvite"
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  );

CREATE POLICY tenant_company_member ON "CompanyMember"
  FOR ALL
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR "companyId" = current_setting('app.company_id', true)
  );
