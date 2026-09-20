interface ErrorWithCode extends Error {
  code?: string;
}

interface ErrorResponse {
  statusCode: number;
  body: {
    error: {
      code: string;
      message: string;
    };
  };
}

const databaseErrors: Record<
  string,
  readonly [statusCode: number, code: string, message: string]
> = {
  P0002: [404, 'not_found', 'The requested resource was not found.'],
  '22023': [400, 'invalid_input', 'The supplied input is invalid.'],
  '22003': [422, 'invalid_amount', 'The supplied amount is invalid.'],
  '42501': [422, 'ineligible_creator', 'The creator is not eligible for this campaign.'],
  '55000': [409, 'campaign_unavailable', 'The campaign is not available for bidding.'],
  '23505': [409, 'conflict', 'The resource conflicts with existing data.'],
  '23514': [422, 'constraint_violation', 'The supplied value violates a business rule.']
};

export function databaseErrorResponse(error: ErrorWithCode): ErrorResponse | null {
  const mapped = error.code ? databaseErrors[error.code] : undefined;
  if (!mapped) return null;

  return {
    statusCode: mapped[0],
    body: {
      error: {
        code: mapped[1],
        message: mapped[2]
      }
    }
  };
}
