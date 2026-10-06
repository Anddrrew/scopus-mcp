import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

// Validate each comma-separated segment without imposing an undocumented ID
// format. Empty segments and trimmed dot-only segments cannot identify a profile.
const identifiers = (description: string) =>
  Type.String({
    pattern:
      '^(?!\\s*(?:\\.+\\s*)?(?:,|$))[^,]+(?:,(?!\\s*(?:\\.+\\s*)?(?:,|$))[^,]+)*$',
    description,
  });

export const inputSchema = defineSchema(
  Type.Object(
    {
      author_id: Type.Optional(
        identifiers(
          'Scopus author ID, or comma-separated IDs for one native batch request. Provide exactly one of author_id, eid, orcid.',
        ),
      ),
      eid: Type.Optional(
        identifiers(
          'Author electronic ID (EID), or comma-separated EIDs for one native batch request. Use instead of author_id or orcid.',
        ),
      ),
      orcid: Type.Optional(
        Type.String({
          pattern: '^(?!\\s*(?:\\.+\\s*)?$)[^,]+$',
          description:
            'One ORCID identifier; comma-separated lists are not accepted. Returns the Scopus author profile. Use instead of author_id or eid.',
        }),
      ),
      view: Type.Optional(
        Type.Union(
          [
            Type.Literal('BASIC'),
            Type.Literal('LIGHT'),
            Type.Literal('STANDARD'),
            Type.Literal('ENHANCED'),
            Type.Literal('METRICS'),
            Type.Literal('DOCUMENTS'),
            Type.Literal('ENTITLED'),
          ],
          {
            description:
              'Response view (API default: LIGHT). DOCUMENTS requires a single identifier. Access depends on entitlements.',
          },
        ),
      ),
      field: Type.Optional(
        nonBlankString('Comma-separated response fields to include.'),
      ),
      alias: Type.Optional(
        Type.Boolean({
          description:
            'Single profiles only: false requests a superseded profile instead of its replacement (API default: true).',
        }),
      ),
      startref: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Single profiles only: zero-based offset for related documents. No additional pages are fetched automatically.',
        }),
      ),
      refcount: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Single profiles only: number of related documents to return; API limits depend on service level.',
        }),
      ),
      reqId: Type.Optional(
        nonBlankString(
          'Caller-supplied request identifier for Elsevier support.',
        ),
      ),
      ver: Type.Optional(nonBlankString('Elsevier resource version.')),
    },
    {
      additionalProperties: false,
      oneOf: [
        { required: ['author_id'] },
        { required: ['eid'] },
        { required: ['orcid'] },
      ],
      if: {
        anyOf: [
          {
            required: ['author_id'],
            properties: { author_id: { pattern: ',' } },
          },
          { required: ['eid'], properties: { eid: { pattern: ',' } } },
        ],
      },
      then: {
        not: {
          anyOf: [
            {
              required: ['view'],
              properties: { view: { const: 'DOCUMENTS' } },
            },
            { required: ['alias'] },
            { required: ['startref'] },
            { required: ['refcount'] },
          ],
        },
      },
    },
  ),
);

const profile = Type.Object(
  {
    '@status': optionalText(
      'Elsevier status for this profile, including per-author outcomes in batch responses.',
    ),
    coredata: Type.Optional(
      Type.Union(
        [
          Type.Object(
            {
              'dc:identifier': optionalText(
                'Scopus author identifier, usually prefixed with AUTHOR_ID:.',
              ),
              'prism:url': optionalText(
                'Elsevier API URL for this author profile.',
              ),
              eid: optionalText(
                'Scopus electronic identifier (EID) for the author.',
              ),
              'document-count': optionalText(
                'Number of documents associated with the author, preserved as the API string.',
              ),
              'citation-count': optionalText(
                'Number of citations to the author’s documents, preserved as the API string.',
              ),
              'cited-by-count': optionalText(
                'Number of documents citing the author’s work, preserved as the API string.',
              ),
            },
            { additionalProperties: true },
          ),
          Type.Null(),
        ],
        {
          description:
            'Core author identifiers and counts; available fields depend on the requested view.',
        },
      ),
    ),
    'h-index': optionalText('Author h-index, preserved as the API string.'),
    'coauthor-count': optionalText(
      'Number of coauthors, preserved as the API string.',
    ),
  },
  { additionalProperties: true },
);
const profiles = Type.Union([profile, Type.Array(profile), Type.Null()], {
  description:
    'Author profile or profiles in Elsevier’s native object, array, or null representation. View-specific and unrecognized fields are preserved.',
});

// Native batch retrieval has a different envelope. Both envelopes may contain
// partial profiles; keep unknown fields and native object/array cardinality.
export const outputSchema = defineSchema(
  Type.Object(
    {
      'author-retrieval-response': Type.Optional(profiles),
      'author-retrieval-response-list': Type.Optional(
        Type.Union(
          [
            Type.Object(
              { 'author-retrieval-response': Type.Optional(profiles) },
              { additionalProperties: true },
            ),
            Type.Null(),
          ],
          {
            description:
              'Native batch response envelope. Inspect each profile’s @status for individual outcomes; HTTP success does not imply every author was found.',
          },
        ),
      ),
    },
    {
      additionalProperties: true,
      anyOf: [
        { required: ['author-retrieval-response'] },
        { required: ['author-retrieval-response-list'] },
      ],
    },
  ),
);
