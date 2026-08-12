import { CoObserverRoom } from "@/components/co-observer-room";

export default async function ObservePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CoObserverRoom token={token} />;
}
