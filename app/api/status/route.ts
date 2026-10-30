import { getApiHandlers } from "@/lib/server/RuntimeServices";

export const dynamic = "force-dynamic";
export function GET() { return getApiHandlers().status(); }
