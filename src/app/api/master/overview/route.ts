import { GET as getDashboard } from "../dashboard/route";

/** @deprecated Use GET /api/master/dashboard instead. */
export async function GET(request: Request) {
  return getDashboard(request);
}
