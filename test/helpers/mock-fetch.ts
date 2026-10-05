export function mockFetch(
  reply: Response | ((request: Request) => Response | Promise<Response>),
) {
  const requests: Request[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return typeof reply === 'function' ? reply(request) : reply;
  };
  return { requests, fetch: fetchImpl };
}
