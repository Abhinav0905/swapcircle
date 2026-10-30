import { getApiHandlers } from "@/lib/server/RuntimeServices";

export const dynamic = "force-dynamic";
export function POST(request: Request) { return getApiHandlers().create(request); }
