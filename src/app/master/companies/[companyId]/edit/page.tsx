"use client";

import { useEffect, useState } from "react";
import { MasterCompanyFormPage } from "@/components/master-company-form";

export default function MasterEditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    void params.then((value) => setCompanyId(value.companyId));
  }, [params]);

  if (!companyId) return null;

  return <MasterCompanyFormPage mode="edit" companyId={companyId} />;
}
