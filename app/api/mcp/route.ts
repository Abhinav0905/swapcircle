import { getMcpServer } from "@/lib/server/RuntimeServices";

export const dynamic = "force-dynamic";
export function POST(request: Request) { return getMcpServer().post(request); }
export function GET(request: Request) { return getMcpServer().get(request); }
