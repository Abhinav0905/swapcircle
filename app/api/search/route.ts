import { getApiHandlers } from "@/lib/server/RuntimeServices";

export const dynamic = "force-dynamic";
export function GET(request: Request) { return getApiHandlers().search(request); }
