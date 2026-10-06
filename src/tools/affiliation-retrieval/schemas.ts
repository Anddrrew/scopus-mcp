import Type from 'typebox';
import { nonBlankString, optionalText } from '../../schemas/fields';
import { defineSchema } from '../../schemas/schema';

// Keep identifiers opaque, while rejecting blank values, path dot segments,
// and comma-separated lists (this endpoint only retrieves one affiliation).
const identifier = (description: string) =>
  Type.String({ pattern: '^(?!\\s*(?:\\.+\\s*)?$)[^,]+$', description });

export const inputSchema = defineSchema(
  Type.Object(
    {
      affiliation_id: Type.Optional(
        identifier(
          'One Scopus affiliation ID. Provide exactly one of affiliation_id or eid; comma-separated lists are not supported.',
        ),
      ),
      eid: Type.Optional(
        identifier(
          'One affiliation electronic ID (EID). Use instead of affiliation_id; comma-separated lists are not supported.',
        ),
      ),
      view: Type.Optional(
        Type.Union(
          [
            Type.Literal('BASIC'),
            Type.Literal('LIGHT'),
            Type.Literal('STANDARD'),
            Type.Literal('DOCUMENTS'),
            Type.Literal('AUTHORS'),
            Type.Literal('ENTITLED'),
          ],
          {
            description:
              'Response view (API default: LIGHT). DOCUMENTS and AUTHORS return related records. Availability depends on entitlements.',
          },
        ),
      ),
      field: Type.Optional(
        nonBlankString(
          'Comma-separated response fields to include; unavailable with DOCUMENTS and AUTHORS views.',
        ),
      ),
      startref: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Zero-based result offset for related documents or authors. No additional pages are fetched automatically.',
        }),
      ),
      refcount: Type.Optional(
        Type.Integer({
          minimum: 0,
          maximum: Number.MAX_SAFE_INTEGER,
          description:
            'Number of related documents or authors to return; API limits depend on service level.',
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
      oneOf: [{ required: ['affiliation_id'] }, { required: ['eid'] }],
      if: {
        required: ['view'],
        properties: { view: { enum: ['DOCUMENTS', 'AUTHORS'] } },
      },
      then: { not: { required: ['field'] } },
    },
  ),
);

const profile = Type.Object(
  {
    coredata: Type.Optional(
      Type.Union(
        [
          Type.Object(
            {
              'dc:identifier': optionalText(
                'Scopus affiliation identifier, usually prefixed with AFFILIATION_ID:.',
              ),
              'prism:url': optionalText(
                'Elsevier API URL for this affiliation profile.',
              ),
              eid: optionalText(
                'Scopus electronic identifier (EID) for the affiliation.',
              ),
              'author-count': optionalText(
                'Number of authors associated with the affiliation, preserved as the API string.',
              ),
              'document-count': optionalText(
                'Number of documents associated with the affiliation, preserved as the API string.',
              ),
            },
            { additionalProperties: true },
          ),
          Type.Null(),
        ],
        {
          description:
            'Core affiliation identifiers and counts; available fields depend on the requested view.',
        },
      ),
    ),
    'affiliation-name': optionalText(
      'Name of the affiliation in the Scopus profile.',
    ),
    city: optionalText('City of the affiliation.'),
    country: optionalText('Country of the affiliation.'),
  },
  { additionalProperties: true },
);

// Preserve partial profiles and view-specific content without normalizing
// Elsevier’s strings, nulls, unknown fields, or object/array cardinality.
export const outputSchema = defineSchema(
  Type.Object(
    {
      'affiliation-retrieval-response': Type.Union(
        [profile, Type.Array(profile), Type.Null()],
        {
          description:
            'Affiliation response in Elsevier’s native object, array, or null representation. May contain a profile or related documents/authors according to view; unrecognized fields are preserved.',
        },
      ),
    },
    { additionalProperties: true },
  ),
);
