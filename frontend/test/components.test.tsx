import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ApiError } from '../src/api';
import '../src/i18n';
import { EmptyState, ErrorNotice } from '../src/shared/components';

describe('shared data states', () => {
  it('localizes stable API error codes instead of exposing server messages', () => {
    render(
      <MemoryRouter>
        <ErrorNotice
          error={new ApiError('database details', 409, 'campaign_unavailable')}
          retry={() => {}}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'This campaign is no longer open for bidding.'
    );
    expect(screen.getByRole('alert').textContent).not.toContain(
      'database details'
    );
  });

  it('renders an explicit empty state', () => {
    render(
      <MemoryRouter>
        <EmptyState title="Nothing here" text="Create the first item." />
      </MemoryRouter>
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByText('Create the first item.')).toBeTruthy();
  });
});
