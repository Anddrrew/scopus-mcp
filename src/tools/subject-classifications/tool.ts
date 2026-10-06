import type { McpServer } from '@modelcontextprotocol/server';
import type { ScopusClient } from '../../scopus/client';
import { validateSchema } from '../../schemas/schema';
import { ScopusError } from '../../scopus/errors';
import { inputSchema, outputSchema } from './schemas';

export function registerSubjectClassifications(
  server: McpServer,
  client: ScopusClient,
): void {
  server.registerTool(
    'subject_classifications',
    {
      title: 'Scopus Subject Classifications',
      description:
        'Retrieve or filter Scopus subject classifications. Returns the original Elsevier JSON, including subject codes, descriptions, details, and abbreviations. Omit filters to list all classifications. This public endpoint does not require an API key.',
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input, ctx) => {
      try {
        const response = await client.get(
          '/content/subject/scopus',
          input,
          ctx.mcpReq.signal,
          { requireApiKey: false },
        );
        const parsed = await validateSchema(outputSchema, response.body);
        if (parsed.issues) {
          throw new ScopusError(
            'INVALID_RESPONSE',
            'Scopus returned an unexpected subject classifications response.',
            200,
            response.headers,
          );
        }
        return {
          structuredContent: parsed.value,
          content: [{ type: 'text', text: JSON.stringify(parsed.value) }],
          _meta: { 'scopus-mcp/headers': response.headers },
        };
      } catch (error) {
        const failure =
          error instanceof ScopusError
            ? error
            : new ScopusError(
                'INTERNAL_ERROR',
                'The subject classifications request could not be completed.',
              );
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                code: failure.code,
                message: failure.message,
                status: failure.status,
              }),
            },
          ],
          _meta: { 'scopus-mcp/headers': failure.headers },
        };
      }
    },
  );
}
