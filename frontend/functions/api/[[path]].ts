export async function onRequest({ request }: { request: Request }): Promise<Response> {
  const backendUrl = new URL(request.url);
  backendUrl.protocol = 'https:';
  backendUrl.hostname = 'nexus-backend.kuhan200973.workers.dev';
  backendUrl.port = '';

  return fetch(new Request(backendUrl, request));
}