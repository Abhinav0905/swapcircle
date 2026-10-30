import { getApiHandlers } from "@/lib/server/RuntimeServices";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return getApiHandlers().read(request, (await context.params).id);
}
export async function POST(request: Request, context: Context) {
  return getApiHandlers().act(request, (await context.params).id);
}
export async function DELETE(request: Request, context: Context) {
  return getApiHandlers().remove(request, (await context.params).id);
}
